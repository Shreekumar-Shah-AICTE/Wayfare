/**
 * High-level journey planner that composes routing and step generation.
 *
 * This is the single deterministic entry point the API layer calls: it returns
 * both the numeric {@link RouteResult} and the human-readable
 * {@link NavigationStep} list, guaranteeing the two always describe the same
 * path.
 */

import type { CrowdIndex } from './crowd';
import type { StadiumGraph } from './graph';
import { findRoute, type RouteRequest } from './routing';
import { generateSteps } from './steps';
import type { JourneyPlan } from './types';

/**
 * Computes a route and its navigation steps for `request`. Propagates
 * {@link NotFoundError} and {@link NoRouteError} from the routing engine.
 */
export function planJourney(
  graph: StadiumGraph,
  crowd: CrowdIndex,
  request: RouteRequest,
): JourneyPlan {
  const route = findRoute(graph, crowd, request);
  const steps = generateSteps(graph, route);
  return { route, steps };
}
