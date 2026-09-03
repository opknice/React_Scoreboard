import { describe, expect, it, vi } from 'vitest';
import { isTransientError, retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  it('retries transient errors and returns the eventual result', async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    const result = await retryWithBackoff(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('Network request failed');
        return 'ok';
      },
      { sleep, jitterRatio: 0 },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient errors', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Invalid team name');
    });
    const sleep = vi.fn(async () => undefined);

    await expect(retryWithBackoff(operation, { sleep })).rejects.toThrow('Invalid team name');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows the final transient error after the attempt limit', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Request timeout');
    });
    const sleep = vi.fn(async () => undefined);

    await expect(
      retryWithBackoff(operation, { maxAttempts: 2, sleep, jitterRatio: 0 }),
    ).rejects.toThrow('Request timeout');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('recognizes common transient HTTP statuses', () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
  });
});
