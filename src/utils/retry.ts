export interface RetryOptions {
  /** Maximum number of attempts, including the first request. */
  maxAttempts?: number;
  /** Initial delay before the first retry. */
  baseDelayMs?: number;
  /** Upper bound for the exponential delay. */
  maxDelayMs?: number;
  /** Random delay variation as a ratio of the calculated delay. */
  jitterRatio?: number;
  /** Override retry classification for a specific operation. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Injectable sleep function keeps the utility easy to test. */
  sleep?: (delayMs: number) => Promise<void>;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'sleep'>> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  jitterRatio: 0.2,
};

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429]);

function getErrorProperty(error: unknown, property: string): unknown {
  if (!error || typeof error !== 'object') return undefined;
  return (error as Record<string, unknown>)[property];
}

/** Returns true for errors that are usually safe to retry. */
export function isTransientError(error: unknown): boolean {
  if (getErrorProperty(error, 'name') === 'AbortError') return false;

  const status = getErrorProperty(error, 'status');
  if (typeof status === 'number' && (status >= 500 || TRANSIENT_STATUS_CODES.has(status))) {
    return true;
  }

  const message = error instanceof Error
    ? error.message
    : String(getErrorProperty(error, 'message') || error || '');
  return /network|fetch|timeout|timed out|connection|temporarily unavailable|rate limit|too many requests|5\d{2}/i.test(message);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function getRetryDelay(attempt: number, options: Required<Omit<RetryOptions, 'shouldRetry' | 'sleep'>>): number {
  const exponentialDelay = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * (2 ** Math.max(0, attempt - 1)),
  );
  const jitter = exponentialDelay * options.jitterRatio * Math.random();
  return Math.round(exponentialDelay + jitter);
}

/**
 * Retries transient async failures with exponential backoff and jitter.
 * The original error is re-thrown after the final failed attempt.
 */
export async function retryWithBackoff<T>(
  operation: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  const resolved = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const maxAttempts = Math.max(1, Math.floor(resolved.maxAttempts));
  const shouldRetry = options.shouldRetry || ((error: unknown) => isTransientError(error));
  const sleep = options.sleep || wait;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      await sleep(getRetryDelay(attempt, resolved));
    }
  }

  throw new Error('Retry operation completed without a result.');
}
