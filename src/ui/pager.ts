import { h } from './dom';
import { icon } from './icons';

/**
 * Column sizing is expressed in `rem` (the root font size scales with the screen, and with the
 * system font setting), so the rule is about the *text measure*, not about pixels:
 *  - `minEm`: the narrowest card whose text still reads comfortably (≈ 25+ characters of the
 *    description per line, the title on one line); a column is never narrower than this
 *    (a single column may be — it simply takes the full width);
 *  - `targetEm`: the ideal card width; among the column counts allowed by `minEm` the one whose
 *    card width is closest to it (in ratio) wins, so a phone gets one full-width column, a
 *    portrait tablet two, a wide desktop three or four.
 */
export interface PagerOptions {
  /** narrowest comfortable card, in rem */
  minEm: number;
  /** ideal card width, in rem (defaults to 1.3 × minEm) */
  targetEm?: number;
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

  /** Number of columns for an area `W` px wide (see PagerOptions). */
  private columns(W: number, gap: number, rem: number): number {
    const n = this.items.length || 1;
    const maxCols = Math.max(1, Math.min(this.o.maxCols ?? 6, n));
    const min = this.o.minEm * rem;
    const target = (this.o.targetEm ?? this.o.minEm * 1.3) * rem;
    let best = 1;
    let bestD = Infinity;
    for (let c = 1; c <= maxCols; c++) {
      const w = (W - gap * (c - 1)) / c;
      if (c > 1 && w < min) break;
      const d = Math.abs(Math.log(w / target));
      if (d < bestD - 1e-6) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Lays the items into a probe `colW` px wide and returns the tallest one. */
  private measure(colW: number): number {
    const probe = h('div', { cls: 'pg-probe', style: { width: `${colW}px` } });
    this.track.textContent = '';
    this.track.appendChild(probe);
    let itemH = 0;
    for (const it of this.items) {
      probe.appendChild(it);
      itemH = Math.max(itemH, it.offsetHeight);
    }
    probe.remove();
    return itemH;
  }

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
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const n = this.items.length;
    let cols = this.columns(W, gap, rem);
    const colWidth = (c: number) => (W - gap * (c - 1)) / c;
    let itemH = this.measure(colWidth(cols));
    let rows = this.o.rows ?? Math.max(1, Math.floor((H + gap) / (itemH + gap)));
    // everything on one page: balance the grid (5 items → 3 + 2, not 4 + 1)
    if (n > 0 && !this.o.rows && Math.ceil(n / cols) <= rows) {
      const balanced = Math.ceil(n / Math.ceil(n / cols));
      if (balanced !== cols) {
        cols = balanced;
        itemH = this.measure(colWidth(cols));
        rows = Math.max(1, Math.floor((H + gap) / (itemH + gap)));
      }
    }
    const per = Math.max(1, rows * cols);
    this.perPage = per;
    this.pages = Math.max(1, Math.ceil(n / per));
    // rows share the spare height (a little air in every card instead of a gap at the bottom),
    // but a card never grows past 1.3× its content
    const fill = (H - gap * (rows - 1)) / rows;
    const rowH = Math.max(Math.min(itemH, H), Math.min(fill, itemH * 1.3));
    for (let p = 0; p < this.pages; p++) {
      const page = h('div', {
        cls: 'pg-page',
        style: { 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, 'grid-auto-rows': `${Math.floor(rowH)}px`, gap: `${gap}px` },
      });
      for (const it of this.items.slice(p * per, (p + 1) * per)) page.appendChild(it);
      this.track.appendChild(page);
    }
    this.el.dataset.cols = String(cols);
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
