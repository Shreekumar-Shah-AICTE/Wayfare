/**
 * Typed error hierarchy for the routing core.
 *
 * Handlers translate these into sanitised HTTP envelopes (see
 * `src/server/respond.ts`). Throwing a typed error — never a bare string — is
 * what lets the API map failures to the correct status code without leaking a
 * stack trace to the client.
 */

/** Base class carrying a stable machine-readable `code` and HTTP `status`. */
export abstract class DomainError extends Error {
  /** Stable, non-localised identifier safe to expose to clients. */
  public abstract readonly code: string;
  /** HTTP status this error maps to. */
  public abstract readonly status: number;

  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input failed schema or semantic validation (maps to HTTP 422). */
export class ValidationError extends DomainError {
  public readonly code = 'validation_error';
  public readonly status = 422;

  /** Field-level messages keyed by dotted path, for actionable client errors. */
  public readonly details: readonly string[];

  public constructor(message: string, details: readonly string[] = []) {
    super(message);
    this.details = details;
  }
}

/** A referenced entity (node id, dataset id) does not exist (maps to HTTP 404). */
export class NotFoundError extends DomainError {
  public readonly code = 'not_found';
  public readonly status = 404;
}

/** No feasible path exists for the requested profile (maps to HTTP 409). */
export class NoRouteError extends DomainError {
  public readonly code = 'no_route';
  public readonly status = 409;
}

/** The caller exceeded the per-window request budget (maps to HTTP 429). */
export class RateLimitError extends DomainError {
  public readonly code = 'rate_limited';
  public readonly status = 429;

  /** Seconds the client should wait before retrying. */
  public readonly retryAfterSeconds: number;

  public constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
