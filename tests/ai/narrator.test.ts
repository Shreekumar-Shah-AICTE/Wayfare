import { describe, expect, it } from 'vitest';

import type { GenerationClient } from '@/ai/client';
import { fallbackNarration, narrateRoute } from '@/ai/narrator';
import type { NavigationStep } from '@/core/types';

const steps: readonly NavigationStep[] = [
  {
    index: 0,
    kind: 'depart',
    fromLabel: 'Gate',
    toLabel: 'Hall',
    mode: 'level',
    distanceMeters: 10,
    crowdLevel: 'calm',
    turn: 'straight',
    note: null,
  },
  {
    index: 1,
    kind: 'continue',
    fromLabel: 'Hall',
    toLabel: 'Bend',
    mode: 'level',
    distanceMeters: 5,
    crowdLevel: 'calm',
    turn: 'straight',
    note: null,
  },
  {
    index: 2,
    kind: 'turn',
    fromLabel: 'Bend',
    toLabel: 'Ramp',
    mode: 'level',
    distanceMeters: 6,
    crowdLevel: 'busy',
    turn: 'left',
    note: 'Busy corridor',
  },
  {
    index: 3,
    kind: 'transition',
    fromLabel: 'Ramp',
    toLabel: 'Upper',
    mode: 'elevator',
    distanceMeters: 8,
    crowdLevel: 'calm',
    turn: 'straight',
    note: 'Step-free',
  },
  {
    index: 4,
    kind: 'arrive',
    fromLabel: 'Seat',
    toLabel: 'Seat',
    mode: 'level',
    distanceMeters: 0,
    crowdLevel: 'calm',
    turn: 'straight',
    note: null,
  },
];

const noSleep = async (): Promise<void> => {};

describe('fallbackNarration', () => {
  it('describes every step kind deterministically', () => {
    const text = fallbackNarration(steps);
    expect(text).toContain('Start at Gate');
    expect(text).toContain('Continue to Bend');
    expect(text).toContain('Turn left toward Ramp');
    expect(text).toContain('Take the elevator to Upper');
    expect(text).toContain('Arrive at Seat');
  });

  it('handles an empty step list', () => {
    expect(fallbackNarration([])).toContain('already at your destination');
  });
});

describe('narrateRoute', () => {
  it('falls back to deterministic narration when no client is available', async () => {
    const result = await narrateRoute(steps, 'en', { client: null });
    expect(result.source).toBe('fallback');
    expect(result.text).toContain('Start at Gate');
  });

  it('uses the model when it returns text', async () => {
    const client: GenerationClient = { generate: async () => 'Sigue recto y llega.' };
    const result = await narrateRoute(steps, 'es', { client, sleep: noSleep });
    expect(result.source).toBe('model');
    expect(result.text).toBe('Sigue recto y llega.');
    expect(result.locale).toBe('es');
  });

  it('falls back when the model returns only whitespace', async () => {
    const client: GenerationClient = { generate: async () => '   ' };
    const result = await narrateRoute(steps, 'en', { client, sleep: noSleep });
    expect(result.source).toBe('fallback');
  });

  it('falls back when the model throws', async () => {
    const client: GenerationClient = {
      generate: async () => {
        throw new Error('upstream down');
      },
    };
    const result = await narrateRoute(steps, 'en', { client, sleep: noSleep });
    expect(result.source).toBe('fallback');
  });
});
