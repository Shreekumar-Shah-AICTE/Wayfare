/**
 * Seeded match-day crowd dataset (kickoff rush).
 *
 * Kept separate from the graph definition so each seed file stays small and
 * focused. Densities are deliberately shaped so the north concourse congests at
 * kickoff, forcing the router to find a calmer detour — the demo's wow moment.
 */

import { segmentKey } from './graph';
import { SEED_TIMES } from './stadium';
import type { CrowdDataset } from './types';

interface RawCrowdSample {
  readonly from: string;
  readonly to: string;
  readonly minute: number;
  readonly density: number;
}

const RAW_CROWD: readonly RawCrowdSample[] = [
  { from: 'gate-n', to: 'lc-n', minute: SEED_TIMES.early, density: 0.45 },
  { from: 'gate-n', to: 'lc-n', minute: SEED_TIMES.kickoff, density: 0.82 },
  { from: 'gate-n', to: 'lc-n', minute: SEED_TIMES.late, density: 0.5 },
  { from: 'lc-n', to: 'lc-ne', minute: SEED_TIMES.early, density: 0.5 },
  { from: 'lc-n', to: 'lc-ne', minute: SEED_TIMES.kickoff, density: 0.9 },
  { from: 'lc-n', to: 'lc-ne', minute: SEED_TIMES.late, density: 0.6 },
  { from: 'lc-ne', to: 'lc-e', minute: SEED_TIMES.early, density: 0.4 },
  { from: 'lc-ne', to: 'lc-e', minute: SEED_TIMES.kickoff, density: 0.86 },
  { from: 'lc-ne', to: 'lc-e', minute: SEED_TIMES.late, density: 0.55 },
  { from: 'lc-e', to: 'lc-se', minute: SEED_TIMES.kickoff, density: 0.72 },
  { from: 'lc-nw', to: 'lc-n', minute: SEED_TIMES.kickoff, density: 0.2 },
  { from: 'lc-w', to: 'lc-nw', minute: SEED_TIMES.kickoff, density: 0.18 },
  { from: 'uc-n', to: 'uc-e', minute: SEED_TIMES.kickoff, density: 0.15 },
  { from: 'uc-e', to: 'uc-s', minute: SEED_TIMES.kickoff, density: 0.12 },
  { from: 'lc-e', to: 'uc-e', minute: SEED_TIMES.kickoff, density: 0.3 },
  { from: 'lc-w', to: 'uc-w', minute: SEED_TIMES.kickoff, density: 0.1 },
];

export const DEFAULT_CROWD_DATASET: CrowdDataset = {
  id: 'seed-matchday',
  label: 'Seeded match-day crowd (kickoff rush)',
  samples: RAW_CROWD.map((sample) => ({
    segment: segmentKey(sample.from, sample.to),
    minuteOfDay: sample.minute,
    density: sample.density,
  })),
};
