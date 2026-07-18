import { describe, expect, it } from 'vitest';

import { buildCrowdIndex, crowdLevelFor } from '@/core/crowd';
import { classifyTurn } from '@/core/geometry';
import { buildGraph } from '@/core/graph';
import { findRoute, segmentWeight } from '@/core/routing';
import { generateSteps } from '@/core/steps';
import type { CrowdDataset, StadiumEdge, StadiumGraphData } from '@/core/types';

/**
 * Exact-value assertions that pin the arithmetic of the routing core. These
 * intentionally lock constants and formulae so a mutation to any of them is
 * detected (mutation testing), not merely executed.
 */

const level: StadiumEdge = {
  from: 'a',
  to: 'b',
  distanceMeters: 10,
  mode: 'level',
  widthMeters: 3,
  bidirectional: true,
};

const emptyIndex = buildCrowdIndex({ id: 'e', label: 'e', samples: [] });

function edgeGraph(
  edges: StadiumGraphData['edges'],
  extraNodes: StadiumGraphData['nodes'] = [],
): StadiumGraphData {
  return {
    nodes: [
      { id: 'a', label: 'A', kind: 'gate', x: 0, y: 0 },
      { id: 'b', label: 'B', kind: 'concourse', x: 10, y: 0 },
      { id: 'c', label: 'C', kind: 'seat', x: 30, y: 0 },
      ...extraNodes,
    ],
    edges,
  };
}

describe('segmentWeight arithmetic', () => {
  it('pins mode multipliers and the crowd-cost formula', () => {
    expect(segmentWeight(level, 'standard', 0)).toBe(10);
    expect(segmentWeight(level, 'standard', 0.5)).toBe(25); // 10 * (1 + 3 * 0.5)
    expect(segmentWeight({ ...level, mode: 'ramp' }, 'standard', 0)).toBeCloseTo(11);
    expect(segmentWeight({ ...level, mode: 'elevator' }, 'standard', 0)).toBeCloseTo(14);
    expect(segmentWeight({ ...level, mode: 'escalator' }, 'standard', 0)).toBeCloseTo(11);
    expect(segmentWeight(level, 'lowSensory', 0.5)).toBeCloseTo(43); // 10 * (1 + 3 * 2.2 * 0.5)
    expect(segmentWeight({ ...level, mode: 'elevator' }, 'wheelchair', 0)).toBeCloseTo(11.5);
    expect(segmentWeight({ ...level, mode: 'ramp' }, 'stepFree', 0)).toBeCloseTo(10.5);
  });

  it('treats the minimum wheelchair width as feasible and just under as not', () => {
    expect(segmentWeight({ ...level, widthMeters: 1.2 }, 'wheelchair', 0)).toBe(10);
    expect(segmentWeight({ ...level, widthMeters: 1.19 }, 'wheelchair', 0)).toBe(Infinity);
  });
});

describe('findRoute totals', () => {
  it('computes exact distance, cost, time, and density for one segment', () => {
    const route = findRoute(
      buildGraph(
        edgeGraph([
          {
            from: 'a',
            to: 'b',
            distanceMeters: 12,
            mode: 'level',
            widthMeters: 3,
            bidirectional: true,
          },
        ]),
      ),
      emptyIndex,
      { originId: 'a', destinationId: 'b', profile: 'standard', minuteOfDay: 0 },
    );
    expect(route.totalDistanceMeters).toBe(12);
    expect(route.totalCost).toBe(12);
    expect(route.estimatedMinutes).toBe(0.2); // round(12/80 * 10) / 10
    expect(route.maxDensity).toBe(0);
    expect(route.segments[0]?.cost).toBe(12);
  });

  it('sums two segments and captures the busiest density', () => {
    const graph = buildGraph(
      edgeGraph([
        {
          from: 'a',
          to: 'b',
          distanceMeters: 12,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
        {
          from: 'b',
          to: 'c',
          distanceMeters: 20,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
      ]),
    );
    const crowd = buildCrowdIndex({
      id: 'j',
      label: 'j',
      samples: [{ segment: 'b|c', minuteOfDay: 0, density: 0.5 }],
    });
    const route = findRoute(graph, crowd, {
      originId: 'a',
      destinationId: 'c',
      profile: 'standard',
      minuteOfDay: 0,
    });
    expect(route.totalDistanceMeters).toBe(32);
    expect(route.totalCost).toBe(62); // 12 + 20 * 2.5
    expect(route.maxDensity).toBe(0.5);
    expect(route.estimatedMinutes).toBe(0.5);
  });
});

describe('generateSteps fixed fields', () => {
  it('pins the arrive step fields', () => {
    const graph = buildGraph(
      edgeGraph([
        {
          from: 'a',
          to: 'b',
          distanceMeters: 10,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
      ]),
    );
    const route = findRoute(graph, emptyIndex, {
      originId: 'a',
      destinationId: 'b',
      profile: 'standard',
      minuteOfDay: 0,
    });
    const steps = generateSteps(graph, route);
    const arrive = steps.at(-1);
    expect(arrive?.kind).toBe('arrive');
    expect(arrive?.mode).toBe('level');
    expect(arrive?.turn).toBe('straight');
    expect(arrive?.distanceMeters).toBe(0);
    expect(arrive?.crowdLevel).toBe('calm');
    expect(steps[0]?.distanceMeters).toBe(10);
  });
});

describe('crowdLevelFor thresholds', () => {
  it('pins each threshold boundary', () => {
    expect(crowdLevelFor(0.24)).toBe('calm');
    expect(crowdLevelFor(0.25)).toBe('moderate');
    expect(crowdLevelFor(0.49)).toBe('moderate');
    expect(crowdLevelFor(0.5)).toBe('busy');
    expect(crowdLevelFor(0.74)).toBe('busy');
    expect(crowdLevelFor(0.75)).toBe('congested');
  });
});

describe('crowd interpolation and smoothing', () => {
  const dataset: CrowdDataset = {
    id: 'peak',
    label: 'peak',
    samples: [
      { segment: 'p|q', minuteOfDay: 10, density: 0 },
      { segment: 'p|q', minuteOfDay: 20, density: 0 },
      { segment: 'p|q', minuteOfDay: 30, density: 1 },
      { segment: 'p|q', minuteOfDay: 40, density: 0 },
      { segment: 'p|q', minuteOfDay: 50, density: 0 },
    ],
  };
  const index = buildCrowdIndex(dataset);

  it('smooths the peak with a 3-wide moving average', () => {
    expect(index.densityAt('p|q', 30)).toBeCloseTo(1 / 3, 5); // (0 + 1 + 0) / 3
  });

  it('interpolates linearly between smoothed samples', () => {
    // Between minute 20 (smoothed 1/3) and 30 (smoothed 1/3) is flat 1/3;
    // between 10 (0) and 20 (1/3) at minute 12 -> (2/10) * (1/3).
    expect(index.densityAt('p|q', 12)).toBeCloseTo((2 / 10) * (1 / 3), 5);
  });

  it('clamps to the endpoints outside the sample range', () => {
    expect(index.densityAt('p|q', 5)).toBe(0);
    expect(index.densityAt('p|q', 99)).toBe(0);
  });
});

describe('graph reverse edges', () => {
  it('copies edge attributes onto the reverse direction', () => {
    const graph = buildGraph(
      edgeGraph([
        {
          from: 'a',
          to: 'b',
          distanceMeters: 10,
          mode: 'ramp',
          widthMeters: 2.5,
          bidirectional: true,
        },
      ]),
    );
    const reverse = graph.neighbors('b')[0];
    expect(reverse?.to).toBe('a');
    expect(reverse?.distanceMeters).toBe(10);
    expect(reverse?.mode).toBe('ramp');
    expect(reverse?.widthMeters).toBe(2.5);
  });
});

describe('classifyTurn boundaries', () => {
  it('pins the straight and sharp angle thresholds', () => {
    expect(classifyTurn(20)).toBe('straight');
    expect(classifyTurn(20.1)).toBe('left');
    expect(classifyTurn(-20.1)).toBe('right');
    expect(classifyTurn(114.9)).toBe('left');
    expect(classifyTurn(115)).toBe('sharp-left');
    expect(classifyTurn(-115)).toBe('sharp-right');
  });
});
