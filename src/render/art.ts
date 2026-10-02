import type { ShapeId } from '../data/types';
import { glowDot, neon, SHAPES, star } from './textures';

/** Procedural key art (store icon / cover) drawn with the same neon primitives as the game. */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#24104f');
  g.addColorStop(0.45, '#0e0628');
  g.addColorStop(1, '#03020a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // perspective grid floor + flat grid
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const step = Math.max(w, h) / 9;
  ctx.lineWidth = Math.max(1, w / 400);
  for (let x = -step; x < w + step; x += step) {
    const a = 0.12 + 0.18 * (1 - Math.abs(x - cx) / w);
    ctx.strokeStyle = `rgba(110,70,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = -step; y < h + step; y += step) {
    const a = 0.12 + 0.18 * (1 - Math.abs(y - cy) / h);
    ctx.strokeStyle = `rgba(110,70,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function dust(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, r: () => number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = (0.5 + r() * 1.8) * (w / 512);
    ctx.fillStyle = r() < 0.5 ? 'rgba(41,246,255,0.55)' : 'rgba(255,61,242,0.45)';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = s * 4;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function enemy(ctx: CanvasRenderingContext2D, x: number, y: number, shape: ShapeId, color: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = 'lighter';
  neon(ctx, () => SHAPES[shape](ctx, r), color, Math.max(2, r / 6), r * 0.7, 0.16);
  ctx.restore();
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, r * 2.4, 0x29f6ff, 0.12);
  ctx.beginPath();
  neon(ctx, () => ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2), 0xff3df2, r / 10, r * 0.6, 0);
  glowDot(ctx, r * 0.9, 0xffffff, 0.35);
  ctx.rotate(0.2);
  neon(ctx, () => star(ctx, 4, r * 1.15, r * 0.3), 0x29f6ff, r / 9, r * 0.7, 0.3);
  ctx.restore();
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(-len, 0, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, color);
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = len / 4;
  ctx.lineWidth = len / 7;
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = len / 18;
  ctx.beginPath();
  ctx.moveTo(-len * 0.6, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.restore();
}

function lightning(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, r: () => number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (let k = 1; k <= 4; k++) {
        const f = k / 4;
        const j = k === 4 ? 0 : (r() - 0.5) * width * 4;
        ctx.lineTo(x0 + (x1 - x0) * f + j, y0 + (y1 - y0) * f - j);
      }
    }
  };
  ctx.shadowColor = '#8fd8ff';
  ctx.shadowBlur = width * 4;
  ctx.strokeStyle = '#8fd8ff';
  ctx.lineWidth = width;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = width * 0.4;
  path();
  ctx.stroke();
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(2,0,10,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const SWARM: [ShapeId, number][] = [
  ['diamond', 0xff3df2],
  ['triangle', 0xb6ff3d],
  ['square', 0xff8a1f],
  ['hexagon', 0xa35bff],
  ['arrow', 0xff2a55],
  ['pentagon', 0x3dffb0],
  ['cross', 0x3dff6e],
  ['spikeball', 0xff5a1f],
  ['ringsquare', 0x3d7bff],
];

export function drawIcon(c: HTMLCanvasElement): void {
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const r = rng(11);
  const cx = w * 0.5;
  const cy = h * 0.52;
  background(ctx, w, h, cx, cy);
  dust(ctx, w, h, 60, r);
  const u = w / 512;
  // swarm closing in
  const placed: [number, number, number, number][] = [
    [0.16, 0.2, 34, 0.3],
    [0.83, 0.17, 30, 1.1],
    [0.88, 0.62, 38, 2.2],
    [0.13, 0.7, 36, 0.9],
    [0.52, 0.11, 26, 0.2],
    [0.7, 0.87, 30, 1.8],
    [0.3, 0.88, 26, 0.6],
    [0.05, 0.45, 24, 2.6],
    [0.95, 0.38, 22, 0.4],
  ];
  placed.forEach(([x, y, s, rot], i) => {
    const [shape, color] = SWARM[i % SWARM.length];
    enemy(ctx, x * w, y * h, shape, color, s * u, rot + Math.atan2(cy - y * h, cx - x * w));
  });
  // fire
  bolt(ctx, cx + 95 * u, cy - 70 * u, -0.62, 70 * u, '#29f6ff');
  bolt(ctx, cx - 100 * u, cy + 65 * u, 2.55, 64 * u, '#29f6ff');
  lightning(ctx, [[cx, cy], [0.83 * w, 0.17 * h]], 5 * u, r);
  // crystals
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = (120 + r() * 70) * u;
    enemy(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 'diamond', [0x29a8ff, 0x6dff8a, 0xffd23d][i % 3], 7 * u, a);
  }
  spark(ctx, cx, cy, 70 * u);
  vignette(ctx, w, h);
}

export function drawCover(c: HTMLCanvasElement, title: string, tagline: string): void {
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const r = rng(29);
  const u = h / 470;
  const px = w * 0.25;
  const py = h * 0.76;
  background(ctx, w, h, w * 0.45, h * 0.55);
  dust(ctx, w, h, 90, r);
  // the swarm closing in from the right
  const spots: [number, number, number][] = [
    [0.55, 0.62, 20], [0.62, 0.86, 26], [0.68, 0.55, 18], [0.74, 0.74, 30], [0.58, 0.42, 16],
    [0.92, 0.82, 28], [0.82, 0.58, 22], [0.96, 0.55, 18], [0.66, 0.24, 16], [0.52, 0.86, 18],
    [0.88, 0.96, 20], [0.79, 0.92, 16], [0.71, 0.4, 14], [0.98, 0.72, 24], [0.6, 0.98, 14],
  ];
  spots.forEach(([x, y, s], i) => {
    const [shape, color] = SWARM[i % SWARM.length];
    enemy(ctx, x * w, y * h, shape, color, s * u, r() * 6);
  });
  enemy(ctx, w * 0.84, h * 0.27, 'boss_core', 0xff2a55, 64 * u, 0.3);
  for (let i = 0; i < 4; i++) bolt(ctx, px + (90 + i * 70) * u, py - (24 + i * 30) * u, -0.38, 54 * u, '#29f6ff');
  lightning(ctx, [[px, py], [w * 0.55, h * 0.62], [w * 0.68, h * 0.55], [w * 0.74, h * 0.74]], 4 * u, r);
  spark(ctx, px, py, 46 * u);
  vignette(ctx, w, h);
  // title block, top-left
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const words = title.toUpperCase().split(' ');
  const size = (Math.max(...words.map((x) => x.length)) > 7 ? 70 : 82) * u;
  ctx.font = `italic 900 ${size}px "Exo 2", system-ui, sans-serif`;
  const tx = w * 0.055;
  let ty = h * 0.2;
  const colors = ['#29f6ff', '#ff3df2'];
  words.forEach((word, i) => {
    ctx.shadowColor = colors[i % 2];
    for (const blur of [40, 18, 6]) {
      ctx.shadowBlur = blur * u;
      ctx.fillStyle = i % 2 ? '#ffe9fd' : '#e9fdff';
      ctx.fillText(word, tx, ty);
    }
    ty += size * 0.92;
  });
  ctx.shadowBlur = 8 * u;
  ctx.shadowColor = '#000';
  ctx.font = `700 ${15 * u}px "Exo 2", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(210,220,255,0.9)';
  ctx.fillText(tagline.toUpperCase().split('').join('\u2009'), tx + 6 * u, ty - size * 0.45);
  ctx.restore();
}
