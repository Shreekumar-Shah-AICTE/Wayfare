/**
 * Framework-agnostic response envelopes and the handler wrapper.
 *
 * Handlers return an {@link ApiResult} or throw a {@link DomainError}; the thin
 * Next.js route adapters convert an {@link ApiResult} into a `NextResponse`.
 * Crucially, {@link errorResult} guarantees a *sanitised* envelope — a client
 * never sees a stack trace or an internal message, only a stable error code.
 */

import { DomainError, RateLimitError, ValidationError } from '@/core/errors';

/** A transport-neutral HTTP result. */
export interface ApiResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly string[];
  };
}

const HTTP_OK = 200;
const HTTP_INTERNAL_ERROR = 500;
const NO_HEADERS: Readonly<Record<string, string>> = {};

/** Wraps a successful payload in an {@link ApiResult}. */
export function success(body: unknown, status: number = HTTP_OK): ApiResult {
  return { status, body, headers: NO_HEADERS };
}

function domainErrorResult(error: DomainError): ApiResult {
  const base = { code: error.code, message: error.message };
  const body: ErrorBody =
    error instanceof ValidationError && error.details.length > 0
      ? { error: { ...base, details: error.details } }
      : { error: base };
  const headers =
    error instanceof RateLimitError
      ? { 'Retry-After': String(error.retryAfterSeconds) }
      : NO_HEADERS;
  return { status: error.status, body, headers };
}

/**
 * Maps any thrown value to a sanitised {@link ApiResult}. Known
 * {@link DomainError}s map to their status and code; everything else becomes a
 * generic HTTP 500 with no internal detail.
 */
export function errorResult(error: unknown): ApiResult {
  if (error instanceof DomainError) {
    return domainErrorResult(error);
  }
  return {
    status: HTTP_INTERNAL_ERROR,
    body: { error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
    headers: NO_HEADERS,
  };
}

/** Executes a handler, converting any thrown error into a safe envelope. */
export async function runHandler(task: () => Promise<ApiResult> | ApiResult): Promise<ApiResult> {
  try {
    return await task();
  } catch (error) {
    return errorResult(error);
  }
}

/** Reads and JSON-parses a request body, mapping parse failures to HTTP 422. */
export async function readJson(request: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Request body is not valid JSON.');
  }
}
