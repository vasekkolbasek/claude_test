import type { Texture } from 'pixi.js';
import type { QuadLayer } from './layer';
import { getAtlas, TS } from './textures';

interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  rot: number;
  vr: number;
  color: number;
  tex: Texture;
  drag: number;
  alpha: number;
  /** stretch along velocity (sparks) */
  stretch: boolean;
}

interface Num {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  crit: boolean;
  color: number;
  big: boolean;
}

interface Bolt {
  pts: number[];
  life: number;
  max: number;
  color: number;
  width: number;
}

export interface FxQuality {
  maxParticles: number;
  /** multiplier for burst sizes */
  density: number;
  numbers: boolean;
}

/** Visual-only particle system (sparks, shards, rings, damage numbers, lightning). */
export class FxSystem {
  private readonly list: Fx[] = [];
  private readonly free: Fx[] = [];
  private readonly nums: Num[] = [];
  private readonly bolts: Bolt[] = [];
  q: FxQuality = { maxParticles: 1400, density: 1, numbers: true };

  get count(): number {
    return this.list.length;
  }

  clear(): void {
    for (const f of this.list) this.free.push(f);
    this.list.length = 0;
    this.nums.length = 0;
    this.bolts.length = 0;
  }

  spawn(tex: Texture, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, opts?: Partial<Fx>): void {
    if (this.list.length >= this.q.maxParticles) return;
    const f =
      this.free.pop() ??
      ({} as Fx);
    f.x = x;
    f.y = y;
    f.vx = vx;
    f.vy = vy;
    f.life = life;
    f.max = life;
    f.size = size;
    f.grow = opts?.grow ?? 0;
    f.rot = opts?.rot ?? Math.random() * 6.283;
    f.vr = opts?.vr ?? 0;
    f.color = color;
    f.tex = tex;
    f.drag = opts?.drag ?? 3;
    f.alpha = opts?.alpha ?? 1;
    f.stretch = opts?.stretch ?? false;
    this.list.push(f);
  }

  burst(x: number, y: number, color: number, count: number, speed: number, size = 1, life = 0.5): void {
    const t = getAtlas().tex;
    const n = Math.max(1, Math.round(count * this.q.density));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = speed * (0.35 + Math.random() * 0.9);
      if (i % 3 === 0) {
        this.spawn(t.shard, x, y, Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, life * (0.8 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), color, {
          vr: (Math.random() - 0.5) * 16,
          drag: 2.5,
        });
      } else {
        this.spawn(t.spark, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.5 + Math.random() * 0.5), color, {
          stretch: true,
          drag: 4,
        });
      }
    }
  }

  /** Soft glow; `radius` and `grow` in world units. */
  flare(x: number, y: number, color: number, radius: number, life = 0.25, grow = 0): void {
    this.spawn(getAtlas().tex.soft, x, y, 0, 0, life, radius / 15, color, { grow: grow / 15, drag: 0, rot: 0 });
  }

  ring(x: number, y: number, color: number, radius: number, life = 0.4, thin = false): void {
    const t = getAtlas().tex;
    // expanding ring reaching `radius` (world units) at the end of its life
    const native = thin ? 28 : 58;
    this.spawn(thin ? t.thinring : t.ring, x, y, 0, 0, life, (radius * 0.15) / native, color, { grow: (radius * 0.85) / native, drag: 0, rot: 0 });
  }

  number(x: number, y: number, value: number, crit: boolean, color = 0xffffff, big = false): void {
    if (!this.q.numbers) return;
    // keep the screen readable in big fights: thin out ordinary hits, always show crits
    if (this.nums.length > 24 && !crit && !big && Math.random() < Math.min(0.85, (this.nums.length - 24) / 30)) return;
    if (this.nums.length > 60) this.nums.shift();
    const v = Math.round(value);
    if (v <= 0) return;
    this.nums.push({ x: x + (Math.random() - 0.5) * 10, y, vy: -60, life: 0.7, text: crit ? `${v}!` : `${v}`, crit, color, big });
  }

  text(x: number, y: number, text: string, color: number): void {
    this.nums.push({ x, y, vy: -40, life: 1.1, text, crit: false, color, big: true });
  }

  bolt(pts: number[], color: number, width: number): void {
    // jitter each segment into a jagged path once
    const out: number[] = [pts[0], pts[1]];
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2];
      const y0 = pts[i - 1];
      const x1 = pts[i];
      const y1 = pts[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const k = Math.max(2, Math.min(6, Math.round(len / 28)));
      for (let j = 1; j < k; j++) {
        const f = j / k;
        const off = (Math.random() - 0.5) * Math.min(26, len * 0.3);
        out.push(x0 + dx * f + nx * off, y0 + dy * f + ny * off);
      }
      out.push(x1, y1);
    }
    this.bolts.push({ pts: out, life: 0.22, max: 0.22, color, width });
  }

  update(dt: number): void {
    const list = this.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.free.push(f);
        continue;
      }
      const d = Math.exp(-f.drag * dt);
      f.vx *= d;
      f.vy *= d;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.size += f.grow * dt / f.max;
      list[n++] = f;
    }
    list.length = n;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const m = this.nums[i];
      m.life -= dt;
      m.y += m.vy * dt;
      m.vy *= Math.exp(-3 * dt);
      if (m.life <= 0) this.nums.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) this.bolts.splice(i, 1);
    }
  }

  draw(add: QuadLayer, nums: QuadLayer, zoom: number): void {
    const inv = 1 / TS;
    for (const f of this.list) {
      const k = f.life / f.max;
      const a = f.alpha * (k < 0.5 ? k * 2 : 1);
      if (f.stretch) {
        const sp = Math.hypot(f.vx, f.vy);
        const ang = Math.atan2(f.vy, f.vx);
        const len = Math.min(3, 0.4 + sp / 260);
        add.add(f.tex, f.x, f.y, f.size * len * inv, f.size * inv, ang, f.color, a);
      } else {
        add.add(f.tex, f.x, f.y, f.size * inv, f.size * inv, f.rot, f.color, a);
      }
    }
    const t = getAtlas().tex;
    for (const b of this.bolts) {
      const k = b.life / b.max;
      const pts = b.pts;
      for (let i = 2; i < pts.length; i += 2) {
        const x0 = pts[i - 2];
        const y0 = pts[i - 1];
        const dx = pts[i] - x0;
        const dy = pts[i + 1] - y0;
        const len = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        add.add(t.beam, x0, y0, len / 32, (b.width * 2.4 * (0.6 + k * 0.4)) / (24 * TS), ang, b.color, k, 0, 0.5);
        add.add(t.beam, x0, y0, len / 32, (b.width * 0.9) / (24 * TS), ang, 0xffffff, k, 0, 0.5);
      }
    }
    // damage numbers keep a constant on-screen size
    const px = 1 / zoom;
    for (const m of this.nums) {
      const k = Math.min(1, m.life / 0.25);
      const pop = m.life > 0.62 ? 1 + (m.life - 0.62) * 4 : 1;
      const h = (m.big ? 22 : m.crit ? 19 : 14) * px * pop;
      const s = h / 36;
      const w = 18 * s;
      const startX = m.x - ((m.text.length - 1) * w) / 2;
      const color = m.crit ? 0xffd23d : m.color;
      for (let i = 0; i < m.text.length; i++) {
        const g = t[`g_${m.text[i]}`];
        if (g) nums.add(g, startX + i * w, m.y, s, s, 0, color, k);
      }
    }
  }
}
