/**
 * Timeout + retry-with-backoff wrapper for unreliable outbound calls.
 *
 * Every network task is bounded by an `AbortController` timeout and retried a
 * fixed number of times with exponential backoff. The `sleep` function is
 * injectable so retry behaviour is deterministic under test.
 */

/** Timeout, retry count, and base backoff for a resilient call. */
export interface ResilienceOptions {
  readonly timeoutMs: number;
  readonly retries: number;
  readonly backoffMs: number;
}

/** A cancellable async task that receives an abort signal. */
export type ResilientTask<T> = (signal: AbortSignal) => Promise<T>;

type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function callOnce<T>(task: ResilientTask<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs `task`, retrying on failure up to `options.retries` times with
 * exponential backoff. Rethrows the final error once all attempts are spent.
 */
export async function runResilient<T>(
  task: ResilientTask<T>,
  options: ResilienceOptions,
  sleep: Sleep = defaultSleep,
): Promise<T> {
  let lastError: unknown = new Error('Task was never attempted.');
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await callOnce(task, options.timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < options.retries) {
        await sleep(options.backoffMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
