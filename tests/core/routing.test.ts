import { describe, expect, it } from 'vitest';

import { buildCrowdIndex } from '@/core/crowd';
import { NoRouteError, NotFoundError } from '@/core/errors';
import { buildGraph } from '@/core/graph';
import { findRoute, segmentWeight } from '@/core/routing';
import { DEFAULT_CROWD_DATASET } from '@/core/seed-crowd';
import { DEFAULT_STADIUM } from '@/core/stadium';
import type { CrowdDataset, StadiumEdge, StadiumGraphData } from '@/core/types';

const EMPTY_CROWD: CrowdDataset = { id: 'e', label: 'e', samples: [] };
const emptyIndex = buildCrowdIndex(EMPTY_CROWD);
const stadium = buildGraph(DEFAULT_STADIUM);

const levelEdge: StadiumEdge = {
  from: 'a',
  to: 'b',
  distanceMeters: 10,
  mode: 'level',
  widthMeters: 3,
  bidirectional: true,
};

describe('segmentWeight', () => {
  it('scales cost with crowd density for a feasible segment', () => {
    const calm = segmentWeight(levelEdge, 'standard', 0);
    const busy = segmentWeight(levelEdge, 'standard', 0.5);
    expect(calm).toBeCloseTo(10);
    expect(busy).toBeGreaterThan(calm);
  });

  it('marks stairs and escalators infeasible for wheelchair users', () => {
    expect(segmentWeight({ ...levelEdge, mode: 'stairs' }, 'wheelchair', 0)).toBe(Infinity);
    expect(segmentWeight({ ...levelEdge, mode: 'escalator' }, 'wheelchair', 0)).toBe(Infinity);
    expect(segmentWeight({ ...levelEdge, mode: 'stairs' }, 'stepFree', 0)).toBe(Infinity);
  });

  it('rejects corridors narrower than the wheelchair minimum width', () => {
    expect(segmentWeight({ ...levelEdge, widthMeters: 0.8 }, 'wheelchair', 0)).toBe(Infinity);
  });
});

describe('findRoute', () => {
  it('computes a standard route with positive distance and time', () => {
    const route = findRoute(stadium, emptyIndex, {
      originId: 'gate-n',
      destinationId: 'seat-101',
      profile: 'standard',
      minuteOfDay: 600,
    });
    expect(route.nodeIds[0]).toBe('gate-n');
    expect(route.nodeIds.at(-1)).toBe('seat-101');
    expect(route.totalDistanceMeters).toBeGreaterThan(0);
    expect(route.estimatedMinutes).toBeGreaterThan(0);
    expect(route.segments.length).toBeGreaterThan(0);
  });

  it('returns a trivial route when origin equals destination', () => {
    const route = findRoute(stadium, emptyIndex, {
      originId: 'gate-n',
      destinationId: 'gate-n',
      profile: 'standard',
      minuteOfDay: 600,
    });
    expect(route.nodeIds).toEqual(['gate-n']);
    expect(route.segments).toEqual([]);
    expect(route.estimatedMinutes).toBe(0);
    expect(route.maxDensity).toBe(0);
  });

  it('throws NotFoundError for an unknown node id', () => {
    expect(() =>
      findRoute(stadium, emptyIndex, {
        originId: 'nowhere',
        destinationId: 'gate-n',
        profile: 'standard',
        minuteOfDay: 600,
      }),
    ).toThrow(NotFoundError);
  });

  it('throws NoRouteError when no feasible path exists for the profile', () => {
    const stairsOnly: StadiumGraphData = {
      nodes: [
        { id: 'p', label: 'P', kind: 'gate', x: 0, y: 0 },
        { id: 'q', label: 'Q', kind: 'seat', x: 0, y: 10 },
      ],
      edges: [
        {
          from: 'p',
          to: 'q',
          distanceMeters: 8,
          mode: 'stairs',
          widthMeters: 2,
          bidirectional: true,
        },
      ],
    };
    expect(() =>
      findRoute(buildGraph(stairsOnly), emptyIndex, {
        originId: 'p',
        destinationId: 'q',
        profile: 'wheelchair',
        minuteOfDay: 0,
      }),
    ).toThrow(NoRouteError);
  });

  it('detours around a congested segment', () => {
    const graphData: StadiumGraphData = {
      nodes: [
        { id: 's', label: 'S', kind: 'gate', x: 0, y: 0 },
        { id: 'mid', label: 'Mid', kind: 'concourse', x: 10, y: 0 },
        { id: 'det', label: 'Detour', kind: 'concourse', x: 5, y: 10 },
        { id: 't', label: 'T', kind: 'seat', x: 20, y: 0 },
      ],
      edges: [
        {
          from: 's',
          to: 'mid',
          distanceMeters: 10,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
        {
          from: 'mid',
          to: 't',
          distanceMeters: 10,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
        {
          from: 's',
          to: 'det',
          distanceMeters: 12,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
        {
          from: 'det',
          to: 't',
          distanceMeters: 12,
          mode: 'level',
          widthMeters: 3,
          bidirectional: true,
        },
      ],
    };
    const crowd = buildCrowdIndex({
      id: 'jam',
      label: 'jam',
      samples: [{ segment: 'mid|s', minuteOfDay: 0, density: 0.95 }],
    });
    const route = findRoute(buildGraph(graphData), crowd, {
      originId: 's',
      destinationId: 't',
      profile: 'standard',
      minuteOfDay: 0,
    });
    expect(route.nodeIds).toContain('det');
    expect(route.nodeIds).not.toContain('mid');
  });

  it('routes across the seeded stadium with the seeded crowd feed', () => {
    const route = findRoute(stadium, buildCrowdIndex(DEFAULT_CROWD_DATASET), {
      originId: 'gate-n',
      destinationId: 'seat-acc-a',
      profile: 'wheelchair',
      minuteOfDay: 600,
    });
    expect(route.nodeIds[0]).toBe('gate-n');
    expect(route.nodeIds.at(-1)).toBe('seat-acc-a');
  });
});
