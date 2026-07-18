import { describe, expect, it } from 'vitest';

import { NotFoundError, ValidationError } from '@/core/errors';
import { parseCrowdCsv } from '@/core/ingest';
import { MAX_UPLOAD_CHARS } from '@/core/constants';
import { planRouteHandler } from '@/server/handlers';
import { resetStore } from '@/server/store';

const HEADER = 'from,to,minute,density';

describe('CSV parser edge cases', () => {
  it('parses quoted fields containing commas and escaped quotes', () => {
    const csv = `${HEADER}\n"ga,te","lc""n",600,0.5`;
    const dataset = parseCrowdCsv(csv, 'i', 'l');
    expect(dataset.samples).toHaveLength(1);
    expect(dataset.samples[0]?.segment).toContain('ga,te');
  });

  it('accepts a quoted header row', () => {
    const csv = `"from","to","minute","density"\ngate-n,lc-n,600,0.5`;
    expect(parseCrowdCsv(csv, 'i', 'l').samples).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    const csv = `${HEADER}\r\ngate-n,lc-n,600,0.5\r\n`;
    expect(parseCrowdCsv(csv, 'i', 'l').samples).toHaveLength(1);
  });

  it('rejects a document with an unterminated quote', () => {
    const csv = `"${HEADER}\ngate-n,lc-n,600,0.5`;
    expect(() => parseCrowdCsv(csv, 'i', 'l')).toThrow(ValidationError);
  });

  it('rejects an oversized upload before parsing', () => {
    expect(() => parseCrowdCsv('x'.repeat(MAX_UPLOAD_CHARS + 1), 'i', 'l')).toThrow(
      ValidationError,
    );
  });
});

describe('routing edge cases', () => {
  it('reports an unknown dataset as not found', () => {
    resetStore();
    expect(() =>
      planRouteHandler({
        originId: 'gate-n',
        destinationId: 'seat-101',
        profile: 'standard',
        minuteOfDay: 600,
        datasetId: 'does-not-exist',
      }),
    ).toThrow(NotFoundError);
  });
});
