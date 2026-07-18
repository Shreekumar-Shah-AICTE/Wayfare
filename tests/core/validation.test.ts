import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '@/core/errors';
import { runSchema } from '@/core/validation';

const schema = z.object({ name: z.string(), age: z.number() }).strict();

function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe('runSchema', () => {
  it('returns parsed data on success', () => {
    expect(runSchema(schema, { name: 'x', age: 1 }, 'm')).toEqual({ name: 'x', age: 1 });
  });

  it('throws a ValidationError with field paths on failure', () => {
    const error = capture(() => runSchema(schema, { age: 'no' }, 'bad'));
    expect(error).toBeInstanceOf(ValidationError);
    const details = (error as ValidationError).details;
    expect(details.some((detail) => detail.includes('name'))).toBe(true);
  });

  it('labels root-level issues as (root)', () => {
    const error = capture(() => runSchema(z.array(z.number()), 'nope', 'x'));
    expect((error as ValidationError).details[0]).toContain('(root)');
  });
});
