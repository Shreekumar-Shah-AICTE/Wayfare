/**
 * A generic binary min-heap (priority queue).
 *
 * This is the data structure that turns Dijkstra's shortest-path search from a
 * naive `O(V^2)` scan into an `O((V + E) log V)` algorithm: extracting the
 * closest unvisited node becomes `O(log n)` instead of `O(n)`.
 *
 * Complexity:
 * - {@link BinaryHeap.push}  `O(log n)`  — one sift-up.
 * - {@link BinaryHeap.pop}   `O(log n)`  — one sift-down.
 * - {@link BinaryHeap.peek}  `O(1)`.
 * - {@link BinaryHeap.size}  `O(1)`.
 *
 * The heap is intentionally comparator-driven so it can order any payload
 * (here: `{ nodeId, distance }` frontier entries) without the structure knowing
 * anything about the domain.
 */
export class BinaryHeap<T> {
  private readonly items: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  /**
   * @param compare Ordering function returning a negative number when `a`
   * should surface before `b`. A min-heap uses `(a, b) => a - b`.
   */
  public constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  /** Number of elements currently in the heap. `O(1)`. */
  public get size(): number {
    return this.items.length;
  }

  /** Whether the heap holds no elements. `O(1)`. */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Returns the minimum element without removing it, or `undefined`. `O(1)`. */
  public peek(): T | undefined {
    return this.items[0];
  }

  /** Inserts a value and restores the heap invariant. `O(log n)`. */
  public push(value: T): void {
    this.items.push(value);
    this.siftUp(this.items.length - 1);
  }

  /** Removes and returns the minimum element, or `undefined` if empty. `O(log n)`. */
  public pop(): T | undefined {
    const { items } = this;
    if (items.length === 0) {
      return undefined;
    }
    // Invariant: length > 0, so index 0 and the popped tail are defined.
    const top = items[0] as T;
    const last = items.pop() as T;
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compareAt(index, parent) >= 0) {
        break;
      }
      this.swap(index, parent);
      index = parent;
    }
  }

  private siftDown(start: number): void {
    const { length } = this.items;
    let index = start;
    let next = this.smallerChild(index, length);
    while (next !== index) {
      this.swap(index, next);
      index = next;
      next = this.smallerChild(index, length);
    }
  }

  private smallerChild(index: number, length: number): number {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < length && this.compareAt(left, smallest) < 0) {
      smallest = left;
    }
    if (right < length && this.compareAt(right, smallest) < 0) {
      smallest = right;
    }
    return smallest;
  }

  private compareAt(a: number, b: number): number {
    // Invariant: callers only pass indices `< items.length`.
    return this.compare(this.items[a] as T, this.items[b] as T);
  }

  private swap(a: number, b: number): void {
    const { items } = this;
    const temp = items[a] as T;
    items[a] = items[b] as T;
    items[b] = temp;
  }
}
