import { getBrowserVideoMimeType } from './replayFormatters';

export const MAX_REPLAY_FILE_SIZE = 250 * 1024 * 1024;
export const MAX_BROADCAST_FALLBACK_SIZE = 50 * 1024 * 1024;

const DB_NAME = 'scoreboard-replay-files';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const META_STORE = 'meta';
const LATEST_KEY = 'latest';

export interface ReplayFileReference {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

export interface ReplayHttpReference {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

interface StoredReplayFile extends ReplayFileReference {
  blob: Blob;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser'));
  }

  if (databasePromise) return databasePromise;

  const promise: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        database.createObjectStore(FILE_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open replay storage'));
  }).catch((error): never => {
    databasePromise = null;
    throw error;
  });

  databasePromise = promise;
  return promise;
}

function runTransaction<T>(
  database: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let request: IDBRequest<T> | undefined;

    try {
      request = operation(transaction) as IDBRequest<T> | undefined;
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error ?? new Error('Replay storage transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Replay storage transaction aborted'));
  });
}

function createReference(file: File): ReplayFileReference {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return {
    id: `${Date.now()}-${randomId}`,
    name: file.name,
    mime: getBrowserVideoMimeType(file) || 'video/mp4',
    size: file.size,
    createdAt: Date.now(),
  };
}

export async function storeLatestReplayFile(file: File): Promise<ReplayFileReference> {
  if (file.size > MAX_REPLAY_FILE_SIZE) {
    throw new Error(`ไฟล์รีเพลย์ใหญ่เกิน ${Math.round(MAX_REPLAY_FILE_SIZE / (1024 * 1024))} MB`);
  }

  const database = await openDatabase();
  const reference = createReference(file);

  await runTransaction(database, [FILE_STORE, META_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(FILE_STORE).put({ ...reference, blob: file } satisfies StoredReplayFile);
    transaction.objectStore(META_STORE).put(reference, LATEST_KEY);
  });

  // Keep only the latest clip in persistent storage. An existing object URL
  // remains valid after its backing IndexedDB record is removed.
  await removeOlderReplayFiles(database, reference.id);
  return reference;
}

async function removeOlderReplayFiles(database: IDBDatabase, keepId: string): Promise<void> {
  await runTransaction(database, [FILE_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(FILE_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (key !== keepId) store.delete(key);
      }
    };
  });
}

export async function getLatestReplayReference(): Promise<ReplayFileReference | null> {
  try {
    const database = await openDatabase();
    const reference = await runTransaction<ReplayFileReference | undefined>(
      database,
      [META_STORE],
      'readonly',
      (transaction) => transaction.objectStore(META_STORE).get(LATEST_KEY),
    );
    return reference ?? null;
  } catch {
    return null;
  }
}

export async function readReplayFile(id: string): Promise<StoredReplayFile | null> {
  if (!id) return null;

  try {
    const database = await openDatabase();
    const stored = await runTransaction<StoredReplayFile | undefined>(
      database,
      [FILE_STORE],
      'readonly',
      (transaction) => transaction.objectStore(FILE_STORE).get(id),
    );
    return stored ?? null;
  } catch {
    return null;
  }
}

function replayServerUrl(pathname: string): string {
  return new URL(pathname, window.location.origin).toString();
}

export async function uploadReplayFile(file: File): Promise<ReplayHttpReference> {
  const response = await fetch(replayServerUrl('/api/replay'), {
    method: 'POST',
    headers: {
      'Content-Type': getBrowserVideoMimeType(file) || 'video/mp4',
      'X-Replay-Name': encodeURIComponent(file.name.replace(/[\r\n]/g, '')),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Replay server returned HTTP ${response.status}`);
  }

  const reference = await response.json() as ReplayHttpReference;
  if (!reference.id || !reference.url) {
    throw new Error('Replay server returned an invalid reference');
  }

  return {
    ...reference,
    url: replayServerUrl(reference.url),
  };
}

export async function getLatestReplayHttpReference(): Promise<ReplayHttpReference | null> {
  try {
    const response = await fetch(replayServerUrl('/api/replay/latest/meta'), { cache: 'no-store' });
    if (!response.ok) return null;
    const reference = await response.json() as ReplayHttpReference;
    if (!reference.id || !reference.url) return null;
    return { ...reference, url: replayServerUrl(reference.url) };
  } catch {
    return null;
  }
}
