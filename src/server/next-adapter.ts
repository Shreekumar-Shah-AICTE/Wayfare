/**
 * Next.js adapter glue.
 *
 * Isolates the framework-specific concerns (constructing `NextResponse`,
 * extracting a client key from headers, and the shared rate limiter) from the
 * pure, tested handler logic in `handlers.ts`.
 */

import { NextResponse } from 'next/server';

import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './config';
import { enforceRateLimit, RateLimiter } from './rateLimit';
import type { ApiResult } from './respond';

const limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

/** Derives a best-effort client identifier for rate limiting. */
function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'anonymous';
}

/** Throws {@link RateLimitError} when the caller has exhausted their budget. */
export function guard(request: Request): void {
  enforceRateLimit(limiter, clientKey(request));
}

/** Converts a transport-neutral {@link ApiResult} into a `NextResponse`. */
export function toResponse(result: ApiResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
