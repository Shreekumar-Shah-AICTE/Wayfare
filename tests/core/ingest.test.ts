import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors';
import { parseCrowdCsv, parseCrowdJson, parseGraph } from '@/core/ingest';
import { DEFAULT_STADIUM } from '@/core/stadium';
import type { StadiumGraphData } from '@/core/types';

const VALID_CSV = 'from,to,minute,density\ngate-n,lc-n,600,0.5\nlc-n,lc-ne,600,0.8';

describe('parseGraph', () => {
  it('accepts the seeded stadium', () => {
    expect(parseGraph(DEFAULT_STADIUM).nodes).toHaveLength(25);
  });

  it('rejects unknown fields (strict schema)', () => {
    const bad = { ...DEFAULT_STADIUM, extra: true };
    expect(() => parseGraph(bad)).toThrow(ValidationError);
  });

  it('rejects duplicate node ids', () => {
    const data: StadiumGraphData = {
      nodes: [
        { id: 'a', label: 'A', kind: 'gate', x: 0, y: 0 },
        { id: 'a', label: 'A2', kind: 'seat', x: 1, y: 1 },
      ],
      edges: [
        {
          from: 'a',
          to: 'a',
          distanceMeters: 1,
          mode: 'level',
          widthMeters: 2,
          bidirectional: true,
        },
      ],
    };
    expect(() => parseGraph(data)).toThrow(ValidationError);
  });

  it('rejects self-loop edges', () => {
    const data: StadiumGraphData = {
      nodes: [
        { id: 'a', label: 'A', kind: 'gate', x: 0, y: 0 },
        { id: 'b', label: 'B', kind: 'seat', x: 1, y: 1 },
      ],
      edges: [
        {
          from: 'a',
          to: 'a',
          distanceMeters: 1,
          mode: 'level',
          widthMeters: 2,
          bidirectional: true,
        },
      ],
    };
    expect(() => parseGraph(data)).toThrow(ValidationError);
  });

  it('rejects a graph with too few nodes', () => {
    expect(() => parseGraph({ nodes: [], edges: [] })).toThrow(ValidationError);
  });
});

describe('parseCrowdCsv', () => {
  it('parses a valid CSV and computes segment keys', () => {
    const dataset = parseCrowdCsv(VALID_CSV, 'ds-1', 'Label');
    expect(dataset.id).toBe('ds-1');
    expect(dataset.samples).toHaveLength(2);
    expect(dataset.samples[0]?.segment).toBe('gate-n|lc-n');
  });

  it('rejects a wrong header name', () => {
    expect(() => parseCrowdCsv('a,b,c,d\n1,2,3,4', 'i', 'l')).toThrow(ValidationError);
  });

  it('rejects a header with the wrong column count', () => {
    expect(() => parseCrowdCsv('from,to,minute\ngate-n,lc-n,600', 'i', 'l')).toThrow(
      ValidationError,
    );
  });

  it('rejects an empty document', () => {
    expect(() => parseCrowdCsv('', 'i', 'l')).toThrow(ValidationError);
  });

  it('rejects a header with no data rows', () => {
    expect(() => parseCrowdCsv('from,to,minute,density\n', 'i', 'l')).toThrow(ValidationError);
  });

  it('rejects a row with the wrong column count', () => {
    expect(() => parseCrowdCsv('from,to,minute,density\ngate-n,lc-n,600', 'i', 'l')).toThrow(
      ValidationError,
    );
  });

  it('rejects a non-numeric cell', () => {
    expect(() => parseCrowdCsv('from,to,minute,density\ngate-n,lc-n,soon,0.5', 'i', 'l')).toThrow(
      ValidationError,
    );
  });

  it('rejects an out-of-range density', () => {
    expect(() => parseCrowdCsv('from,to,minute,density\ngate-n,lc-n,600,5', 'i', 'l')).toThrow(
      ValidationError,
    );
  });
});

describe('parseCrowdJson', () => {
  it('parses a valid payload and uses its label', () => {
    const dataset = parseCrowdJson(
      { label: 'Evening', samples: [{ from: 'a', to: 'b', minute: 10, density: 0.3 }] },
      'ds-2',
      'fallback',
    );
    expect(dataset.label).toBe('Evening');
    expect(dataset.samples[0]?.segment).toBe('a|b');
    expect(dataset.samples[0]?.minuteOfDay).toBe(10);
  });

  it('falls back to the provided label when none is supplied', () => {
    const dataset = parseCrowdJson(
      { samples: [{ from: 'a', to: 'b', minute: 10, density: 0.3 }] },
      'ds-3',
      'fallback',
    );
    expect(dataset.label).toBe('fallback');
  });

  it('rejects unknown fields', () => {
    expect(() => parseCrowdJson({ samples: [], oops: 1 }, 'ds', 'fallback')).toThrow(
      ValidationError,
    );
  });
});
