/**
 * Turns a computed {@link RouteResult} into an ordered list of deterministic
 * {@link NavigationStep}s.
 *
 * These steps are the *only* facts the LLM narrator is allowed to phrase. By
 * deriving every instruction (turn direction, mode transition, crowd warning)
 * here in pure, tested code, the natural-language layer can never invent a turn
 * or send a fan the wrong way — it can only translate what we computed.
 */

import { crowdLevelFor } from './crowd';
import { classifyTurn, headingChange } from './geometry';
import type { StadiumGraph } from './graph';
import type {
  CrowdLevel,
  EdgeMode,
  NavigationStep,
  RouteResult,
  RouteSegment,
  StepKind,
  TurnDirection,
} from './types';

function turnFor(
  graph: StadiumGraph,
  segments: readonly RouteSegment[],
  index: number,
): TurnDirection {
  if (index === 0) {
    return 'straight';
  }
  const previous = segments[index - 1] as RouteSegment;
  const segment = segments[index] as RouteSegment;
  const prevFrom = graph.requireNode(previous.from);
  const pivot = graph.requireNode(segment.from);
  const next = graph.requireNode(segment.to);
  return classifyTurn(headingChange(prevFrom, pivot, next));
}

function classifyKind(index: number, mode: EdgeMode, turn: TurnDirection): StepKind {
  if (index === 0) {
    return 'depart';
  }
  if (mode !== 'level') {
    return 'transition';
  }
  return turn === 'straight' ? 'continue' : 'turn';
}

function noteFor(mode: EdgeMode, crowdLevel: CrowdLevel): string | null {
  if (crowdLevel === 'congested') {
    return 'Heavy crowding — expect a slower, busier stretch.';
  }
  if (crowdLevel === 'busy') {
    return 'Busy corridor; keep to one side.';
  }
  if (mode === 'elevator') {
    return 'Step-free elevator segment.';
  }
  return null;
}

function buildStep(
  graph: StadiumGraph,
  segment: RouteSegment,
  index: number,
  turn: TurnDirection,
): NavigationStep {
  const fromNode = graph.requireNode(segment.from);
  const toNode = graph.requireNode(segment.to);
  const crowdLevel = crowdLevelFor(segment.density);
  const kind = classifyKind(index, segment.mode, turn);
  return {
    index,
    kind,
    fromLabel: fromNode.label,
    toLabel: toNode.label,
    mode: segment.mode,
    distanceMeters: segment.distanceMeters,
    crowdLevel,
    turn,
    note: noteFor(segment.mode, crowdLevel),
  };
}

function arriveStep(
  index: number,
  graph: StadiumGraph,
  segments: readonly RouteSegment[],
): NavigationStep {
  const last = segments[segments.length - 1] as RouteSegment;
  const destination = graph.requireNode(last.to);
  return {
    index,
    kind: 'arrive',
    fromLabel: destination.label,
    toLabel: destination.label,
    mode: 'level',
    distanceMeters: 0,
    crowdLevel: 'calm',
    turn: 'straight',
    note: null,
  };
}

/**
 * Produces human-readable navigation steps for a route. Returns an empty list
 * for a zero-length route (origin equal to destination).
 */
export function generateSteps(graph: StadiumGraph, route: RouteResult): NavigationStep[] {
  const steps: NavigationStep[] = [];
  const { segments } = route;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] as RouteSegment;
    steps.push(buildStep(graph, segment, index, turnFor(graph, segments, index)));
  }
  if (segments.length > 0) {
    steps.push(arriveStep(steps.length, graph, segments));
  }
  return steps;
}
