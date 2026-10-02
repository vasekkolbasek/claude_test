import type { App } from '../../app/App';
import { hex } from '../../render/textures';
import { t } from '../../i18n';
import { fmtNum, h } from '../dom';
import { icon } from '../icons';

export function bitsPill(n: number): HTMLElement {
  return h('div', { cls: 'bits-pill' }, icon('bits'), h('span', { text: fmtNum(n) }));
}

export function setBits(pill: HTMLElement, n: number): void {
  const span = pill.querySelector('span');
  if (span) span.textContent = fmtNum(n);
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
}

export function topbar(app: App, title: string, onBack: () => void, right?: HTMLElement | null): HTMLElement {
  return h(
    'div',
    { cls: 'topbar' },
    h('button', { cls: 'btn icon-only', attrs: { 'aria-label': t('common.back') }, onClick: onBack }, icon('back')),
    h('h2', { text: title }),
    right === undefined ? bitsPill(app.save.data.bits) : right,
  );
}

/** Draws a character's "program" glyph (a 4-point spark in its colour). */
export function charCanvas(color: number, size = 84): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.translate(size / 2, size / 2);
  const r = size * 0.36;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.3, hex(color));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = hex(color);
  ctx.shadowBlur = size / 8;
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = size / 30;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 1.15 : r * 0.36;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size / 80;
  ctx.stroke();
  return c;
}

export function videoLabel(text: string): (Node | string)[] {
  return [icon('video', 'video'), text];
}
