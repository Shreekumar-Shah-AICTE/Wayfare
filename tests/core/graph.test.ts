import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/core/errors';
import { buildGraph, segmentKey } from '@/core/graph';
import type { StadiumGraphData } from '@/core/types';

const graphData: StadiumGraphData = {
  nodes: [
    { id: 'a', label: 'A', kind: 'gate', x: 0, y: 0 },
    { id: 'b', label: 'B', kind: 'concourse', x: 10, y: 0 },
    { id: 'c', label: 'C', kind: 'seat', x: 20, y: 0 },
  ],
  edges: [
    { from: 'a', to: 'b', distanceMeters: 10, mode: 'level', widthMeters: 3, bidirectional: true },
    { from: 'a', to: 'c', distanceMeters: 25, mode: 'level', widthMeters: 3, bidirectional: false },
  ],
};

describe('segmentKey', () => {
  it('is order-independent', () => {
    expect(segmentKey('a', 'b')).toBe(segmentKey('b', 'a'));
    expect(segmentKey('b', 'a')).toBe('a|b');
  });
});

describe('buildGraph', () => {
  it('indexes nodes and expands bidirectional edges', () => {
    const graph = buildGraph(graphData);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.node('b')?.label).toBe('B');
    // 'a' has two outgoing edges; 'b' has a reverse edge back to 'a'.
    expect(graph.neighbors('a')).toHaveLength(2);
    expect(graph.neighbors('b').map((edge) => edge.to)).toEqual(['a']);
    // 'c' has no outgoing edges (the a->c edge is one-way).
    expect(graph.neighbors('c')).toEqual([]);
  });

  it('returns undefined for an unknown node and throws from requireNode', () => {
    const graph = buildGraph(graphData);
    expect(graph.node('zzz')).toBeUndefined();
    expect(() => graph.requireNode('zzz')).toThrow(NotFoundError);
    expect(graph.requireNode('a').id).toBe('a');
  });

  it('rejects edges that reference an unknown source or target', () => {
    expect(() =>
      buildGraph({
        nodes: graphData.nodes,
        edges: [
          {
            from: 'ghost',
            to: 'a',
            distanceMeters: 1,
            mode: 'level',
            widthMeters: 2,
            bidirectional: false,
          },
        ],
      }),
    ).toThrow(NotFoundError);
    expect(() =>
      buildGraph({
        nodes: graphData.nodes,
        edges: [
          {
            from: 'a',
            to: 'ghost',
            distanceMeters: 1,
            mode: 'level',
            widthMeters: 2,
            bidirectional: false,
          },
        ],
      }),
    ).toThrow(NotFoundError);
  });
});
