/**
 * Named domain constants for the routing core.
 *
 * Every tunable number the engine relies on lives here so there are zero magic
 * numbers scattered across the logic (a Code-Quality requirement) and so the
 * behaviour can be reasoned about and tested from a single source of truth.
 */

import type { CrowdLevel, EdgeMode, MobilityProfile } from './types';

/** Inclusive bounds for a normalised crowd density value. */
export const DENSITY_MIN = 0;
export const DENSITY_MAX = 1;

/** Inclusive bounds for a minute-of-day timestamp. */
export const MINUTE_MIN = 0;
export const MINUTE_MAX = 1439;

/** Inclusive bounds for a normalised map coordinate. */
export const COORD_MIN = 0;
export const COORD_MAX = 100;

/**
 * How strongly crowd density inflates the effective cost of a segment. A fully
 * congested corridor (`density = 1`) costs `1 + CROWD_COST_WEIGHT` times its
 * base distance for a standard traveller before profile weighting.
 */
export const CROWD_COST_WEIGHT = 3;

/** Density thresholds (exclusive upper bounds) mapping to {@link CrowdLevel}. */
export const CROWD_LEVEL_THRESHOLDS: readonly (readonly [number, CrowdLevel])[] = [
  [0.25, 'calm'],
  [0.5, 'moderate'],
  [0.75, 'busy'],
];

/** Fallback crowd level for densities at or above the last threshold. */
export const CROWD_LEVEL_MAX: CrowdLevel = 'congested';

/**
 * Per-profile multipliers applied to a segment's base distance for each edge
 * mode. `Infinity` marks the mode as infeasible, which excludes the segment
 * from the graph entirely for that profile.
 */
export const MODE_WEIGHTS: Readonly<Record<MobilityProfile, Readonly<Record<EdgeMode, number>>>> = {
  standard: { level: 1, ramp: 1.1, stairs: 1.2, elevator: 1.4, escalator: 1.1 },
  stepFree: { level: 1, ramp: 1.05, stairs: Infinity, elevator: 1.2, escalator: 1.3 },
  wheelchair: { level: 1, ramp: 1.1, stairs: Infinity, elevator: 1.15, escalator: Infinity },
  lowSensory: { level: 1, ramp: 1.1, stairs: 1.1, elevator: 1.6, escalator: 1.5 },
};

/**
 * Extra weight each profile places on crowding, multiplied into
 * {@link CROWD_COST_WEIGHT}. Low-sensory travellers avoid crowds most.
 */
export const PROFILE_CROWD_SENSITIVITY: Readonly<Record<MobilityProfile, number>> = {
  standard: 1,
  stepFree: 1.15,
  wheelchair: 1.25,
  lowSensory: 2.2,
};

/** Comfortable walking speed in metres per minute for each profile. */
export const PROFILE_SPEED_M_PER_MIN: Readonly<Record<MobilityProfile, number>> = {
  standard: 80,
  stepFree: 70,
  wheelchair: 55,
  lowSensory: 65,
};

/**
 * Fraction of walking speed lost at full congestion. At `density = 1` a
 * traveller moves at `1 - CROWD_SLOWDOWN` of their comfortable speed.
 */
export const CROWD_SLOWDOWN = 0.7;

/** Minimum corridor width (metres) a wheelchair route requires. */
export const WHEELCHAIR_MIN_WIDTH_M = 1.2;

/** Half-angle (degrees) within which a heading change counts as "straight". */
export const STRAIGHT_ANGLE_DEG = 20;

/** Angle (degrees) beyond which a turn is considered "sharp". */
export const SHARP_ANGLE_DEG = 115;

/** Number of neighbouring samples averaged when smoothing crowd density. */
export const CROWD_SMOOTHING_WINDOW = 3;

/** Upper bound on nodes/edges accepted from an uploaded graph (DoS guard). */
export const MAX_NODES = 2000;
export const MAX_EDGES = 8000;

/** Upper bound on crowd samples accepted from a single upload (DoS guard). */
export const MAX_CROWD_SAMPLES = 50000;

/** Maximum characters accepted in any uploaded text payload (DoS guard). */
export const MAX_UPLOAD_CHARS = 2000000;
