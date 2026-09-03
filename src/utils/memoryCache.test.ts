import { describe, expect, it, vi } from 'vitest';
import { dedupeRequest, MemoryCache } from './memoryCache';

describe('MemoryCache', () => {
  it('returns fresh and stale values within the SWR window', () => {
    let currentTime = 1_000;
    const cache = new MemoryCache({
      ttlMs: 100,
      staleWhileRevalidateMs: 300,
      now: () => currentTime,
    });

    cache.write('league:1', ['team-a']);
    expect(cache.read<string[]>('league:1')).toMatchObject({ data: ['team-a'], isStale: false });

    currentTime += 150;
    expect(cache.read<string[]>('league:1')).toMatchObject({ data: ['team-a'], isStale: true });

    currentTime += 151;
    expect(cache.read<string[]>('league:1')).toBeNull();
  });

  it('invalidates exact keys and key prefixes', () => {
    const cache = new MemoryCache();
    cache.write('leagues:user-a', ['league-a']);
    cache.write('details:league-a:teams', ['team-a']);
    cache.write('details:league-a:matches', ['match-a']);

    cache.invalidate('leagues:user-a');
    cache.invalidatePrefix('details:league-a:');

    expect(cache.read('leagues:user-a')).toBeNull();
    expect(cache.read('details:league-a:teams')).toBeNull();
    expect(cache.read('details:league-a:matches')).toBeNull();
  });

  it('limits the number of retained entries', () => {
    const cache = new MemoryCache({ maxEntries: 2 });
    cache.write('first', 1);
    cache.write('second', 2);
    cache.write('third', 3);

    expect(cache.read('first')).toBeNull();
    expect(cache.read('second')?.data).toBe(2);
    expect(cache.read('third')?.data).toBe(3);
  });
});

describe('dedupeRequest', () => {
  it('shares the same in-flight request', async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const request = vi.fn(() => new Promise<string>((resolve) => {
      resolveRequest = resolve;
    }));

    const first = dedupeRequest('same-key', request);
    const second = dedupeRequest('same-key', request);
    resolveRequest?.('loaded');

    await expect(Promise.all([first, second])).resolves.toEqual(['loaded', 'loaded']);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
