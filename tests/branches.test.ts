import { describe, expect, it } from 'vitest';

import { buildCrowdIndex } from '@/core/crowd';
import { buildGraph } from '@/core/graph';
import { findRoute } from '@/core/routing';
import type { CrowdDataset, MobilityProfile, StadiumGraphData } from '@/core/types';

/**
 * A tiny stadium with a direct stepped path and a longer step-free path, plus
 * a calm bypass, used to prove each profile branch takes a different route.
 */
const graphData: StadiumGraphData = {
  nodes: [
    { id: 'in', label: 'Entrance', kind: 'gate', x: 0, y: 0 },
    { id: 'hub', label: 'Hub', kind: 'concourse', x: 10, y: 0 },
    { id: 'stairTop', label: 'Stair Top', kind: 'concourse', x: 20, y: 0 },
    { id: 'rampTop', label: 'Ramp Top', kind: 'concourse', x: 15, y: 12 },
    { id: 'seat', label: 'Seat', kind: 'seat', x: 25, y: 6 },
  ],
  edges: [
    {
      from: 'in',
      to: 'hub',
      distanceMeters: 10,
      mode: 'level',
      widthMeters: 3,
      bidirectional: true,
    },
    {
      from: 'hub',
      to: 'stairTop',
      distanceMeters: 8,
      mode: 'stairs',
      widthMeters: 2,
      bidirectional: true,
    },
    {
      from: 'stairTop',
      to: 'seat',
      distanceMeters: 8,
      mode: 'level',
      widthMeters: 3,
      bidirectional: true,
    },
    {
      from: 'hub',
      to: 'rampTop',
      distanceMeters: 16,
      mode: 'ramp',
      widthMeters: 2.4,
      bidirectional: true,
    },
    {
      from: 'rampTop',
      to: 'seat',
      distanceMeters: 16,
      mode: 'level',
      widthMeters: 3,
      bidirectional: true,
    },
  ],
};

const graph = buildGraph(graphData);
const calm = buildCrowdIndex({ id: 'calm', label: 'calm', samples: [] });

function routeVia(profile: MobilityProfile): readonly string[] {
  return findRoute(graph, calm, {
    originId: 'in',
    destinationId: 'seat',
    profile,
    minuteOfDay: 0,
  }).nodeIds;
}

describe('profile-dependent routing branches', () => {
  it('a standard traveller takes the shorter stepped path', () => {
    expect(routeVia('standard')).toContain('stairTop');
  });

  it('a step-free traveller is forced onto the ramp path', () => {
    const nodeIds = routeVia('stepFree');
    expect(nodeIds).toContain('rampTop');
    expect(nodeIds).not.toContain('stairTop');
  });

  it('a wheelchair traveller also avoids the stairs', () => {
    expect(routeVia('wheelchair')).toContain('rampTop');
  });
});

describe('crowd-sensitivity branch', () => {
  it('a low-sensory traveller detours around a busy shortcut', () => {
    const busy: CrowdDataset = {
      id: 'busy',
      label: 'busy',
      samples: [{ segment: 'hub|stairTop', minuteOfDay: 0, density: 0.9 }],
    };
    const nodeIds = findRoute(graph, buildCrowdIndex(busy), {
      originId: 'in',
      destinationId: 'seat',
      profile: 'lowSensory',
      minuteOfDay: 0,
    }).nodeIds;
    expect(nodeIds).toContain('rampTop');
  });
});
