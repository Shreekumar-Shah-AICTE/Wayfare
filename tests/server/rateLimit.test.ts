import { describe, expect, it } from 'vitest';

import { RateLimitError } from '@/core/errors';
import { enforceRateLimit, RateLimiter } from '@/server/rateLimit';

describe('RateLimiter', () => {
  it('allows requests within budget and blocks the overflow', () => {
    let now = 1000;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').remaining).toBe(0);
    const blocked = limiter.check('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    now += 2000;
    expect(limiter.check('k').allowed).toBe(true);
  });
});

describe('enforceRateLimit', () => {
  it('passes within budget and throws once exhausted', () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(() => {
      enforceRateLimit(limiter, 'x');
    }).not.toThrow();
    expect(() => {
      enforceRateLimit(limiter, 'x');
    }).toThrow(RateLimitError);
  });
});
