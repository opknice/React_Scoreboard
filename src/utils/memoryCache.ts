export interface CacheReadResult<T> {
  data: T;
  isStale: boolean;
  ageMs: number;
}

export interface MemoryCacheOptions {
  ttlMs?: number;
  staleWhileRevalidateMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface CacheEntry<T> {
  data: T;
  storedAt: number;
  lastAccessedAt: number;
}

const DEFAULT_TTL_MS = 15_000;
const DEFAULT_STALE_WHILE_REVALIDATE_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 100;

/**
 * Lightweight, bounded in-memory cache for client-side read models.
 * Stale entries remain available for SWR until staleWhileRevalidateMs expires.
 */
export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly staleWhileRevalidateMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions = {}) {
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_TTL_MS);
    this.staleWhileRevalidateMs = Math.max(
      this.ttlMs,
      options.staleWhileRevalidateMs ?? DEFAULT_STALE_WHILE_REVALIDATE_MS,
    );
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
    this.now = options.now ?? Date.now;
  }

  read<T>(key: string): CacheReadResult<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    const currentTime = this.now();
    const ageMs = Math.max(0, currentTime - entry.storedAt);
    if (ageMs > this.staleWhileRevalidateMs) {
      this.entries.delete(key);
      return null;
    }

    entry.lastAccessedAt = currentTime;
    return {
      data: entry.data as T,
      isStale: ageMs > this.ttlMs,
      ageMs,
    };
  }

  write<T>(key: string, data: T): void {
    const currentTime = this.now();
    this.entries.set(key, {
      data,
      storedAt: currentTime,
      lastAccessedAt: currentTime,
    });

    while (this.entries.size > this.maxEntries) {
      const leastRecentlyUsedKey = [...this.entries.entries()]
        .sort(([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt)[0]?.[0];
      if (!leastRecentlyUsedKey) break;
      this.entries.delete(leastRecentlyUsedKey);
    }
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

const requestCache = new Map<string, Promise<unknown>>();

/** Share a request already in progress for the same cache key. */
export function dedupeRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existingRequest = requestCache.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const nextRequest = request().finally(() => {
    if (requestCache.get(key) === nextRequest) requestCache.delete(key);
  });
  requestCache.set(key, nextRequest);
  return nextRequest;
}

export const leagueMemoryCache = new MemoryCache({
  ttlMs: 15_000,
  staleWhileRevalidateMs: 60_000,
  maxEntries: 100,
});
