import type { Texture } from 'pixi.js';
import type { QuadLayer } from './layer';
import { getAtlas, TS } from './textures';
import { hypot } from '../core/math';

class Fx {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  max = 1;
  size = 1;
  grow = 0;
  rot = 0;
  vr = 0;
  color = 0;
  tex: Texture | null = null;
  drag = 3;
  alpha = 1;
  /** stretch along velocity (sparks) */
  stretch = false;
}

/** A floating number: digits of `value`, with a leading «+» (heals) or a trailing «!» (crits). */
class Num {
  x = 0;
  y = 0;
  vy = 0;
  life = 0;
  value = 0;
  plus = false;
  crit = false;
  color = 0;
  big = false;
}

function digitCount(v: number): number {
  let n = 1;
  while (v >= 10) {
    v = Math.floor(v / 10);
    n++;
  }
  return n;
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
  private readonly freeNums: Num[] = [];
  private readonly bolts: Bolt[] = [];
  q: FxQuality = { maxParticles: 1400, density: 1, numbers: true };
  /** 0..1 thinning for crowded scenes (set by the view from the enemy count) */
  crowd = 1;
  /** digit textures 0–9, then «!», «+» */
  private glyphs: Texture[] | null = null;

  get count(): number {
    return this.list.length;
  }

  clear(): void {
    for (const f of this.list) this.free.push(f);
    this.list.length = 0;
    for (const m of this.nums) this.freeNums.push(m);
    this.nums.length = 0;
    this.bolts.length = 0;
  }

  /**
   * One particle. Extra parameters are positional (no options object: bursts spawn dozens a
   * frame); `rot` NaN = random. Particles are pooled.
   */
  spawn(tex: Texture, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, drag = 3, grow = 0, rot = NaN, vr = 0, stretch = false): void {
    const cap = this.q.maxParticles;
    const n = this.list.length;
    if (n >= cap) return;
    // past 60 % of the budget only every other cosmetic particle survives, so big fights
    // keep the important flashes (bosses, level-ups) instead of a wall of sparks
    if (n > cap * 0.6 && Math.random() < (n - cap * 0.6) / (cap * 0.4)) return;
    const f = this.free.pop() ?? new Fx();
    f.x = x;
    f.y = y;
    f.vx = vx;
    f.vy = vy;
    f.life = life;
    f.max = life;
    f.size = size;
    f.grow = grow;
    f.rot = rot === rot ? rot : Math.random() * 6.283;
    f.vr = vr;
    f.color = color;
    f.tex = tex;
    f.drag = drag;
    f.alpha = 1;
    f.stretch = stretch;
    this.list.push(f);
  }

  burst(x: number, y: number, color: number, count: number, speed: number, size = 1, life = 0.5): void {
    const t = getAtlas().tex;
    const n = Math.max(1, Math.round(count * this.q.density * this.crowd));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const s = speed * (0.35 + Math.random() * 0.9);
      if (i % 3 === 0) {
        this.spawn(t.shard, x, y, Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, life * (0.8 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), color, 2.5, 0, NaN, (Math.random() - 0.5) * 16);
      } else {
        this.spawn(t.spark, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.5 + Math.random() * 0.5), color, 4, 0, NaN, 0, true);
      }
    }
  }

  /** Soft glow; `radius` and `grow` in world units. */
  flare(x: number, y: number, color: number, radius: number, life = 0.25, grow = 0): void {
    this.spawn(getAtlas().tex.soft, x, y, 0, 0, life, radius / 15, color, 0, grow / 15, 0);
  }

  ring(x: number, y: number, color: number, radius: number, life = 0.4, thin = false): void {
    const t = getAtlas().tex;
    // expanding ring reaching `radius` (world units) at the end of its life
    const native = thin ? 28 : 58;
    this.spawn(thin ? t.thinring : t.ring, x, y, 0, 0, life, (radius * 0.15) / native, color, 0, (radius * 0.85) / native, 0);
  }

  number(x: number, y: number, value: number, crit: boolean, color = 0xffffff, big = false): void {
    if (!this.q.numbers) return;
    // keep the screen readable in big fights: thin out ordinary hits, always show crits
    const n = this.nums.length;
    if (!big && n > 14) {
      const skip = Math.min(0.92, (n - 14) / 22) * (crit ? 0.6 : 1);
      if (Math.random() < skip) return;
    }
    const v = Math.round(value);
    if (v <= 0) return;
    this.pushNum(x + (Math.random() - 0.5) * 10, y, -60, 0.7, v, false, crit, color, big);
  }

  /** «+N» above the player (heals). */
  plus(x: number, y: number, value: number, color: number): void {
    this.pushNum(x, y, -40, 1.1, Math.round(value), true, false, color, true);
  }

  private pushNum(x: number, y: number, vy: number, life: number, value: number, plus: boolean, crit: boolean, color: number, big: boolean): void {
    if (this.nums.length > 60) this.freeNums.push(this.nums.shift() as Num);
    const m = this.freeNums.pop() ?? new Num();
    m.x = x;
    m.y = y;
    m.vy = vy;
    m.life = life;
    m.value = value;
    m.plus = plus;
    m.crit = crit;
    m.color = color;
    m.big = big;
    this.nums.push(m);
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
      const len = hypot(dx, dy) || 1;
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
    // in-place compaction (splice would allocate an array per removed item)
    const nums = this.nums;
    const fade = Math.exp(-3 * dt);
    n = 0;
    for (let i = 0; i < nums.length; i++) {
      const m = nums[i];
      m.life -= dt;
      m.y += m.vy * dt;
      m.vy *= fade;
      if (m.life <= 0) this.freeNums.push(m);
      else nums[n++] = m;
    }
    nums.length = n;
    const bolts = this.bolts;
    n = 0;
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i];
      b.life -= dt;
      if (b.life > 0) bolts[n++] = b;
    }
    bolts.length = n;
  }

  draw(add: QuadLayer, nums: QuadLayer, zoom: number): void {
    const inv = 1 / TS;
    for (const f of this.list) {
      const k = f.life / f.max;
      const a = f.alpha * (k < 0.5 ? k * 2 : 1);
      const tex = f.tex as Texture;
      if (f.stretch) {
        const sp = hypot(f.vx, f.vy);
        const ang = Math.atan2(f.vy, f.vx);
        const len = Math.min(3, 0.4 + sp / 260);
        add.add(tex, f.x, f.y, f.size * len * inv, f.size * inv, ang, f.color, a);
      } else {
        add.add(tex, f.x, f.y, f.size * inv, f.size * inv, f.rot, f.color, a);
      }
    }
    const t = getAtlas().tex;
    if (!this.glyphs) this.glyphs = [...'0123456789!+'].map((ch) => t[`g_${ch}`]);
    const glyphs = this.glyphs;
    for (const b of this.bolts) {
      const k = b.life / b.max;
      const pts = b.pts;
      for (let i = 2; i < pts.length; i += 2) {
        const x0 = pts[i - 2];
        const y0 = pts[i - 1];
        const dx = pts[i] - x0;
        const dy = pts[i + 1] - y0;
        const len = hypot(dx, dy);
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
      // «+», the digits, «!» — laid out without building a string
      const digits = digitCount(m.value);
      const len = digits + (m.plus ? 1 : 0) + (m.crit ? 1 : 0);
      const startX = m.x - ((len - 1) * w) / 2;
      const color = m.crit ? 0xffd23d : m.color;
      let i = 0;
      if (m.plus) nums.add(glyphs[11], startX + i++ * w, m.y, s, s, 0, color, k);
      let div = 10 ** (digits - 1);
      for (let d = 0; d < digits; d++) {
        nums.add(glyphs[Math.floor(m.value / div) % 10], startX + i++ * w, m.y, s, s, 0, color, k);
        div /= 10;
      }
      if (m.crit) nums.add(glyphs[10], startX + i * w, m.y, s, s, 0, color, k);
    }
  }
}
