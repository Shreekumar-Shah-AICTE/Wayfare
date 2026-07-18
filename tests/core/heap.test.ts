import { describe, expect, it } from 'vitest';

import { BinaryHeap } from '@/core/heap';

const numeric = (a: number, b: number): number => a - b;

describe('BinaryHeap', () => {
  it('reports empty state and yields undefined from peek/pop', () => {
    const heap = new BinaryHeap<number>(numeric);
    expect(heap.isEmpty()).toBe(true);
    expect(heap.size).toBe(0);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
  });

  it('extracts elements in ascending priority order', () => {
    const heap = new BinaryHeap<number>(numeric);
    for (const value of [5, 3, 8, 1, 9, 2, 7, 4, 6]) {
      heap.push(value);
    }
    expect(heap.size).toBe(9);
    expect(heap.peek()).toBe(1);
    const drained: number[] = [];
    while (!heap.isEmpty()) {
      drained.push(heap.pop() as number);
    }
    expect(drained).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('pops a single element without sifting down', () => {
    const heap = new BinaryHeap<number>(numeric);
    heap.push(42);
    expect(heap.pop()).toBe(42);
    expect(heap.isEmpty()).toBe(true);
  });

  it('handles duplicate priorities and interleaved push/pop', () => {
    const heap = new BinaryHeap<number>(numeric);
    for (const value of [4, 4, 4, 1, 1]) {
      heap.push(value);
    }
    expect(heap.pop()).toBe(1);
    heap.push(0);
    expect(heap.pop()).toBe(0);
    expect(heap.pop()).toBe(1);
  });
});
