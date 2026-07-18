/**
 * In-memory fixed-window rate limiter.
 *
 * A clock function is injected so the limiter is fully deterministic under
 * test. The API layer keys requests by client IP; exceeding the budget yields a
 * {@link RateLimitError} carrying a `Retry-After` hint.
 */

import { RateLimitError } from '@/core/errors';

const MILLIS_PER_SECOND = 1000;

/** The outcome of a single rate-limit check. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/** Fixed-window counter keyed by an arbitrary client identifier. */
export class RateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  public constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit for `key` and reports whether it is within budget. `O(1)`. */
  public check(key: string): RateLimitDecision {
    const currentTime = this.now();
    const entry = this.windows.get(key);
    if (entry === undefined || entry.resetAt <= currentTime) {
      this.windows.set(key, { count: 1, resetAt: currentTime + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterSeconds: 0 };
    }
    if (entry.count < this.limit) {
      entry.count += 1;
      return { allowed: true, remaining: this.limit - entry.count, retryAfterSeconds: 0 };
    }
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - currentTime) / MILLIS_PER_SECOND),
    };
  }
}

/**
 * Runs a rate-limit check and throws {@link RateLimitError} when the caller has
 * exhausted their budget. Returns silently when the request is permitted.
 */
export function enforceRateLimit(limiter: RateLimiter, key: string): void {
  const decision = limiter.check(key);
  if (!decision.allowed) {
    throw new RateLimitError('Too many requests.', decision.retryAfterSeconds);
  }
}
