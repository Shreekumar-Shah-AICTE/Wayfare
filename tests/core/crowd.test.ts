import { describe, expect, it } from 'vitest';

import { buildCrowdIndex, crowdLevelFor } from '@/core/crowd';
import type { CrowdDataset } from '@/core/types';

const flat: CrowdDataset = {
  id: 'flat',
  label: 'flat',
  samples: [
    { segment: 'a|b', minuteOfDay: 0, density: 0.2 },
    { segment: 'a|b', minuteOfDay: 50, density: 0.2 },
    { segment: 'a|b', minuteOfDay: 100, density: 0.2 },
  ],
};

const peak: CrowdDataset = {
  id: 'peak',
  label: 'peak',
  samples: [
    { segment: 'c|d', minuteOfDay: 0, density: 0 },
    { segment: 'c|d', minuteOfDay: 10, density: 1 },
    { segment: 'c|d', minuteOfDay: 20, density: 0 },
  ],
};

describe('crowdLevelFor', () => {
  it('buckets a continuous density into named levels', () => {
    expect(crowdLevelFor(0.1)).toBe('calm');
    expect(crowdLevelFor(0.3)).toBe('moderate');
    expect(crowdLevelFor(0.6)).toBe('busy');
    expect(crowdLevelFor(0.95)).toBe('congested');
  });
});

describe('buildCrowdIndex + densityAt', () => {
  it('returns zero density for an unknown segment', () => {
    const index = buildCrowdIndex(flat);
    expect(index.densityAt('nope|nope', 30)).toBe(0);
  });

  it('resolves before-first, exact, after-last, and interpolated lookups', () => {
    const index = buildCrowdIndex(flat);
    expect(index.densityAt('a|b', -10)).toBeCloseTo(0.2); // before first
    expect(index.densityAt('a|b', 50)).toBeCloseTo(0.2); // exact
    expect(index.densityAt('a|b', 200)).toBeCloseTo(0.2); // after last
    expect(index.densityAt('a|b', 25)).toBeCloseTo(0.2); // interpolated
  });

  it('smooths noisy peaks with a moving average', () => {
    const index = buildCrowdIndex(peak);
    // Middle sample averaged with both neighbours: (0 + 1 + 0) / 3.
    expect(index.densityAt('c|d', 10)).toBeCloseTo(1 / 3);
  });

  it('handles an empty dataset', () => {
    const index = buildCrowdIndex({ id: 'empty', label: 'empty', samples: [] });
    expect(index.densityAt('a|b', 10)).toBe(0);
  });
});
