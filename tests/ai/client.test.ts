import { afterEach, describe, expect, it } from 'vitest';

import { createGeminiClient, getGenerationClient, type FetchLike } from '@/ai/client';

const signal = new AbortController().signal;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const validPayload = {
  candidates: [{ content: { parts: [{ text: 'Turn left, then arrive.' }] } }],
};

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe('createGeminiClient', () => {
  it('returns the generated text on success', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse(validPayload);
    const client = createGeminiClient('key', 'gemini-1.5-flash', fetchImpl);
    expect(await client.generate('prompt', signal)).toBe('Turn left, then arrive.');
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({}, 500);
    const client = createGeminiClient('key', 'm', fetchImpl);
    await expect(client.generate('prompt', signal)).rejects.toThrow('status 500');
  });

  it('throws on a malformed response body', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ candidates: [] });
    const client = createGeminiClient('key', 'm', fetchImpl);
    await expect(client.generate('prompt', signal)).rejects.toThrow('Malformed');
  });
});

describe('getGenerationClient', () => {
  it('returns null when no API key is configured', () => {
    expect(getGenerationClient()).toBeNull();
  });

  it('returns a client when a key is present (default model)', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(getGenerationClient()).not.toBeNull();
  });

  it('honours an explicit model override', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    expect(getGenerationClient()).not.toBeNull();
  });
});
