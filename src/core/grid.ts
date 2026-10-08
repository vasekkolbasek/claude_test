export interface GridItem {
  x: number;
  y: number;
  r: number;
  /** Query stamp used for de-duplication; owned by SpatialHash. */
  _q: number;
}

/**
 * Allocation-free spatial hash. Items are inserted by their centre; items bigger than
 * half a cell go to a small "big" list that every query returns (bosses, giants).
 */
export class SpatialHash<T extends GridItem> {
  private readonly buckets: T[][];
  /** items in each bucket: buckets are reset by count, never emptied (an emptied array loses its
   *  storage in V8 and every bucket was re-grown every frame) */
  private readonly counts: Int32Array;
  private readonly used: number[] = [];
  private usedN = 0;
  private readonly mask: number;
  private readonly big: T[] = [];
  private bigN = 0;
  private stamp = 1;
  readonly inv: number;
  readonly bigR: number;

  constructor(readonly cell = 64, tableSize = 4096) {
    this.mask = tableSize - 1;
    this.inv = 1 / cell;
    this.bigR = cell * 0.5;
    this.buckets = new Array(tableSize);
    for (let i = 0; i < tableSize; i++) this.buckets[i] = [];
    this.counts = new Int32Array(tableSize);
  }

  private key(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  clear(): void {
    for (let i = 0; i < this.usedN; i++) this.counts[this.used[i]] = 0;
    this.usedN = 0;
    this.bigN = 0;
  }

  insert(o: T): void {
    if (o.r > this.bigR) {
      this.big[this.bigN++] = o;
      return;
    }
    const k = this.key(Math.floor(o.x * this.inv), Math.floor(o.y * this.inv));
    const c = this.counts[k];
    if (c === 0) this.used[this.usedN++] = k;
    this.buckets[k][c] = o;
    this.counts[k] = c + 1;
  }

  /**
   * Writes the candidate items whose centre lies within `r + bigR` of (x, y) to the front of
   * `out` and returns how many there are. `out` is never shrunk (emptying an array makes V8 drop
   * its storage, and dozens of queries a frame were re-growing it): entries past the count are stale.
   */
  query(x: number, y: number, r: number, out: T[]): number {
    let n = 0;
    const s = ++this.stamp;
    const rr = r + this.bigR;
    const x0 = Math.floor((x - rr) * this.inv);
    const x1 = Math.floor((x + rr) * this.inv);
    const y0 = Math.floor((y - rr) * this.inv);
    const y1 = Math.floor((y + rr) * this.inv);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        const b = this.buckets[k];
        const c = this.counts[k];
        for (let i = 0; i < c; i++) {
          const o = b[i];
          if (o._q !== s) {
            o._q = s;
            out[n++] = o;
          }
        }
      }
    }
    for (let i = 0; i < this.bigN; i++) out[n++] = this.big[i];
    return n;
  }
}
