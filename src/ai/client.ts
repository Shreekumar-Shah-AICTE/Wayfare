/**
 * Thin, typed client for the Google Gemini generateContent REST endpoint.
 *
 * There is exactly one place in the codebase that talks to the model, and it
 * only ever *phrases* text — it is never asked to make a decision. The response
 * shape is validated with `zod` so a malformed or hostile payload becomes a
 * thrown error (handled by the narrator's fallback), never an unchecked access.
 */

import { z } from 'zod';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_OUTPUT_TOKENS = 512;
const TEMPERATURE = 0.4;
const DEFAULT_MODEL = 'gemini-1.5-flash';

/** Minimal `fetch` signature the client depends on (injectable for tests). */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Something that can turn a prompt into a single text completion. */
export interface GenerationClient {
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })).nonempty(),
        }),
      }),
    )
    .nonempty(),
});

function extractText(payload: unknown): string {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Malformed generation response.');
  }
  return parsed.data.candidates[0].content.parts[0].text;
}

/**
 * Creates a {@link GenerationClient} bound to an API key, model, and `fetch`
 * implementation. Throws on any non-2xx response so callers can fall back.
 */
export function createGeminiClient(
  apiKey: string,
  model: string,
  fetchImpl: FetchLike,
): GenerationClient {
  const endpoint = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return {
    async generate(prompt: string, signal: AbortSignal): Promise<string> {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE },
        }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Generation request failed with status ${response.status}.`);
      }
      return extractText((await response.json()) as unknown);
    },
  };
}

/**
 * Builds the configured client from environment variables, or returns `null`
 * when no API key is present — the signal that the app should narrate offline
 * using its deterministic fallback.
 */
export function getGenerationClient(): GenerationClient | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    return null;
  }
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  return createGeminiClient(apiKey, model, fetch);
}
