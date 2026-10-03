import { h } from './dom';
import { icon } from './icons';

/** Screen / modal / toast manager over the #ui overlay. */
export class UI {
  readonly root: HTMLElement;
  private screen: HTMLElement | null = null;
  private readonly modals: HTMLElement[] = [];
  private readonly toasts: HTMLElement;
  private readonly removals = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  readonly layer: HTMLElement;
  /** click sound hook */
  onClick: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.layer = h('div', { cls: 'layer' });
    this.toasts = h('div', { cls: 'toasts' });
    root.append(this.layer, this.toasts);
    // generic click feedback for every button
    root.addEventListener(
      'click',
      (e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest('button, .tile, .card, .sector, .tab, .toggle')) this.onClick?.();
      },
      true,
    );
    // block the context menu and double-tap zoom everywhere
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /** Replaces the current screen with a transition. Screens may be reused (the HUD is). */
  show(el: HTMLElement): void {
    const old = this.screen;
    if (old && old !== el) this.retire(old);
    // a reused element may still carry its previous exit animation and removal timer
    const timer = this.removals.get(el);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.removals.delete(el);
    }
    el.classList.remove('leave', 'enter');
    void el.offsetWidth; // restart the enter animation
    el.classList.add('screen', 'enter');
    if (el.parentElement !== this.layer) this.layer.appendChild(el);
    this.screen = el;
  }

  current(): HTMLElement | null {
    return this.screen;
  }

  clearScreen(): void {
    if (this.screen) {
      this.retire(this.screen);
      this.screen = null;
    }
  }

  private retire(el: HTMLElement): void {
    el.classList.remove('enter');
    el.classList.add('leave');
    this.removals.set(
      el,
      setTimeout(() => {
        this.removals.delete(el);
        el.remove();
      }, 230),
    );
  }

  openModal(el: HTMLElement): HTMLElement {
    el.classList.add('modal');
    // a dialog opened on top of another one hides it (no text showing through)
    this.modals[this.modals.length - 1]?.classList.add('covered');
    this.root.appendChild(el);
    this.modals.push(el);
    this.root.classList.add('has-modal');
    return el;
  }

  closeModal(el?: HTMLElement): void {
    const m = el ?? this.modals[this.modals.length - 1];
    if (!m) return;
    const i = this.modals.indexOf(m);
    if (i >= 0) this.modals.splice(i, 1);
    this.modals[this.modals.length - 1]?.classList.remove('covered');
    this.root.classList.toggle('has-modal', this.modals.length > 0);
    m.classList.add('leave');
    setTimeout(() => m.remove(), 190);
  }

  closeAllModals(): void {
    while (this.modals.length) this.closeModal();
  }

  /** Whether `el` is the topmost open modal (keyboard shortcuts must not act under a dialog). */
  isTopModal(el: HTMLElement): boolean {
    return this.modals[this.modals.length - 1] === el;
  }

  hasModal(): boolean {
    return this.modals.length > 0;
  }

  toast(text: string, kind: 'gold' | 'info' = 'gold', ico = 'star'): void {
    const el = h('div', { cls: `toast ${kind === 'info' ? 'info' : ''}` }, icon(ico), h('span', { text }));
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 3300);
  }

  /** Simple yes/no dialog. */
  confirm(title: string, text: string, yes: string, no: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (v: boolean) => {
        this.closeModal(m);
        resolve(v);
      };
      const m = this.openModal(
        h(
          'div',
          null,
          h(
            'div',
            { cls: 'dialog panel' },
            h('h3', { text: title }),
            h('p', { text }),
            h(
              'div',
              { cls: 'btns' },
              h('button', { cls: `btn ${danger ? 'danger' : ''}`, text: yes, attrs: { 'data-test': 'confirm-yes' }, onClick: () => done(true) }),
              h('button', { cls: 'btn ghost', text: no, onClick: () => done(false) }),
            ),
          ),
        ),
      );
    });
  }
}
