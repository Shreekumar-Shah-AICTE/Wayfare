/**
 * Domain types for the Wayfare stadium routing core.
 *
 * Every type here is framework-agnostic and I/O-free so the routing engine can
 * be unit-tested in isolation and reused on the server, in tests, and (if ever
 * needed) in a worker. No type in this module depends on React, Next.js, or the
 * network.
 */

/**
 * Physical means by which a segment between two nodes is traversed. The mode
 * determines feasibility for a given {@link MobilityProfile} and how a
 * navigation step is phrased (e.g. "take the ramp up").
 */
export type EdgeMode = 'level' | 'ramp' | 'stairs' | 'elevator' | 'escalator';

/**
 * The accessibility/comfort profile a fan travels with. Profiles change both
 * which segments are *feasible* and how crowd density is *weighted*.
 */
export type MobilityProfile = 'standard' | 'stepFree' | 'wheelchair' | 'lowSensory';

/** Human-facing crowd bucket derived from a continuous density in `[0, 1]`. */
export type CrowdLevel = 'calm' | 'moderate' | 'busy' | 'congested';

/** Relative heading change between two consecutive segments. */
export type TurnDirection = 'straight' | 'left' | 'right' | 'sharp-left' | 'sharp-right';

/** Semantic role of a node, used for labelling and iconography only. */
export type NodeKind = 'gate' | 'concourse' | 'transition' | 'seat' | 'exit' | 'facility';

/** A point of interest in the stadium graph with a normalised map coordinate. */
export interface StadiumNode {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  /** Normalised map X coordinate in `[0, 100]`. */
  readonly x: number;
  /** Normalised map Y coordinate in `[0, 100]`. */
  readonly y: number;
}

/** A directed walkable segment connecting two nodes. */
export interface StadiumEdge {
  readonly from: string;
  readonly to: string;
  /** Physical walking distance in metres; strictly positive. */
  readonly distanceMeters: number;
  readonly mode: EdgeMode;
  /** Corridor width in metres; used for capacity and low-sensory weighting. */
  readonly widthMeters: number;
  /** When true, the segment is also walkable from `to` to `from`. */
  readonly bidirectional: boolean;
}

/** A complete, validated stadium graph ready to be indexed for routing. */
export interface StadiumGraphData {
  readonly nodes: readonly StadiumNode[];
  readonly edges: readonly StadiumEdge[];
}

/** A single crowd density observation for a physical segment at a given time. */
export interface CrowdSample {
  /** Order-independent segment key produced by {@link segmentKey}. */
  readonly segment: string;
  /** Minute of the match day in `[0, 1439]`. */
  readonly minuteOfDay: number;
  /** Continuous crowd density in `[0, 1]` where 1 is a standstill crush. */
  readonly density: number;
}

/** A named collection of crowd observations uploaded by an operator. */
export interface CrowdDataset {
  readonly id: string;
  readonly label: string;
  readonly samples: readonly CrowdSample[];
}

/** One segment of a computed route, enriched with the crowd data used. */
export interface RouteSegment {
  readonly from: string;
  readonly to: string;
  readonly mode: EdgeMode;
  readonly distanceMeters: number;
  readonly density: number;
  /** Effective cost this segment contributed to the shortest-path total. */
  readonly cost: number;
}

/** The result of a shortest-path query across the stadium graph. */
export interface RouteResult {
  readonly nodeIds: readonly string[];
  readonly segments: readonly RouteSegment[];
  readonly totalDistanceMeters: number;
  readonly totalCost: number;
  readonly estimatedMinutes: number;
  readonly maxDensity: number;
  readonly profile: MobilityProfile;
}

/** Kind of guidance a navigation step conveys. */
export type StepKind = 'depart' | 'continue' | 'turn' | 'transition' | 'arrive';

/**
 * A deterministic, machine-generated navigation step. The LLM narrator only
 * ever rephrases these facts; it never invents or reorders them.
 */
export interface NavigationStep {
  readonly index: number;
  readonly kind: StepKind;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly mode: EdgeMode;
  readonly distanceMeters: number;
  readonly crowdLevel: CrowdLevel;
  /** Turn direction for `turn`/`continue` steps; `'straight'` otherwise. */
  readonly turn: TurnDirection;
  readonly note: string | null;
}

/** A fully computed plan: the route plus its human-readable step list. */
export interface JourneyPlan {
  readonly route: RouteResult;
  readonly steps: readonly NavigationStep[];
}
