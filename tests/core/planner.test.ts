import { describe, expect, it } from 'vitest';

import { buildCrowdIndex } from '@/core/crowd';
import { buildGraph } from '@/core/graph';
import { planJourney } from '@/core/planner';
import { DEFAULT_CROWD_DATASET } from '@/core/seed-crowd';
import { DEFAULT_STADIUM } from '@/core/stadium';

describe('planJourney', () => {
  it('returns a route and matching navigation steps', () => {
    const plan = planJourney(buildGraph(DEFAULT_STADIUM), buildCrowdIndex(DEFAULT_CROWD_DATASET), {
      originId: 'gate-n',
      destinationId: 'seat-115',
      profile: 'standard',
      minuteOfDay: 600,
    });
    expect(plan.route.nodeIds.length).toBeGreaterThan(1);
    expect(plan.steps[0]?.kind).toBe('depart');
    expect(plan.steps.at(-1)?.kind).toBe('arrive');
    // The step list describes the same endpoints as the route.
    expect(plan.steps.at(-1)?.toLabel).toBe('Section 115 (Lower)');
  });
});
