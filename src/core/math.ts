export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Deterministic, fast PRNG (mulberry32). */
/**
 * `Math.hypot(x, y)`, bit for bit: the same steps as V8's builtin (scale by the larger magnitude,
 * Kahan sum, square root). V8 never inlines the builtin, and every call allocated a scratch
 * array and boxed its arguments — hundreds of thousands of times a second in a big fight. A plain
 * `Math.sqrt(x * x + y * y)` would differ in the last bit and the deterministic simulation would
 * drift, so the algorithm is reproduced exactly (see perf-invariants.test.ts).
 */
export function hypot(x: number, y: number): number {
  const xNaN = x !== x;
  const yNaN = y !== y;
  const ax = xNaN ? 0 : Math.abs(x);
  const ay = yNaN ? 0 : Math.abs(y);
  let max = 0;
  if (ax > max) max = ax;
  if (ay > max) max = ay;
  if (max === Infinity) return Infinity;
  if (xNaN || yNaN) return NaN;
  if (max === 0) return 0;
  let sum = 0;
  let compensation = 0;
  let n = ax / max;
  let summand = n * n - compensation;
  let preliminary = sum + summand;
  compensation = preliminary - sum - summand;
  sum = preliminary;
  n = ay / max;
  summand = n * n - compensation;
  preliminary = sum + summand;
  sum = preliminary;
  return Math.sqrt(sum) * max;
}

export class Rng {
  /** mulberry32 state; a typed array keeps the uint32 unboxed (a plain field above 2^30 makes V8
   *  allocate a heap number on every call) — the sequence is exactly the same */
  private readonly s = new Uint32Array(1);
  constructor(seed = Date.now() >>> 0) {
    this.s[0] = seed >>> 0;
  }
  next(): number {
    this.s[0] += 0x6d2b79f5;
    let t = this.s[0];
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hiInclusive: number): number {
    return lo + Math.floor(this.next() * (hiInclusive - lo + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  angle(): number {
    return this.next() * TAU;
  }
  /** Picks an index by weights. Returns -1 when all weights are 0. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`;
}
