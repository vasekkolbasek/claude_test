import { Polyline, smoothstep, clamp } from '../core/math';
import { makeNoise2 } from '../core/rng';
import { BUILD_RADIUS } from '../data/buildings';
import type { MapDef } from '../data/maps';

export const WATER_LEVEL = 0;
export const GROUND_LEVEL = 0.3;

/** Pure height function of a map + cached grid for fast runtime sampling. */
export class Heightfield {
  readonly ext: number;
  private noise: (x: number, z: number) => number;
  private noise2: (x: number, z: number) => number;
  private paths: Polyline[];
  private rivers: { line: Polyline; w: number }[];
  private grid: Float32Array;
  private readonly res = 0.5;
  private readonly n: number;

  constructor(readonly map: MapDef) {
    this.ext = map.half + 22;
    this.noise = makeNoise2(map.seed);
    this.noise2 = makeNoise2(map.seed * 7 + 3);
    this.paths = map.paths.map((p) => new Polyline(p));
    this.rivers = map.terrain.rivers.map((r) => ({ line: new Polyline(r.pts), w: r.w }));
    this.n = Math.ceil((this.ext * 2) / this.res) + 1;
    this.grid = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) this.grid[j * this.n + i] = this.compute(-this.ext + i * this.res, -this.ext + j * this.res);
    }
  }

  /** Exact (slow) height. */
  compute(x: number, z: number): number {
    const t = this.map.terrain;
    const half = this.map.half;
    let h = this.noise(x * 0.06, z * 0.06) * t.noise + this.noise2(x * 0.17, z * 0.17) * t.noise * 0.12 + GROUND_LEVEL;
    for (const [hx, hz, r, hh] of t.hills) {
      const d2 = (x - hx) ** 2 + (z - hz) ** 2;
      h += hh * Math.exp((-d2 / (r * r)) * 1.6) * (0.85 + 0.15 * this.noise2(x * 0.3, z * 0.3));
    }
    const m = Math.max(Math.abs(x), Math.abs(z));
    h += t.edge * smoothstep(half - 3, half + 12, m) * (0.65 + 0.35 * this.noise(x * 0.11 + 9, z * 0.11));
    // Flatten building areas and paths.
    let f = 0;
    for (const p of this.paths) {
      const d = p.distanceTo(x, z);
      f = Math.max(f, 1 - smoothstep(2.4, 6, d));
    }
    for (const s of this.map.slots) {
      if (s.x === undefined || s.z === undefined) continue;
      const r = BUILD_RADIUS[s.kind];
      const d = Math.hypot(x - s.x, z - s.z);
      f = Math.max(f, 1 - smoothstep(r + 1.2, r + 4, d));
    }
    if (f > 0) h = h + (GROUND_LEVEL + this.noise2(x * 0.3, z * 0.3) * 0.05 - h) * f;
    // Carve water.
    for (const [px, pz, r] of t.ponds) {
      const d = Math.hypot(x - px, z - pz);
      const k = smoothstep(r - 1.8, r + 1.2, d);
      h = Math.min(h, -1.3 + (h + 1.3) * k);
    }
    for (const rv of this.rivers) {
      const d = rv.line.distanceTo(x, z);
      const k = smoothstep(rv.w / 2 - 1.4, rv.w / 2 + 1.4, d);
      h = Math.min(h, -1.3 + (h + 1.3) * k);
    }
    return h;
  }

  /** Fast bilinear sample from the cached grid. */
  height(x: number, z: number): number {
    const fx = clamp((x + this.ext) / this.res, 0, this.n - 1.001);
    const fz = clamp((z + this.ext) / this.res, 0, this.n - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const g = this.grid, n = this.n;
    const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }

  onBridge(x: number, z: number): boolean {
    for (const b of this.map.bridges) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = (x - b.x) * c - (z - b.z) * s;
      const lz = (x - b.x) * s + (z - b.z) * c;
      if (Math.abs(lx) < b.len / 2 && Math.abs(lz) < 1.8) return true;
    }
    return false;
  }

  walkable(x: number, z: number): boolean {
    const lim = this.map.half - 1;
    if (Math.abs(x) > lim || Math.abs(z) > lim) return false;
    const h = this.height(x, z);
    if (h < -0.35) return this.onBridge(x, z);
    return h < 2.6;
  }
}
