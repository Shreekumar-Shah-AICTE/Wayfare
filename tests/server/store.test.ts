import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '@/core/errors';
import { DEFAULT_CROWD_DATASET } from '@/core/seed-crowd';
import type { CrowdDataset } from '@/core/types';
import { getStore, resetStore } from '@/server/store';

function dataset(id: string): CrowdDataset {
  return { id, label: `label-${id}`, samples: [{ segment: 'a|b', minuteOfDay: 1, density: 0.2 }] };
}

describe('store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns a stable singleton until reset', () => {
    const first = getStore();
    expect(getStore()).toBe(first);
    resetStore();
    expect(getStore()).not.toBe(first);
  });

  it('memoises the built graph', () => {
    const store = getStore();
    expect(store.graph()).toBe(store.graph());
  });

  it('serves and caches the seeded crowd index and rejects unknown ids', () => {
    const store = getStore();
    const index = store.crowdIndex(DEFAULT_CROWD_DATASET.id);
    expect(store.crowdIndex(DEFAULT_CROWD_DATASET.id)).toBe(index);
    expect(() => store.crowdIndex('missing')).toThrow(NotFoundError);
  });

  it('registers datasets and lists summaries', () => {
    const store = getStore();
    store.register(dataset('x'));
    expect(store.summaries().some((summary) => summary.id === 'x')).toBe(true);
    expect(store.crowdIndex('x')).toBeDefined();
  });

  it('clears the cached index when a dataset is re-registered', () => {
    const store = getStore();
    const first = store.crowdIndex(DEFAULT_CROWD_DATASET.id);
    store.register(DEFAULT_CROWD_DATASET);
    expect(store.crowdIndex(DEFAULT_CROWD_DATASET.id)).not.toBe(first);
  });

  it('evicts the oldest datasets beyond capacity', () => {
    const store = getStore();
    for (let index = 0; index < 40; index += 1) {
      store.register(dataset(`d${index}`));
    }
    expect(store.summaries().length).toBeLessThanOrEqual(32);
  });
});
