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
  private readonly used: number[] = [];
  private readonly mask: number;
  private readonly big: T[] = [];
  private stamp = 1;
  readonly inv: number;
  readonly bigR: number;

  constructor(readonly cell = 64, tableSize = 4096) {
    this.mask = tableSize - 1;
    this.inv = 1 / cell;
    this.bigR = cell * 0.5;
    this.buckets = new Array(tableSize);
    for (let i = 0; i < tableSize; i++) this.buckets[i] = [];
  }

  private key(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  clear(): void {
    for (let i = 0; i < this.used.length; i++) this.buckets[this.used[i]].length = 0;
    this.used.length = 0;
    this.big.length = 0;
  }

  insert(o: T): void {
    if (o.r > this.bigR) {
      this.big.push(o);
      return;
    }
    const k = this.key(Math.floor(o.x * this.inv), Math.floor(o.y * this.inv));
    const b = this.buckets[k];
    if (b.length === 0) this.used.push(k);
    b.push(o);
  }

  /** Collects candidate items whose centre lies within `r + bigR` of (x, y). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const s = ++this.stamp;
    const rr = r + this.bigR;
    const x0 = Math.floor((x - rr) * this.inv);
    const x1 = Math.floor((x + rr) * this.inv);
    const y0 = Math.floor((y - rr) * this.inv);
    const y1 = Math.floor((y + rr) * this.inv);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[this.key(cx, cy)];
        for (let i = 0; i < b.length; i++) {
          const o = b[i];
          if (o._q !== s) {
            o._q = s;
            out.push(o);
          }
        }
      }
    }
    for (let i = 0; i < this.big.length; i++) out.push(this.big[i]);
    return out;
  }
}
