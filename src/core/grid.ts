/** Uniform spatial hash grid for fast neighbour queries on the ground plane. */
export interface GridItem { x: number; z: number; alive: boolean }

export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();
  private pool: T[][] = [];
  constructor(private cellSize = 4) {}
  private key(cx: number, cz: number): number { return ((cx + 512) << 10) | (cz + 512); }
  clear(): void {
    for (const arr of this.cells.values()) { arr.length = 0; this.pool.push(arr); }
    this.cells.clear();
  }
  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.z / this.cellSize));
    let arr = this.cells.get(k);
    if (!arr) { arr = this.pool.pop() ?? []; this.cells.set(k, arr); }
    arr.push(item);
  }
  /** Calls fn for every item within radius r of (x,z). Return true from fn to stop early. */
  query(x: number, z: number, r: number, fn: (item: T, d2: number) => boolean | void): void {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    const z0 = Math.floor((z - r) / cs), z1 = Math.floor((z + r) / cs);
    const r2 = r * r;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = this.cells.get(this.key(cx, cz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          if (!it.alive) continue;
          const dx = it.x - x, dz = it.z - z;
          const d2 = dx * dx + dz * dz;
          if (d2 <= r2 && fn(it, d2)) return;
        }
      }
    }
  }
  nearest(x: number, z: number, r: number, filter?: (item: T) => boolean): T | null {
    let best: T | null = null;
    let bd = Infinity;
    this.query(x, z, r, (it, d2) => {
      if (d2 < bd && (!filter || filter(it))) { bd = d2; best = it; }
    });
    return best;
  }
}
