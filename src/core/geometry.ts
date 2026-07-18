/**
 * Pure planar geometry helpers used to describe turns in navigation steps.
 *
 * Coordinates use a standard mathematical orientation (X grows right, Y grows
 * up) so a positive heading change is a left turn. The UI maps these normalised
 * coordinates onto the SVG canvas; the routing core never needs pixels.
 */

import { SHARP_ANGLE_DEG, STRAIGHT_ANGLE_DEG } from './constants';
import type { StadiumNode, TurnDirection } from './types';

const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;
const RAD_TO_DEG = HALF_TURN_DEG / Math.PI;

/**
 * Bearing in degrees `[0, 360)` of the ray from `a` to `b`, measured
 * counter-clockwise from the positive X axis.
 */
export function bearingDegrees(a: StadiumNode, b: StadiumNode): number {
  const radians = Math.atan2(b.y - a.y, b.x - a.x);
  return (radians * RAD_TO_DEG + FULL_TURN_DEG) % FULL_TURN_DEG;
}

/**
 * Signed heading change in degrees `(-180, 180]` when travelling
 * `prev -> pivot -> next`. Positive is a left turn, negative a right turn.
 */
export function headingChange(prev: StadiumNode, pivot: StadiumNode, next: StadiumNode): number {
  const incoming = bearingDegrees(prev, pivot);
  const outgoing = bearingDegrees(pivot, next);
  const delta =
    ((outgoing - incoming + HALF_TURN_DEG + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;
  return delta;
}

/**
 * Classifies a signed heading change into a human turn direction using the
 * {@link STRAIGHT_ANGLE_DEG} and {@link SHARP_ANGLE_DEG} thresholds.
 */
export function classifyTurn(deltaDegrees: number): TurnDirection {
  const magnitude = Math.abs(deltaDegrees);
  if (magnitude <= STRAIGHT_ANGLE_DEG) {
    return 'straight';
  }
  const isLeft = deltaDegrees > 0;
  if (magnitude >= SHARP_ANGLE_DEG) {
    return isLeft ? 'sharp-left' : 'sharp-right';
  }
  return isLeft ? 'left' : 'right';
}
