import { describe, expect, it, vi } from 'vitest';
import { createLatestAsyncByKeyQueue } from './latestAsyncByKey';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

describe('createLatestAsyncByKeyQueue', () => {
  it('keeps the in-flight value and coalesces pending updates to the latest value', async () => {
    const firstRequest = createDeferred();
    const processed: string[] = [];
    const worker = vi.fn(async (_key: string, value: string) => {
      processed.push(value);
      if (value === '00:01') await firstRequest.promise;
    });
    const queue = createLatestAsyncByKeyQueue(worker);

    const first = queue.enqueue('time_counter', '00:01');
    const second = queue.enqueue('time_counter', '00:02');
    const third = queue.enqueue('time_counter', '00:03');

    expect(processed).toEqual(['00:01']);
    firstRequest.resolve();
    await Promise.all([first, second, third]);

    expect(processed).toEqual(['00:01', '00:03']);
  });

  it('processes different keys independently', async () => {
    const firstRequest = createDeferred();
    const processed: string[] = [];
    const queue = createLatestAsyncByKeyQueue(async (key: string, value: string) => {
      processed.push(`${key}:${value}`);
      if (key === 'score_team_a') await firstRequest.promise;
    });

    const scoreA = queue.enqueue('score_team_a', '1');
    const scoreB = queue.enqueue('score_team_b', '2');
    await scoreB;

    expect(processed).toEqual(['score_team_a:1', 'score_team_b:2']);
    firstRequest.resolve();
    await scoreA;
  });
});
