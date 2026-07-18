/**
 * Process-wide singleton holding the stadium graph and uploaded crowd datasets.
 *
 * The graph is indexed exactly once (an `O(V + E)` cost amortised across every
 * request) and each crowd index is memoised per dataset, so repeated route
 * queries never rebuild them — an efficiency requirement. The seeded match-day
 * dataset is registered at construction so the app is fully functional before
 * any upload.
 */

import { buildCrowdIndex, type CrowdIndex } from '@/core/crowd';
import { NotFoundError } from '@/core/errors';
import { buildGraph, type StadiumGraph } from '@/core/graph';
import { parseGraph } from '@/core/ingest';
import { DEFAULT_CROWD_DATASET } from '@/core/seed-crowd';
import { DEFAULT_STADIUM } from '@/core/stadium';
import type { CrowdDataset } from '@/core/types';

/** Maximum uploaded datasets retained before the oldest is evicted. */
const MAX_DATASETS = 32;

/** A compact description of a stored crowd dataset for listing in the UI. */
export interface DatasetSummary {
  readonly id: string;
  readonly label: string;
  readonly sampleCount: number;
}

/** The public surface of the data store. */
export interface Store {
  graph(): StadiumGraph;
  register(dataset: CrowdDataset): void;
  crowdIndex(datasetId: string): CrowdIndex;
  summaries(): DatasetSummary[];
}

class WayfareStore implements Store {
  private graphCache: StadiumGraph | undefined;
  private readonly datasets = new Map<string, CrowdDataset>();
  private readonly indexCache = new Map<string, CrowdIndex>();

  public constructor() {
    this.register(DEFAULT_CROWD_DATASET);
  }

  public graph(): StadiumGraph {
    if (this.graphCache === undefined) {
      this.graphCache = buildGraph(parseGraph(DEFAULT_STADIUM));
    }
    return this.graphCache;
  }

  public register(dataset: CrowdDataset): void {
    this.datasets.set(dataset.id, dataset);
    this.indexCache.delete(dataset.id);
    this.evictOldest();
  }

  public crowdIndex(datasetId: string): CrowdIndex {
    const cached = this.indexCache.get(datasetId);
    if (cached !== undefined) {
      return cached;
    }
    const dataset = this.datasets.get(datasetId);
    if (dataset === undefined) {
      throw new NotFoundError(`Unknown crowd dataset "${datasetId}".`);
    }
    const index = buildCrowdIndex(dataset);
    this.indexCache.set(datasetId, index);
    return index;
  }

  public summaries(): DatasetSummary[] {
    return [...this.datasets.values()].map((dataset) => ({
      id: dataset.id,
      label: dataset.label,
      sampleCount: dataset.samples.length,
    }));
  }

  private evictOldest(): void {
    while (this.datasets.size > MAX_DATASETS) {
      // Invariant: size > MAX_DATASETS >= 0, so at least one key exists.
      const oldest = this.datasets.keys().next().value as string;
      this.datasets.delete(oldest);
      this.indexCache.delete(oldest);
    }
  }
}

let singleton: Store | undefined;

/** Returns the process-wide store, constructing it on first use. */
export function getStore(): Store {
  if (singleton === undefined) {
    singleton = new WayfareStore();
  }
  return singleton;
}

/** Resets the singleton. Intended for test isolation only. */
export function resetStore(): void {
  singleton = undefined;
}
