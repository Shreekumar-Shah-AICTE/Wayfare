/**
 * Crowd- and accessibility-aware shortest-path routing across a stadium graph.
 *
 * The engine is Dijkstra's algorithm backed by the {@link BinaryHeap} priority
 * queue, giving `O((V + E) log V)` time and `O(V)` space. Dijkstra (not A* or a
 * plain BFS) is the right tool because segment weights are non-negative and
 * data-dependent: they combine physical distance, a per-profile mode multiplier
 * (stairs are infeasible for a wheelchair), and a live crowd penalty, so no
 * admissible geometric heuristic is available without extra assumptions.
 */

import {
  CROWD_COST_WEIGHT,
  CROWD_SLOWDOWN,
  MODE_WEIGHTS,
  PROFILE_CROWD_SENSITIVITY,
  PROFILE_SPEED_M_PER_MIN,
  WHEELCHAIR_MIN_WIDTH_M,
} from './constants';
import type { CrowdIndex } from './crowd';
import { NoRouteError } from './errors';
import { segmentKey, type StadiumGraph } from './graph';
import { BinaryHeap } from './heap';
import type { MobilityProfile, RouteResult, RouteSegment, StadiumEdge } from './types';

/** A shortest-path query. */
export interface RouteRequest {
  readonly originId: string;
  readonly destinationId: string;
  readonly profile: MobilityProfile;
  readonly minuteOfDay: number;
}

interface FrontierEntry {
  readonly nodeId: string;
  readonly distance: number;
}

interface Backpointer {
  readonly from: string;
  readonly edge: StadiumEdge;
  readonly density: number;
  readonly weight: number;
}

interface SearchState {
  readonly graph: StadiumGraph;
  readonly crowd: CrowdIndex;
  readonly request: RouteRequest;
  readonly dist: Map<string, number>;
  readonly back: Map<string, Backpointer>;
  readonly frontier: BinaryHeap<FrontierEntry>;
}

/**
 * Effective traversal cost of a segment for a profile at a crowd density.
 * Returns `Infinity` when the segment is infeasible (e.g. stairs for a
 * wheelchair, or a corridor narrower than {@link WHEELCHAIR_MIN_WIDTH_M}), which
 * removes it from consideration.
 */
export function segmentWeight(
  edge: StadiumEdge,
  profile: MobilityProfile,
  density: number,
): number {
  const modeWeight = MODE_WEIGHTS[profile][edge.mode];
  if (!Number.isFinite(modeWeight)) {
    return Infinity;
  }
  if (profile === 'wheelchair' && edge.widthMeters < WHEELCHAIR_MIN_WIDTH_M) {
    return Infinity;
  }
  const crowdFactor = 1 + CROWD_COST_WEIGHT * PROFILE_CROWD_SENSITIVITY[profile] * density;
  return edge.distanceMeters * modeWeight * crowdFactor;
}

/** Walking time in minutes for one segment, slowed by crowding. */
function travelMinutes(profile: MobilityProfile, distanceMeters: number, density: number): number {
  const speed = PROFILE_SPEED_M_PER_MIN[profile] * (1 - CROWD_SLOWDOWN * density);
  return distanceMeters / speed;
}

function emptyRoute(nodeId: string, profile: MobilityProfile): RouteResult {
  return {
    nodeIds: [nodeId],
    segments: [],
    totalDistanceMeters: 0,
    totalCost: 0,
    estimatedMinutes: 0,
    maxDensity: 0,
    profile,
  };
}

function relaxNeighbors(state: SearchState, current: FrontierEntry): void {
  const baseDistance = state.dist.get(current.nodeId) as number;
  for (const edge of state.graph.neighbors(current.nodeId)) {
    const density = state.crowd.densityAt(
      segmentKey(edge.from, edge.to),
      state.request.minuteOfDay,
    );
    const weight = segmentWeight(edge, state.request.profile, density);
    if (!Number.isFinite(weight)) {
      continue;
    }
    const candidate = baseDistance + weight;
    const known = state.dist.get(edge.to) ?? Number.POSITIVE_INFINITY;
    if (candidate < known) {
      state.dist.set(edge.to, candidate);
      state.back.set(edge.to, { from: current.nodeId, edge, density, weight });
      state.frontier.push({ nodeId: edge.to, distance: candidate });
    }
  }
}

function reconstruct(state: SearchState, originId: string, destinationId: string): RouteResult {
  const segments: RouteSegment[] = [];
  const nodeIds: string[] = [destinationId];
  let cursor = destinationId;
  while (cursor !== originId) {
    const step = state.back.get(cursor) as Backpointer;
    segments.push({
      from: step.from,
      to: cursor,
      mode: step.edge.mode,
      distanceMeters: step.edge.distanceMeters,
      density: step.density,
      cost: step.weight,
    });
    nodeIds.push(step.from);
    cursor = step.from;
  }
  segments.reverse();
  nodeIds.reverse();
  return summarise(
    segments,
    nodeIds,
    state.dist.get(destinationId) as number,
    state.request.profile,
  );
}

function summarise(
  segments: readonly RouteSegment[],
  nodeIds: readonly string[],
  totalCost: number,
  profile: MobilityProfile,
): RouteResult {
  let totalDistanceMeters = 0;
  let maxDensity = 0;
  let rawMinutes = 0;
  for (const segment of segments) {
    totalDistanceMeters += segment.distanceMeters;
    maxDensity = Math.max(maxDensity, segment.density);
    rawMinutes += travelMinutes(profile, segment.distanceMeters, segment.density);
  }
  return {
    nodeIds,
    segments,
    totalDistanceMeters,
    totalCost,
    estimatedMinutes: Math.round(rawMinutes * 10) / 10,
    maxDensity,
    profile,
  };
}

/**
 * Computes the lowest-cost feasible route for `request`. Throws
 * {@link NotFoundError} for unknown node ids and {@link NoRouteError} when no
 * feasible path exists for the chosen profile.
 */
export function findRoute(
  graph: StadiumGraph,
  crowd: CrowdIndex,
  request: RouteRequest,
): RouteResult {
  const origin = graph.requireNode(request.originId);
  const destination = graph.requireNode(request.destinationId);
  if (origin.id === destination.id) {
    return emptyRoute(origin.id, request.profile);
  }

  const state: SearchState = {
    graph,
    crowd,
    request,
    dist: new Map<string, number>([[origin.id, 0]]),
    back: new Map<string, Backpointer>(),
    frontier: new BinaryHeap<FrontierEntry>((a, b) => a.distance - b.distance),
  };
  state.frontier.push({ nodeId: origin.id, distance: 0 });

  const visited = new Set<string>();
  while (!state.frontier.isEmpty()) {
    const current = state.frontier.pop() as FrontierEntry;
    if (visited.has(current.nodeId)) {
      continue;
    }
    visited.add(current.nodeId);
    if (current.nodeId === destination.id) {
      break;
    }
    relaxNeighbors(state, current);
  }

  if (!visited.has(destination.id)) {
    throw new NoRouteError(
      `No feasible ${request.profile} route from "${origin.id}" to "${destination.id}".`,
    );
  }
  return reconstruct(state, origin.id, destination.id);
}
