/**
 * Immutable, indexed view over a {@link StadiumGraphData}.
 *
 * Building the index once at load time gives every subsequent routing query
 * `O(1)` node lookups and `O(1)` neighbour lookups (via hash maps) instead of
 * repeatedly scanning the raw arrays — the difference between a snappy demo and
 * an `O(V * E)` stall. See {@link buildGraph} for the one-off `O(V + E)` cost.
 */

import { NotFoundError } from './errors';
import type { StadiumEdge, StadiumGraphData, StadiumNode } from './types';

const NO_EDGES: readonly StadiumEdge[] = [];

/**
 * Produces an order-independent key for the physical segment joining two nodes,
 * so crowd data recorded in either direction maps to the same corridor.
 */
export function segmentKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Read-only routing view of a stadium with constant-time lookups. */
export interface StadiumGraph {
  readonly nodes: readonly StadiumNode[];
  /** Returns the node with `id`, or `undefined` if it is absent. `O(1)`. */
  node(id: string): StadiumNode | undefined;
  /** Returns the node with `id` or throws {@link NotFoundError}. `O(1)`. */
  requireNode(id: string): StadiumNode;
  /** Returns outgoing edges from `id` (never `undefined`). `O(1)`. */
  neighbors(id: string): readonly StadiumEdge[];
}

class IndexedGraph implements StadiumGraph {
  public constructor(
    private readonly nodeById: ReadonlyMap<string, StadiumNode>,
    private readonly adjacency: ReadonlyMap<string, readonly StadiumEdge[]>,
    public readonly nodes: readonly StadiumNode[],
  ) {}

  public node(id: string): StadiumNode | undefined {
    return this.nodeById.get(id);
  }

  public requireNode(id: string): StadiumNode {
    const found = this.nodeById.get(id);
    if (found === undefined) {
      throw new NotFoundError(`Unknown node "${id}".`);
    }
    return found;
  }

  public neighbors(id: string): readonly StadiumEdge[] {
    return this.adjacency.get(id) ?? NO_EDGES;
  }
}

function reverseEdge(edge: StadiumEdge): StadiumEdge {
  return {
    from: edge.to,
    to: edge.from,
    distanceMeters: edge.distanceMeters,
    mode: edge.mode,
    widthMeters: edge.widthMeters,
    bidirectional: edge.bidirectional,
  };
}

function link(adjacency: Map<string, StadiumEdge[]>, edge: StadiumEdge): void {
  const existing = adjacency.get(edge.from);
  if (existing === undefined) {
    adjacency.set(edge.from, [edge]);
    return;
  }
  existing.push(edge);
}

/**
 * Indexes validated graph data for routing. Throws {@link NotFoundError} if any
 * edge references a node that is not present. Runs in `O(V + E)`.
 */
export function buildGraph(data: StadiumGraphData): StadiumGraph {
  const nodeById = new Map<string, StadiumNode>();
  for (const node of data.nodes) {
    nodeById.set(node.id, node);
  }

  const adjacency = new Map<string, StadiumEdge[]>();
  for (const edge of data.edges) {
    if (!nodeById.has(edge.from)) {
      throw new NotFoundError(`Edge references unknown node "${edge.from}".`);
    }
    if (!nodeById.has(edge.to)) {
      throw new NotFoundError(`Edge references unknown node "${edge.to}".`);
    }
    link(adjacency, edge);
    if (edge.bidirectional) {
      link(adjacency, reverseEdge(edge));
    }
  }

  return new IndexedGraph(nodeById, adjacency, data.nodes);
}
