/**
 * Time-indexed crowd density model.
 *
 * Uploaded crowd samples are grouped per physical segment, sorted by time, and
 * smoothed with a moving average to remove sensor noise. Density at an
 * arbitrary minute is then resolved with a binary search (`bisect`) over the
 * sorted timestamps — `O(log n)` per lookup instead of an `O(n)` scan — and
 * linearly interpolated between the two surrounding samples.
 */

import {
  CROWD_LEVEL_MAX,
  CROWD_LEVEL_THRESHOLDS,
  CROWD_SMOOTHING_WINDOW,
  DENSITY_MIN,
} from './constants';
import type { CrowdDataset, CrowdLevel } from './types';

interface Series {
  readonly minutes: readonly number[];
  readonly densities: readonly number[];
}

/** Constant-time-per-lookup crowd density oracle for a single dataset. */
export interface CrowdIndex {
  /** Interpolated density in `[0, 1]` for `segment` at `minuteOfDay`. `O(log n)`. */
  densityAt(segment: string, minuteOfDay: number): number;
}

/** Maps a continuous density to a human-facing {@link CrowdLevel} bucket. */
export function crowdLevelFor(density: number): CrowdLevel {
  for (const [threshold, level] of CROWD_LEVEL_THRESHOLDS) {
    if (density < threshold) {
      return level;
    }
  }
  return CROWD_LEVEL_MAX;
}

/** Index of the first element `>= target` in a sorted array. `O(log n)`. */
function lowerBound(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((sorted[mid] as number) < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function movingAverage(values: readonly number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const result: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - half);
    const end = Math.min(values.length - 1, index + half);
    let sum = 0;
    for (let cursor = start; cursor <= end; cursor += 1) {
      sum += values[cursor] as number;
    }
    result.push(sum / (end - start + 1));
  }
  return result;
}

function interpolate(series: Series, hi: number, minute: number): number {
  const lo = hi - 1;
  const t0 = series.minutes[lo] as number;
  const t1 = series.minutes[hi] as number;
  const d0 = series.densities[lo] as number;
  const d1 = series.densities[hi] as number;
  const ratio = (minute - t0) / (t1 - t0);
  return d0 + (d1 - d0) * ratio;
}

class TimeSeriesCrowdIndex implements CrowdIndex {
  public constructor(private readonly bySegment: ReadonlyMap<string, Series>) {}

  public densityAt(segment: string, minuteOfDay: number): number {
    const series = this.bySegment.get(segment);
    if (series === undefined) {
      return DENSITY_MIN;
    }
    const { minutes, densities } = series;
    const bound = lowerBound(minutes, minuteOfDay);
    if (bound === 0) {
      return densities[0] as number;
    }
    if (bound === minutes.length) {
      return densities[minutes.length - 1] as number;
    }
    if ((minutes[bound] as number) === minuteOfDay) {
      return densities[bound] as number;
    }
    return interpolate(series, bound, minuteOfDay);
  }
}

function groupSortedByTime(dataset: CrowdDataset): Map<string, { time: number; value: number }[]> {
  const grouped = new Map<string, { time: number; value: number }[]>();
  for (const sample of dataset.samples) {
    const bucket = grouped.get(sample.segment);
    const entry = { time: sample.minuteOfDay, value: sample.density };
    if (bucket === undefined) {
      grouped.set(sample.segment, [entry]);
    } else {
      bucket.push(entry);
    }
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => a.time - b.time);
  }
  return grouped;
}

/**
 * Builds a {@link CrowdIndex} from an uploaded dataset. Grouping, sorting, and
 * smoothing are one-off `O(n log n)` work amortised across every later lookup.
 */
export function buildCrowdIndex(dataset: CrowdDataset): CrowdIndex {
  const grouped = groupSortedByTime(dataset);
  const bySegment = new Map<string, Series>();
  for (const [segment, entries] of grouped) {
    const minutes = entries.map((entry) => entry.time);
    const rawDensities = entries.map((entry) => entry.value);
    bySegment.set(segment, {
      minutes,
      densities: movingAverage(rawDensities, CROWD_SMOOTHING_WINDOW),
    });
  }
  return new TimeSeriesCrowdIndex(bySegment);
}
