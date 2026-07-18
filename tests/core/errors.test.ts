import { describe, expect, it } from 'vitest';

import {
  DomainError,
  NoRouteError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@/core/errors';

describe('domain errors', () => {
  it('ValidationError carries code, status, details, and name', () => {
    const error = new ValidationError('bad', ['field: wrong']);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('validation_error');
    expect(error.status).toBe(422);
    expect(error.details).toEqual(['field: wrong']);
    expect(error.name).toBe('ValidationError');
  });

  it('ValidationError defaults details to an empty array', () => {
    expect(new ValidationError('bad').details).toEqual([]);
  });

  it('NotFoundError maps to 404', () => {
    const error = new NotFoundError('missing');
    expect(error.code).toBe('not_found');
    expect(error.status).toBe(404);
  });

  it('NoRouteError maps to 409', () => {
    const error = new NoRouteError('no path');
    expect(error.code).toBe('no_route');
    expect(error.status).toBe(409);
  });

  it('RateLimitError maps to 429 and carries a retry hint', () => {
    const error = new RateLimitError('slow down', 30);
    expect(error.code).toBe('rate_limited');
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
  });
});
