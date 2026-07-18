import { describe, expect, it } from 'vitest';

import { NotFoundError, RateLimitError, ValidationError } from '@/core/errors';
import { errorResult, readJson, runHandler, success } from '@/server/respond';

interface ErrorShape {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly string[];
  };
}

describe('success', () => {
  it('defaults to 200 and honours an explicit status', () => {
    expect(success({ a: 1 }).status).toBe(200);
    expect(success({}, 201).status).toBe(201);
  });
});

describe('errorResult', () => {
  it('maps a ValidationError with details', () => {
    const result = errorResult(new ValidationError('bad', ['name: required']));
    expect(result.status).toBe(422);
    expect((result.body as ErrorShape).error.details).toEqual(['name: required']);
  });

  it('omits details when a ValidationError has none', () => {
    const result = errorResult(new ValidationError('bad'));
    expect((result.body as ErrorShape).error.details).toBeUndefined();
  });

  it('maps a NotFoundError to 404', () => {
    expect(errorResult(new NotFoundError('x')).status).toBe(404);
  });

  it('adds a Retry-After header for a RateLimitError', () => {
    const result = errorResult(new RateLimitError('slow', 12));
    expect(result.status).toBe(429);
    expect(result.headers['Retry-After']).toBe('12');
  });

  it('maps an unknown error to a sanitised 500', () => {
    const result = errorResult(new Error('boom with secret stack'));
    expect(result.status).toBe(500);
    expect((result.body as ErrorShape).error.code).toBe('internal_error');
    expect((result.body as ErrorShape).error.message).not.toContain('secret');
  });
});

describe('runHandler', () => {
  it('returns the handler result', async () => {
    const result = await runHandler(() => success('ok'));
    expect(result.body).toBe('ok');
  });

  it('catches thrown errors into an envelope', async () => {
    const result = await runHandler(() => {
      throw new NotFoundError('missing');
    });
    expect(result.status).toBe(404);
  });
});

describe('readJson', () => {
  it('parses a valid body', async () => {
    expect(await readJson({ json: async () => ({ a: 1 }) })).toEqual({ a: 1 });
  });

  it('maps invalid JSON to a ValidationError', async () => {
    await expect(
      readJson({
        json: async () => {
          throw new Error('bad json');
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
