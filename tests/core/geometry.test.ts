import { describe, expect, it } from 'vitest';

import { bearingDegrees, classifyTurn, headingChange } from '@/core/geometry';
import type { StadiumNode } from '@/core/types';

const at = (x: number, y: number): StadiumNode => ({
  id: 'n',
  label: 'n',
  kind: 'concourse',
  x,
  y,
});

describe('bearingDegrees', () => {
  it('measures cardinal directions counter-clockwise from +x', () => {
    const origin = at(50, 50);
    expect(bearingDegrees(origin, at(60, 50))).toBeCloseTo(0);
    expect(bearingDegrees(origin, at(50, 60))).toBeCloseTo(90);
    expect(bearingDegrees(origin, at(40, 50))).toBeCloseTo(180);
    expect(bearingDegrees(origin, at(50, 40))).toBeCloseTo(270);
  });
});

describe('headingChange', () => {
  it('is zero when continuing straight', () => {
    expect(headingChange(at(0, 0), at(10, 0), at(20, 0))).toBeCloseTo(0);
  });

  it('is positive for a left turn and negative for a right turn', () => {
    expect(headingChange(at(0, 0), at(10, 0), at(10, 10))).toBeCloseTo(90);
    expect(headingChange(at(0, 0), at(10, 0), at(10, -10))).toBeCloseTo(-90);
  });

  it('wraps around the +/-180 boundary without exceeding it', () => {
    const delta = headingChange(at(0, 0), at(10, 0), at(0, 1));
    expect(delta).toBeGreaterThan(90);
    expect(delta).toBeLessThanOrEqual(180);
  });
});

describe('classifyTurn', () => {
  it('classifies each band of heading change', () => {
    expect(classifyTurn(0)).toBe('straight');
    expect(classifyTurn(20)).toBe('straight');
    expect(classifyTurn(45)).toBe('left');
    expect(classifyTurn(-45)).toBe('right');
    expect(classifyTurn(150)).toBe('sharp-left');
    expect(classifyTurn(-150)).toBe('sharp-right');
  });
});
