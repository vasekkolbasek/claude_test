import { h } from './dom';
import { icon } from './icons';

export interface PagerOptions {
  /** minimal item width in px; decides the number of columns */
  minItemW: number;
  maxCols?: number;
  /** fixed number of rows (otherwise as many as fit) */
  rows?: number;
  gap?: number;
  /** page to open first */
  start?: number;
  onPage?: (page: number) => void;
}

/**
 * Lays items out in pages that exactly fit the available area — never a vertical scroll.
 * Pages are flipped horizontally with the arrows, the dots, a swipe or ←/→ on a keyboard.
 * The layout is rebuilt whenever the area changes size (rotation, resize).
 */
export class Pager {
  readonly el: HTMLElement;
  private readonly view: HTMLElement;
  private readonly track: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private pages = 1;
  private page = 0;
  private lastW = -1;
  private lastH = -1;
  private ro: ResizeObserver | null = null;

  constructor(
    private items: HTMLElement[],
    private readonly o: PagerOptions,
  ) {
    this.page = o.start ?? 0;
    this.track = h('div', { cls: 'pg-track' });
    this.view = h('div', { cls: 'pg-view' }, this.track);
    this.prev = h('button', { cls: 'btn icon-only pg-arrow', attrs: { 'aria-label': '‹' }, onClick: () => this.go(this.page - 1) }, icon('back'));
    this.next = h('button', { cls: 'btn icon-only pg-arrow pg-next', attrs: { 'aria-label': '›' }, onClick: () => this.go(this.page + 1) }, icon('back'));
    this.dots = h('div', { cls: 'pg-dots' });
    this.nav = h('div', { cls: 'pg-nav' }, this.prev, this.dots, this.next);
    this.el = h('div', { cls: 'pager' }, this.view, this.nav);
    this.wireSwipe();
    const relayout = () => {
      if (!this.el.isConnected) return;
      const w = this.view.clientWidth;
      const hh = this.view.clientHeight;
      if (w === this.lastW && hh === this.lastH) return;
      this.layout();
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(relayout);
      this.ro.observe(this.view);
    }
    const onWin = () => (this.el.isConnected ? relayout() : window.removeEventListener('resize', onWin));
    window.addEventListener('resize', onWin);
    const onKey = (e: KeyboardEvent) => {
      if (!this.el.isConnected) return window.removeEventListener('keydown', onKey);
      if (document.querySelector('.modal:not(.leave)') && !this.el.closest('.modal')) return;
      if (e.code === 'ArrowLeft') this.go(this.page - 1);
      else if (e.code === 'ArrowRight') this.go(this.page + 1);
    };
    window.addEventListener('keydown', onKey);
    // first layout once the element is in the document and has a size
    requestAnimationFrame(() => this.layout());
  }

  /** Replaces the items (e.g. a codex tab switch) and starts from page 0. */
  setItems(items: HTMLElement[], page = 0): void {
    this.items = items;
    this.page = page;
    this.layout();
  }

  get current(): number {
    return this.page;
  }

  /** Scrolls to the page holding item `i`. */
  showItem(i: number): void {
    const per = this.perPage;
    if (per > 0) this.go(Math.floor(i / per));
  }

  private perPage = 0;

  layout(): void {
    const W = this.view.clientWidth;
    const H = this.view.clientHeight;
    if (W <= 0 || H <= 0) {
      requestAnimationFrame(() => this.el.isConnected && this.layout());
      return;
    }
    this.lastW = W;
    this.lastH = H;
    const gap = this.o.gap ?? 8;
    const cols = Math.max(1, Math.min(this.o.maxCols ?? 99, Math.floor((W + gap) / (this.o.minItemW + gap))));
    const colW = (W - gap * (cols - 1)) / cols;
    // measure the tallest item at the final column width
    const probe = h('div', { cls: 'pg-probe', style: { width: `${colW}px` } });
    this.track.textContent = '';
    this.track.appendChild(probe);
    let itemH = 0;
    for (const it of this.items) {
      probe.appendChild(it);
      itemH = Math.max(itemH, it.offsetHeight);
    }
    probe.remove();
    const rows = this.o.rows ?? Math.max(1, Math.floor((H + gap) / (itemH + gap)));
    const per = Math.max(1, rows * cols);
    this.perPage = per;
    this.pages = Math.max(1, Math.ceil(this.items.length / per));
    for (let p = 0; p < this.pages; p++) {
      const page = h('div', {
        cls: 'pg-page',
        style: { 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, 'grid-auto-rows': `${Math.max(Math.min(itemH, (H - gap * (rows - 1)) / rows), Math.min(itemH, H))}px`, gap: `${gap}px` },
      });
      for (const it of this.items.slice(p * per, (p + 1) * per)) page.appendChild(it);
      this.track.appendChild(page);
    }
    this.page = Math.min(this.page, this.pages - 1);
    this.dots.textContent = '';
    for (let p = 0; p < this.pages; p++) {
      const d = h('button', { cls: 'pg-dot', attrs: { 'aria-label': String(p + 1) }, onClick: () => this.go(p) });
      this.dots.appendChild(d);
    }
    this.nav.classList.toggle('hidden', this.pages <= 1);
    this.go(this.page, true);
  }

  go(p: number, instant = false): void {
    const page = Math.max(0, Math.min(this.pages - 1, p));
    this.page = page;
    this.track.style.transition = instant ? 'none' : '';
    this.track.style.transform = `translateX(${-page * 100}%)`;
    this.prev.disabled = page <= 0;
    this.next.disabled = page >= this.pages - 1;
    this.dots.querySelectorAll('.pg-dot').forEach((d, i) => d.classList.toggle('on', i === page));
    this.o.onPage?.(page);
  }

  private wireSwipe(): void {
    let x0 = 0;
    let y0 = 0;
    let id: number | null = null;
    this.view.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      id = null;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) this.go(this.page + (dx < 0 ? 1 : -1));
    };
    this.view.addEventListener('pointerup', end);
    this.view.addEventListener('pointercancel', () => (id = null));
  }

  dispose(): void {
    this.ro?.disconnect();
  }
}
