import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError, ValidationError } from '@/core/errors';
import {
  ingestCsvHandler,
  ingestJsonHandler,
  metadataHandler,
  narrateHandler,
  planRouteHandler,
} from '@/server/handlers';
import { resetStore } from '@/server/store';

interface RouteBody {
  readonly datasetId: string;
  readonly route: { readonly nodeIds: readonly string[] };
  readonly steps: readonly unknown[];
  readonly heat: readonly unknown[];
}

interface UploadBody {
  readonly id: string;
  readonly label: string;
  readonly sampleCount: number;
}

const CSV = 'from,to,minute,density\ngate-n,lc-n,600,0.5';

beforeEach(() => {
  resetStore();
  delete process.env.GEMINI_API_KEY;
});

describe('planRouteHandler', () => {
  it('computes a route with heat and steps against the seeded dataset', () => {
    const result = planRouteHandler({
      originId: 'gate-n',
      destinationId: 'seat-101',
      profile: 'standard',
      minuteOfDay: 600,
    });
    const body = result.body as RouteBody;
    expect(result.status).toBe(200);
    expect(body.datasetId).toBe('seed-matchday');
    expect(body.route.nodeIds[0]).toBe('gate-n');
    expect(body.heat.length).toBeGreaterThan(0);
    expect(body.steps.length).toBeGreaterThan(0);
  });

  it('rejects an invalid request body', () => {
    expect(() => planRouteHandler({})).toThrow(ValidationError);
  });

  it('throws when the dataset id is unknown', () => {
    expect(() =>
      planRouteHandler({
        originId: 'gate-n',
        destinationId: 'seat-101',
        profile: 'standard',
        minuteOfDay: 600,
        datasetId: 'missing',
      }),
    ).toThrow(NotFoundError);
  });
});

describe('ingest handlers', () => {
  it('registers an uploaded CSV and makes it routable', () => {
    const result = ingestCsvHandler(CSV, 'My rush');
    const body = result.body as UploadBody;
    expect(result.status).toBe(201);
    expect(body.sampleCount).toBe(1);
    expect(body.label).toBe('My rush');
    const routed = planRouteHandler({
      originId: 'gate-n',
      destinationId: 'lc-n',
      profile: 'standard',
      minuteOfDay: 600,
      datasetId: body.id,
    });
    expect(routed.status).toBe(200);
  });

  it('defaults a blank label and truncates a very long one', () => {
    expect((ingestCsvHandler(CSV, '   ').body as UploadBody).label).toBe('Uploaded crowd data');
    expect((ingestCsvHandler(CSV, 'x'.repeat(200)).body as UploadBody).label).toHaveLength(120);
  });

  it('registers an uploaded JSON payload', () => {
    const result = ingestJsonHandler(
      { samples: [{ from: 'a', to: 'b', minute: 10, density: 0.2 }] },
      'JSON set',
    );
    expect(result.status).toBe(201);
    expect((result.body as UploadBody).sampleCount).toBe(1);
  });
});

describe('metadataHandler', () => {
  it('returns the graph, datasets, locales, and profiles', () => {
    const body = metadataHandler().body as {
      graph: { nodes: unknown[] };
      locales: string[];
      profiles: string[];
    };
    expect(body.graph.nodes).toHaveLength(25);
    expect(body.locales).toContain('ar');
    expect(body.profiles).toContain('wheelchair');
  });
});

describe('narrateHandler', () => {
  it('narrates via the deterministic fallback and flags RTL locales', async () => {
    const result = await narrateHandler({
      originId: 'gate-n',
      destinationId: 'seat-101',
      profile: 'standard',
      minuteOfDay: 600,
      locale: 'ar',
    });
    const body = result.body as { narration: { source: string }; rtl: boolean };
    expect(body.narration.source).toBe('fallback');
    expect(body.rtl).toBe(true);
  });

  it('marks left-to-right locales as not RTL', async () => {
    const result = await narrateHandler({
      originId: 'gate-n',
      destinationId: 'seat-101',
      profile: 'standard',
      minuteOfDay: 600,
      locale: 'en',
    });
    expect((result.body as { rtl: boolean }).rtl).toBe(false);
  });

  it('rejects an invalid narration request', async () => {
    await expect(narrateHandler({})).rejects.toBeInstanceOf(ValidationError);
  });
});
