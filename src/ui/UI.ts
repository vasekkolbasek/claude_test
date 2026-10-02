import { h } from './dom';
import { icon } from './icons';

/** Screen / modal / toast manager over the #ui overlay. */
export class UI {
  readonly root: HTMLElement;
  private screen: HTMLElement | null = null;
  private readonly modals: HTMLElement[] = [];
  private readonly toasts: HTMLElement;
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

  /** Replaces the current screen with a transition. */
  show(el: HTMLElement): void {
    const old = this.screen;
    if (old) {
      old.classList.remove('enter');
      old.classList.add('leave');
      setTimeout(() => old.remove(), 230);
    }
    el.classList.add('screen', 'enter');
    this.layer.appendChild(el);
    this.screen = el;
  }

  current(): HTMLElement | null {
    return this.screen;
  }

  clearScreen(): void {
    if (this.screen) {
      const old = this.screen;
      old.classList.add('leave');
      setTimeout(() => old.remove(), 230);
      this.screen = null;
    }
  }

  openModal(el: HTMLElement): HTMLElement {
    el.classList.add('modal');
    this.root.appendChild(el);
    this.modals.push(el);
    return el;
  }

  closeModal(el?: HTMLElement): void {
    const m = el ?? this.modals[this.modals.length - 1];
    if (!m) return;
    const i = this.modals.indexOf(m);
    if (i >= 0) this.modals.splice(i, 1);
    m.classList.add('leave');
    setTimeout(() => m.remove(), 190);
  }

  closeAllModals(): void {
    while (this.modals.length) this.closeModal();
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
              h('button', { cls: `btn ${danger ? 'danger' : ''}`, text: yes, onClick: () => done(true) }),
              h('button', { cls: 'btn ghost', text: no, onClick: () => done(false) }),
            ),
          ),
        ),
      );
    });
  }
}
