import { describe, expect, it, vi } from 'vitest';

import { runResilient, type ResilienceOptions } from '@/ai/resilience';

const fast: ResilienceOptions = { timeoutMs: 1000, retries: 2, backoffMs: 1 };

describe('runResilient', () => {
  it('returns the result on the first successful attempt', async () => {
    const sleep = vi.fn(async () => {});
    const result = await runResilient(async () => 'ok', fast, sleep);
    expect(result).toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries with backoff and then succeeds', async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const result = await runResilient(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('transient');
        }
        return 'recovered';
      },
      fast,
      sleep,
    );
    expect(result).toBe('recovered');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('rethrows the final error after exhausting retries', async () => {
    const sleep = vi.fn(async () => {});
    await expect(
      runResilient(
        async () => {
          throw new Error('always');
        },
        { timeoutMs: 1000, retries: 1, backoffMs: 1 },
        sleep,
      ),
    ).rejects.toThrow('always');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('aborts a task that exceeds the timeout', async () => {
    const sleep = vi.fn(async () => {});
    await expect(
      runResilient(
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
        { timeoutMs: 5, retries: 0, backoffMs: 1 },
        sleep,
      ),
    ).rejects.toThrow('aborted');
  });

  it('uses the default sleep when none is injected', async () => {
    let attempts = 0;
    const result = await runResilient(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('transient');
        }
        return 'ok';
      },
      { timeoutMs: 1000, retries: 1, backoffMs: 1 },
    );
    expect(result).toBe('ok');
  });
});
