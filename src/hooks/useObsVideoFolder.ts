import { useCallback, useRef, useState } from 'react';
import { isVideoFile } from '../utils/replayFormatters';

export const STORAGE_KEYS = {
  PATH: 'obsVideoFolderPath',
  NAME: 'obsVideoFolderName',
  LEGACY_NAME: 'replayFolderName',
} as const;

// No default path - let user choose on first launch
const IDB_NAME = 'ObsVideoFolderDB';
const IDB_KEY = 'obs_video_folder';
const LEGACY_IDB_NAME = 'InstantReplayDB';
const LEGACY_IDB_KEY = 'replay_folder';

export interface ObsVideoFolderConnectResult {
  success: boolean;
  pathMismatch?: boolean;
  error?: string;
  folderName?: string;
  fileCount?: number;
}

function migrateLegacyFolderName(): string {
  try {
    const current = localStorage.getItem(STORAGE_KEYS.NAME);
    if (current) return current;

    const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_NAME);
    if (legacy) {
      localStorage.setItem(STORAGE_KEYS.NAME, legacy);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_NAME);
      return legacy;
    }
  } catch {
    // ignore
  }
  return '';
}

export function loadSavedVideoFolderPath(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.PATH) || '';
  } catch {
    return '';
  }
}

export function loadSavedVideoFolderName(): string {
  return migrateLegacyFolderName();
}

function saveFolderNameToStorage(name: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.NAME, name);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_NAME);
  } catch {
    // ignore
  }
}

function openIdb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('handles')) {
        request.result.createObjectStore('handles');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadHandleFromIdb(dbName: string, key: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIdb(dbName);
    return await new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const getReq = tx.objectStore('handles').get(key);
      getReq.onsuccess = () => resolve((getReq.result as FileSystemDirectoryHandle) || null);
      getReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveHandleToIdb(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openIdb(IDB_NAME);
    await new Promise<void>((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function deleteHandleFromIdb(dbName: string, key: string): Promise<void> {
  try {
    const db = await openIdb(dbName);
    await new Promise<void>((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function clearStoredHandle(): Promise<void> {
  await Promise.all([
    deleteHandleFromIdb(IDB_NAME, IDB_KEY),
    deleteHandleFromIdb(LEGACY_IDB_NAME, LEGACY_IDB_KEY),
  ]);
}

async function loadStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  let handle = await loadHandleFromIdb(IDB_NAME, IDB_KEY);
  if (handle) return handle;

  handle = await loadHandleFromIdb(LEGACY_IDB_NAME, LEGACY_IDB_KEY);
  if (handle) {
    await saveHandleToIdb(handle);
  }
  return handle;
}

export async function scanVideosFromHandle(handle: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      if (isVideoFile(file)) {
        files.push(file);
      }
    }
  }
  return files.sort((a, b) => b.lastModified - a.lastModified);
}

function extractFolderNameFromPath(path: string): string {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').pop() || '';
}

function pathMatchesFolderName(savedPath: string, folderName: string): boolean {
  if (!savedPath || !folderName) return true;
  const tail = extractFolderNameFromPath(savedPath);
  return tail.toLowerCase() === folderName.toLowerCase();
}

type HandleWithPermission = FileSystemDirectoryHandle & {
  queryPermission?: (opts: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' }) => Promise<PermissionState>;
};

async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const handleWithPerm = handle as HandleWithPermission;
  if (handleWithPerm.queryPermission) {
    const current = await handleWithPerm.queryPermission({ mode: 'read' });
    if (current === 'granted') return true;
  }
  if (handleWithPerm.requestPermission) {
    const requested = await handleWithPerm.requestPermission({ mode: 'read' });
    return requested === 'granted';
  }
  return true;
}

export function useObsVideoFolder() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingConnectRef = useRef<{
    resolve: (result: ObsVideoFolderConnectResult) => void;
  } | null>(null);

  const [savedPath, setSavedPath] = useState(loadSavedVideoFolderPath);
  const [folderName, setFolderName] = useState(loadSavedVideoFolderName);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [lastScanTimestamp, setLastScanTimestamp] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [supportsDirectoryPicker, setSupportsDirectoryPicker] = useState(
    () => typeof window !== 'undefined' && 'showDirectoryPicker' in window
  );

  const applyConnectedState = useCallback(
    (handle: FileSystemDirectoryHandle | null, files: File[], name: string) => {
      setFolderHandle(handle);
      setVideoFiles(files);
      setFolderName(name);
      setLastScanTimestamp(Date.now());
      setIsConnected(true);
      setLastError(null);
      if (name) saveFolderNameToStorage(name);
    },
    []
  );

  const savePathToStorage = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PATH, savedPath);
    } catch {
      // ignore
    }
  }, [savedPath]);

  const connectWithHandle = useCallback(
    async (handle: FileSystemDirectoryHandle, updatePath = true): Promise<ObsVideoFolderConnectResult> => {
      const hasPermission = await ensureReadPermission(handle);
      if (!hasPermission) {
        return { success: false, error: 'ไม่ได้รับอนุญาตให้อ่านโฟลเดอร์' };
      }

      const files = await scanVideosFromHandle(handle);
      await saveHandleToIdb(handle);
      applyConnectedState(handle, files, handle.name);

      const pathMismatch = !pathMatchesFolderName(savedPath, handle.name);
      
      // Auto-update savedPath if needed
      if (updatePath && (pathMismatch || !savedPath)) {
        // If no saved path or mismatch, try to construct a reasonable path
        // This is a best-effort approach since File System Access API doesn't expose full paths
        let newPath = savedPath;
        
        if (!savedPath) {
          // First time: just use the folder name (user can set full path later if needed)
          newPath = handle.name;
        } else if (pathMismatch) {
          // Update the last segment of the path
          newPath = savedPath.replace(/[^/\\]+$/, handle.name);
        }
        
        setSavedPath(newPath);
        try {
          localStorage.setItem(STORAGE_KEYS.PATH, newPath);
        } catch {
          // ignore
        }
      }
      
      return { success: true, pathMismatch, folderName: handle.name, fileCount: files.length };
    },
    [applyConnectedState, savedPath, setSavedPath]
  );

  const connect = useCallback(async (): Promise<ObsVideoFolderConnectResult> => {
    setIsConnecting(true);
    setLastError(null);

    try {
      let handle = await loadStoredHandle();

      if (handle) {
        const hasPermission = await ensureReadPermission(handle);
        if (!hasPermission) {
          handle = null;
        }
      }

      if (!handle) {
        const windowWithPicker = window as Window & {
          showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        };

        if (!windowWithPicker.showDirectoryPicker) {
          setSupportsDirectoryPicker(false);
          return await new Promise<ObsVideoFolderConnectResult>((resolve) => {
            pendingConnectRef.current = { resolve };
            folderInputRef.current?.click();
          });
        }

        handle = await windowWithPicker.showDirectoryPicker();
      }

      const result = await connectWithHandle(handle);
      if (!result.success && result.error) {
        setLastError(result.error);
      }
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { success: false };
      }
      const message = error instanceof Error ? error.message : 'เชื่อมต่อโฟลเดอร์ไม่สำเร็จ';
      setLastError(message);
      return { success: false, error: message };
    } finally {
      setIsConnecting(false);
    }
  }, [connectWithHandle]);

  const handleFallbackFolderChange = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList || []).filter(isVideoFile);
      const sortedFiles = files.sort((a, b) => b.lastModified - a.lastModified);
      const name = files[0]?.webkitRelativePath.split('/')[0] || folderName || 'selected-folder';

      applyConnectedState(null, sortedFiles, name);

      const pathMismatch = !pathMatchesFolderName(savedPath, name);
      const result: ObsVideoFolderConnectResult = {
        success: true,
        pathMismatch,
        folderName: name,
        fileCount: sortedFiles.length,
      };
      pendingConnectRef.current?.resolve(result);
      pendingConnectRef.current = null;
      setIsConnecting(false);
    },
    [applyConnectedState, folderName, savedPath]
  );

  const disconnect = useCallback(() => {
    setFolderHandle(null);
    setVideoFiles([]);
    setIsConnected(false);
    setLastError(null);
    setLastScanTimestamp(0);
  }, []);

  const clearStoredFolder = useCallback(async () => {
    disconnect();
    setSavedPath('');
    setFolderName('');
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.PATH);
      localStorage.removeItem(STORAGE_KEYS.NAME);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_NAME);
    } catch {
      // ignore
    }
    await clearStoredHandle();
  }, [disconnect]);

  const rescan = useCallback(async (): Promise<File[]> => {
    if (!folderHandle) {
      return videoFiles;
    }

    try {
      const files = await scanVideosFromHandle(folderHandle);
      setVideoFiles(files);
      setLastScanTimestamp(Date.now());
      return files;
    } catch (error) {
      console.warn('Failed to rescan video folder:', error);
      setLastError('สканโฟลเดอร์ใหม่ไม่สำเร็จ');
      return videoFiles;
    }
  }, [folderHandle, videoFiles]);

  return {
    savedPath,
    setSavedPath,
    savePathToStorage,
    folderName,
    folderHandle,
    videoFiles,
    lastScanTimestamp,
    isConnected,
    isConnecting,
    lastError,
    supportsDirectoryPicker,
    folderInputRef,
    connect,
    disconnect,
    clearStoredFolder,
    rescan,
    handleFallbackFolderChange,
  };
}

export type ObsVideoFolderContextValue = ReturnType<typeof useObsVideoFolder>;
