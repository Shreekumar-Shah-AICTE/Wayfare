/**
 * Shared `zod` execution helpers.
 *
 * Centralising schema execution keeps a single, DRY path from "untrusted input"
 * to "typed value or {@link ValidationError}", reused by both the ingest layer
 * and the request handlers so there is no duplicated validation glue.
 */

import type { z } from 'zod';

import { ValidationError } from './errors';

/** Flattens Zod issues into human-readable `path: message` strings. */
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

/**
 * Parses `input` with `schema`, throwing a {@link ValidationError} (never a raw
 * `ZodError`) carrying field-level details when validation fails.
 */
export function runSchema<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(message, formatIssues(result.error));
  }
  return result.data;
}
