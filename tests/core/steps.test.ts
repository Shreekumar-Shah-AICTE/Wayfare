import { describe, expect, it } from 'vitest';

import { buildCrowdIndex } from '@/core/crowd';
import { buildGraph } from '@/core/graph';
import { findRoute } from '@/core/routing';
import { generateSteps } from '@/core/steps';
import type { CrowdSample, EdgeMode, NavigationStep, StadiumGraphData } from '@/core/types';

function lineGraph(cx: number, cy: number, mode: EdgeMode): StadiumGraphData {
  return {
    nodes: [
      { id: 'a', label: 'A', kind: 'gate', x: 0, y: 0 },
      { id: 'b', label: 'B', kind: 'concourse', x: 10, y: 0 },
      { id: 'c', label: 'C', kind: 'seat', x: cx, y: cy },
    ],
    edges: [
      {
        from: 'a',
        to: 'b',
        distanceMeters: 10,
        mode: 'level',
        widthMeters: 3,
        bidirectional: true,
      },
      { from: 'b', to: 'c', distanceMeters: 10, mode, widthMeters: 3, bidirectional: true },
    ],
  };
}

function stepsFor(
  graphData: StadiumGraphData,
  samples: readonly CrowdSample[],
  destinationId: string,
): NavigationStep[] {
  const graph = buildGraph(graphData);
  const crowd = buildCrowdIndex({ id: 'x', label: 'x', samples });
  const route = findRoute(graph, crowd, {
    originId: 'a',
    destinationId,
    profile: 'standard',
    minuteOfDay: 0,
  });
  return generateSteps(graph, route);
}

describe('generateSteps', () => {
  it('returns an empty list for a zero-length route', () => {
    const graph = buildGraph(lineGraph(20, 0, 'level'));
    const crowd = buildCrowdIndex({ id: 'x', label: 'x', samples: [] });
    const route = findRoute(graph, crowd, {
      originId: 'a',
      destinationId: 'a',
      profile: 'standard',
      minuteOfDay: 0,
    });
    expect(generateSteps(graph, route)).toEqual([]);
  });

  it('opens with depart and closes with arrive, flagging congestion', () => {
    const steps = stepsFor(
      lineGraph(20, 0, 'level'),
      [{ segment: 'a|b', minuteOfDay: 0, density: 0.9 }],
      'c',
    );
    expect(steps[0]?.kind).toBe('depart');
    expect(steps[0]?.crowdLevel).toBe('congested');
    expect(steps[0]?.note).toContain('crowding');
    expect(steps.at(-1)?.kind).toBe('arrive');
  });

  it('emits a continue step with a busy-corridor note when going straight', () => {
    const steps = stepsFor(
      lineGraph(20, 0, 'level'),
      [{ segment: 'b|c', minuteOfDay: 0, density: 0.6 }],
      'c',
    );
    const middle = steps[1];
    expect(middle?.kind).toBe('continue');
    expect(middle?.note).toContain('Busy');
  });

  it('emits a turn step with no note on a calm bend', () => {
    const steps = stepsFor(lineGraph(10, 10, 'level'), [], 'c');
    const middle = steps[1];
    expect(middle?.kind).toBe('turn');
    expect(middle?.note).toBeNull();
  });

  it('emits a transition step with a step-free note for an elevator', () => {
    const steps = stepsFor(lineGraph(20, 0, 'elevator'), [], 'c');
    const middle = steps[1];
    expect(middle?.kind).toBe('transition');
    expect(middle?.mode).toBe('elevator');
    expect(middle?.note).toContain('elevator');
  });
});
