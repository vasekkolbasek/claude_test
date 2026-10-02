export interface V2 { x: number; z: number }

export const TAU = Math.PI * 2;

export function v2(x = 0, z = 0): V2 { return { x, z }; }
export function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function dist(a: V2, b: V2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function angleTo(from: V2, to: V2): number { return Math.atan2(to.x - from.x, to.z - from.z); }
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function approach(cur: number, target: number, step: number): number {
  return cur < target ? Math.min(cur + step, target) : Math.max(cur - step, target);
}

/** Closest point on segment ab to p; returns t in [0,1] and squared distance. */
export function closestOnSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { t: number; d2: number; x: number; z: number } {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t, z = az + dz * t;
  return { t, d2: dist2(px, pz, x, z), x, z };
}

/** True if segment p1-p2 intersects segment p3-p4. */
export function segmentsIntersect(
  p1x: number, p1z: number, p2x: number, p2z: number,
  p3x: number, p3z: number, p4x: number, p4z: number,
): boolean {
  const d1x = p2x - p1x, d1z = p2z - p1z, d2x = p4x - p3x, d2z = p4z - p3z;
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return false;
  const sx = p3x - p1x, sz = p3z - p1z;
  const t = (sx * d2z - sz * d2x) / den;
  const u = (sx * d1z - sz * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Polyline with cumulative lengths for distance-based sampling. */
export class Polyline {
  readonly pts: V2[];
  readonly cum: number[];
  readonly length: number;
  constructor(points: [number, number][]) {
    this.pts = points.map(([x, z]) => ({ x, z }));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + dist(this.pts[i - 1], this.pts[i]));
    this.length = this.cum[this.cum.length - 1];
  }
  /** Position and tangent at arc length s. */
  sample(s: number, out: { x: number; z: number; tx: number; tz: number }): typeof out {
    s = clamp(s, 0, this.length);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (s - this.cum[i - 1]) / seg;
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.tx = (b.x - a.x) / seg;
    out.tz = (b.z - a.z) / seg;
    return out;
  }
  /** Arc length of the closest point on the polyline to (x,z). */
  project(x: number, z: number): { s: number; d2: number } {
    let best = { s: 0, d2: Infinity };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const c = closestOnSegment(x, z, a.x, a.z, b.x, b.z);
      if (c.d2 < best.d2) best = { s: this.cum[i - 1] + c.t * (this.cum[i] - this.cum[i - 1]), d2: c.d2 };
    }
    return best;
  }
  distanceTo(x: number, z: number): number { return Math.sqrt(this.project(x, z).d2); }
}
