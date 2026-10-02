import { Rectangle, Texture } from 'pixi.js';
import type { ShapeId } from '../data/types';

/** Pixels per world unit baked into the atlas. */
export const TS = 2;

type Draw = (ctx: CanvasRenderingContext2D) => void;

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
  );
}

/** Shelf-packed canvas atlas. */
class AtlasBuilder {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private x = 0;
  private y = 0;
  private rowH = 0;
  readonly frames = new Map<string, Frame>();

  constructor(readonly size: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  /** Reserves w×h px and draws with the origin at the frame centre. */
  add(name: string, w: number, h: number, draw: Draw): void {
    w = Math.ceil(w);
    h = Math.ceil(h);
    const pad = 2;
    if (this.x + w + pad > this.size) {
      this.x = 0;
      this.y += this.rowH + pad;
      this.rowH = 0;
    }
    if (this.y + h > this.size) {
      console.warn('atlas overflow', name);
      return;
    }
    const f = { x: this.x, y: this.y, w, h };
    this.frames.set(name, f);
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, w, h);
    ctx.clip();
    ctx.translate(f.x + w / 2, f.y + h / 2);
    draw(ctx);
    ctx.restore();
    this.x += w + pad;
    this.rowH = Math.max(this.rowH, h);
  }
}

// ------------------------------------------------------------------ shape paths (unit radius)

type PathFn = (ctx: CanvasRenderingContext2D, r: number) => void;

function poly(ctx: CanvasRenderingContext2D, pts: number[], r: number): void {
  ctx.moveTo(pts[0] * r, pts[1] * r);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * r, pts[i + 1] * r);
  ctx.closePath();
}

function ngon(ctx: CanvasRenderingContext2D, n: number, r: number, rot = 0): void {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, n: number, r1: number, r2: number, rot = -Math.PI / 2): void {
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? r1 : r2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

const SHAPES: Record<ShapeId, PathFn> = {
  diamond: (c, r) => poly(c, [0, -1, 0.78, 0, 0, 1, -0.78, 0], r),
  triangle: (c, r) => poly(c, [1, 0, -0.75, 0.72, -0.35, 0, -0.75, -0.72], r),
  square: (c, r) => {
    poly(c, [-0.8, -0.8, 0.8, -0.8, 0.8, 0.8, -0.8, 0.8], r);
    poly(c, [-0.38, -0.38, 0.38, -0.38, 0.38, 0.38, -0.38, 0.38], r);
  },
  arrow: (c, r) => poly(c, [1.05, 0, -0.8, 0.85, -0.3, 0, -0.8, -0.85], r),
  hexagon: (c, r) => {
    ngon(c, 6, r);
    c.moveTo(r * 0.28, 0);
    c.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  },
  pentagon: (c, r) => {
    ngon(c, 5, r, -Math.PI / 2);
    star(c, 5, r * 0.55, r * 0.22);
  },
  shardtri: (c, r) => poly(c, [1, 0, -0.6, 0.8, -0.6, -0.8], r),
  ringsquare: (c, r) => {
    poly(c, [0, -0.85, 0.85, 0, 0, 0.85, -0.85, 0], r);
    poly(c, [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], r);
  },
  glitch: (c, r) => {
    poly(c, [-0.9, -0.6, 0.3, -0.6, 0.3, 0.3, -0.9, 0.3], r);
    poly(c, [-0.3, -0.3, 0.9, -0.3, 0.9, 0.7, -0.3, 0.7], r);
  },
  cross: (c, r) =>
    poly(c, [-0.3, -0.9, 0.3, -0.9, 0.3, -0.3, 0.9, -0.3, 0.9, 0.3, 0.3, 0.3, 0.3, 0.9, -0.3, 0.9, -0.3, 0.3, -0.9, 0.3, -0.9, -0.3, -0.3, -0.3], r),
  dot: (c, r) => {
    c.moveTo(r * 0.8, 0);
    c.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  },
  spikeball: (c, r) => {
    star(c, 8, r, r * 0.6);
    c.moveTo(r * 0.3, 0);
    c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  },
  bighex: (c, r) => {
    ngon(c, 6, r, Math.PI / 6);
    ngon(c, 6, r * 0.62, 0);
    ngon(c, 6, r * 0.28, Math.PI / 6);
  },
  stealth: (c, r) => poly(c, [1.1, 0, 0, 0.55, -0.9, 0.9, -0.5, 0, -0.9, -0.9, 0, -0.55], r),
  mb_trojan: (c, r) => {
    poly(c, [-0.85, -0.85, 0.85, -0.85, 0.85, 0.85, -0.85, 0.85], r);
    poly(c, [0, -0.62, 0.62, 0, 0, 0.62, -0.62, 0], r);
    poly(c, [-0.22, -0.22, 0.22, -0.22, 0.22, 0.22, -0.22, 0.22], r);
  },
  mb_crypto: (c, r) => {
    ngon(c, 8, r, Math.PI / 8);
    c.moveTo(r * 0.45, 0);
    c.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    poly(c, [-0.12, -0.15, 0.12, -0.15, 0.2, 0.32, -0.2, 0.32], r);
  },
  mb_hydra: (c, r) => {
    star(c, 3, r, r * 0.35);
    star(c, 3, r * 0.75, r * 0.3, Math.PI / 2);
    c.moveTo(r * 0.18, 0);
    c.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  },
  boss_core: (c, r) => {
    star(c, 12, r, r * 0.82);
    c.moveTo(r * 0.66, 0);
    c.arc(0, 0, r * 0.66, 0, Math.PI * 2);
    ngon(c, 6, r * 0.42, Math.PI / 6);
    c.moveTo(r * 0.2, 0);
    c.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  },
};

/** Neon stroke: coloured glow + coloured line + hot white core. */
function neon(ctx: CanvasRenderingContext2D, path: () => void, color: number, line: number, glow: number, fillAlpha = 0.14): void {
  const c = hex(color);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fillAlpha > 0) {
    ctx.beginPath();
    path();
    ctx.fillStyle = c;
    ctx.globalAlpha = fillAlpha;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = c;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = c;
  ctx.lineWidth = line;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    path();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hex(mix(color, 0xffffff, 0.75));
  ctx.lineWidth = line * 0.42;
  ctx.beginPath();
  path();
  ctx.stroke();
}

function glowDot(ctx: CanvasRenderingContext2D, r: number, color: number, core = 0.35): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  const c = mix(color, 0xffffff, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(core, hex(c));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ atlas contents

export interface Atlas {
  tex: Record<string, Texture>;
  source: Texture;
  grid: Texture;
  dust: Texture;
}

export interface EnemyArt {
  id: string;
  shape: ShapeId;
  color: number;
  r: number;
}

let atlas: Atlas | null = null;

export function getAtlas(): Atlas {
  if (!atlas) throw new Error('atlas not built');
  return atlas;
}

export function buildAtlas(enemies: readonly EnemyArt[]): Atlas {
  const big = new AtlasBuilder(2048);
  const line = 2.1 * TS;
  const glow = 9 * TS;

  // enemies: normal + white flash variant
  for (const e of enemies) {
    const r = e.r * TS;
    const isBoss = e.r > 30;
    const lw = isBoss ? line * 1.5 : line;
    const gl = isBoss ? glow * 1.6 : glow;
    const size = r * 2.35 + gl * 2;
    const path = SHAPES[e.shape];
    big.add(`e_${e.id}`, size, size, (ctx) => neon(ctx, () => path(ctx, r), e.color, lw, gl));
    big.add(`e_${e.id}_f`, size, size, (ctx) => neon(ctx, () => path(ctx, r), 0xffffff, lw * 1.3, gl, 0.5));
  }

  // player: four-point spark star + core
  {
    const r = 15 * TS;
    const size = r * 2.6 + glow * 2;
    big.add('player', size, size, (ctx) => {
      glowDot(ctx, r * 0.95, 0x29f6ff, 0.25);
      neon(ctx, () => star(ctx, 4, r * 1.05, r * 0.32), 0x29f6ff, line * 1.1, glow * 1.2, 0.25);
    });
    big.add('player_ring', size, size, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      neon(ctx, () => ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2), 0xff3df2, line * 0.8, glow, 0);
    });
    big.add('chevron', 14 * TS + glow * 2, 14 * TS + glow * 2, (ctx) =>
      neon(ctx, () => poly(ctx, [0.6, 0, -0.5, 0.7, -0.15, 0, -0.5, -0.7], 6 * TS), 0xffffff, line * 0.9, glow * 0.7, 0.3),
    );
  }

  // generic glow sprites (white, tinted at runtime)
  big.add('orb', 32 * TS, 32 * TS, (ctx) => glowDot(ctx, 15 * TS, 0xffffff, 0.3));
  big.add('soft', 32 * TS, 32 * TS, (ctx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 15 * TS);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-16 * TS, -16 * TS, 32 * TS, 32 * TS);
  });
  big.add('spark', 24 * TS, 8 * TS, (ctx) => {
    const g = ctx.createLinearGradient(-12 * TS, 0, 12 * TS, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 3 * TS;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * TS, 1.6 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  big.add('shard', 14 * TS, 14 * TS, (ctx) =>
    neon(ctx, () => poly(ctx, [1, 0, -0.7, 0.75, -0.7, -0.75], 4.5 * TS), 0xffffff, line * 0.7, 3 * TS, 0.5),
  );
  big.add('ring', 128 * TS, 128 * TS, (ctx) => {
    const r = 58 * TS;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6 * TS;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.6 * TS;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  });
  big.add('thinring', 64 * TS, 64 * TS, (ctx) => {
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 4 * TS;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.4 * TS;
    ctx.beginPath();
    ctx.arc(0, 0, 28 * TS, 0, Math.PI * 2);
    ctx.stroke();
  });
  big.add('beam', 32, 24 * TS, (ctx) => {
    const h = 12 * TS;
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.45, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-16, -h, 32, h * 2);
  });
  big.add('px', 8, 8, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, -4, 8, 8);
  });

  // projectiles
  big.add('bolt', 30 * TS, 14 * TS, (ctx) => {
    ctx.shadowColor = hex(0x29f6ff);
    ctx.shadowBlur = 5 * TS;
    ctx.fillStyle = hex(0x29f6ff);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * TS, 3.6 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(1.5 * TS, 0, 8 * TS, 1.7 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  big.add('bolt_evo', 36 * TS, 18 * TS, (ctx) => {
    ctx.shadowColor = '#bff9ff';
    ctx.shadowBlur = 7 * TS;
    ctx.fillStyle = '#9ff6ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13 * TS, 5 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(1.5 * TS, 0, 10 * TS, 2.8 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  big.add('dbolt', 18 * TS, 10 * TS, (ctx) => {
    ctx.shadowColor = hex(0x7d8cff);
    ctx.shadowBlur = 4 * TS;
    ctx.fillStyle = hex(0x9da8ff);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5 * TS, 2.4 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(1 * TS, 0, 4.4 * TS, 1.1 * TS, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  big.add('missile', 26 * TS, 18 * TS, (ctx) =>
    neon(ctx, () => poly(ctx, [1, 0, -0.6, 0.55, -0.35, 0, -0.6, -0.55], 7 * TS), 0xff9a3d, line * 0.9, 4 * TS, 0.6),
  );
  big.add('blade', 34 * TS, 34 * TS, (ctx) =>
    neon(ctx, () => star(ctx, 4, 12 * TS, 3.6 * TS, 0), 0xff3df2, line * 0.9, 6 * TS, 0.35),
  );
  big.add('blade_evo', 40 * TS, 40 * TS, (ctx) =>
    neon(ctx, () => star(ctx, 6, 14 * TS, 4.5 * TS, 0), 0xff9df9, line, 8 * TS, 0.45),
  );
  big.add('drone', 30 * TS, 30 * TS, (ctx) => {
    neon(ctx, () => poly(ctx, [1, 0, -0.7, 0.8, -0.35, 0, -0.7, -0.8], 9 * TS), 0x7d8cff, line * 0.9, 5 * TS, 0.4);
    glowDot(ctx, 3 * TS, 0xffffff, 0.5);
  });
  big.add('drone_evo', 34 * TS, 34 * TS, (ctx) => {
    neon(ctx, () => poly(ctx, [1, 0, -0.7, 0.8, -0.35, 0, -0.7, -0.8], 10.5 * TS), 0xb9c2ff, line, 6 * TS, 0.5);
    glowDot(ctx, 3.6 * TS, 0xffffff, 0.5);
  });
  big.add('mine', 30 * TS, 30 * TS, (ctx) => {
    neon(ctx, () => star(ctx, 6, 8 * TS, 5.5 * TS), 0xffd23d, line * 0.9, 5 * TS, 0.3);
    glowDot(ctx, 2.6 * TS, 0xffd23d, 0.4);
  });

  // pickups
  const gemColors = [0x29a8ff, 0x6dff8a, 0xffd23d, 0xff3df2];
  gemColors.forEach((c, i) => {
    const r = (5 + i * 1.6) * TS;
    big.add(`gem${i}`, r * 2.6 + 8 * TS, r * 2.6 + 8 * TS, (ctx) =>
      neon(ctx, () => poly(ctx, [0, -1.25, 0.75, 0, 0, 1.25, -0.75, 0], r), c, line * 0.75, 4.5 * TS, 0.45),
    );
  });
  big.add('heal', 34 * TS, 34 * TS, (ctx) =>
    neon(ctx, () => SHAPES.cross(ctx, 10 * TS), 0x6dff8a, line, 6 * TS, 0.4),
  );
  big.add('magnet', 36 * TS, 36 * TS, (ctx) => {
    neon(ctx, () => {
      ctx.arc(0, 0, 9 * TS, Math.PI * 0.05, Math.PI * 0.95, false);
    }, 0x29a8ff, line * 1.6, 6 * TS, 0);
    neon(ctx, () => {
      ctx.moveTo(-8.5 * TS, 1 * TS);
      ctx.lineTo(-8.5 * TS, -7 * TS);
      ctx.moveTo(8.5 * TS, 1 * TS);
      ctx.lineTo(8.5 * TS, -7 * TS);
    }, 0xff4d6d, line * 1.6, 6 * TS, 0);
  });
  big.add('chest', 50 * TS, 50 * TS, (ctx) => {
    glowDot(ctx, 22 * TS, 0xffb52e, 0.15);
    neon(ctx, () => ngon(ctx, 6, 14 * TS, Math.PI / 6), 0xffd23d, line * 1.2, 8 * TS, 0.35);
    neon(ctx, () => ngon(ctx, 6, 7 * TS, 0), 0xffffff, line, 4 * TS, 0.3);
  });
  big.add('ebullet', 26 * TS, 26 * TS, (ctx) => {
    glowDot(ctx, 11 * TS, 0xffffff, 0.35);
  });

  // damage number glyphs
  const glyphs = '0123456789!+';
  for (const ch of glyphs) {
    big.add(`g_${ch}`, 26, 36, (ctx) => {
      ctx.font = '800 30px "Exo 2", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(10,4,30,0.9)';
      ctx.strokeText(ch, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(ch, 0, 1);
    });
  }

  const base = Texture.from(big.canvas);
  base.source.scaleMode = 'linear';
  const tex: Record<string, Texture> = {};
  for (const [name, f] of big.frames) {
    tex[name] = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
  }

  atlas = { tex, source: base, grid: buildGrid(), dust: buildDust() };
  return atlas;
}

function buildGrid(): Texture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const p = i * 64 + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(1, size);
  ctx.moveTo(0, 1);
  ctx.lineTo(size, 1);
  ctx.stroke();
  // node dots at major intersections
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(1, 1, 3, 0, Math.PI * 2);
  ctx.fill();
  const t = Texture.from(c);
  t.source.addressMode = 'repeat';
  return t;
}

function buildDust(): Texture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.6 + rnd() * 1.6;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few circuit traces
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    let x = Math.round((rnd() * size) / 32) * 32;
    let y = Math.round((rnd() * size) / 32) * 32;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rnd() * 3));
      else y += (rnd() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rnd() * 3));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  const t = Texture.from(c);
  t.source.addressMode = 'repeat';
  return t;
}

/** Draws a standalone icon of an enemy shape onto a 2D canvas (for Codex / UI). */
export function drawShapeIcon(canvas: HTMLCanvasElement, shape: ShapeId, color: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const r = s * 0.3;
  neon(ctx, () => SHAPES[shape](ctx, r), color, Math.max(2, s / 28), s / 10);
  ctx.restore();
}
