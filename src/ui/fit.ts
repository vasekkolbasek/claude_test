/**
 * Fit-to-screen safety net. Layouts are designed to fit, but phones differ a lot (small
 * screens, large system font scaling in WebViews, Yandex-only blocks such as the sign-in offer),
 * so after every screen/dialog change and on resize:
 *  - boxes marked `data-fit` (dialogs, the results screen) get `.tight`, then `.tighter`
 *    while their content is taller than the box — never a scrollbar;
 *  - `.fit-text` headings shrink until they fit on their line.
 */

const STEPS = ['tight', 'tighter'] as const;

function overflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

export function fitBox(el: HTMLElement): void {
  el.classList.remove(...STEPS);
  for (const step of STEPS) {
    if (!overflows(el)) return;
    el.classList.add(step);
  }
}

export function fitText(el: HTMLElement): void {
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  let size = base;
  for (let i = 0; i < 14 && el.scrollWidth > el.clientWidth + 1 && size > 12; i++) {
    size *= 0.92;
    el.style.fontSize = `${size}px`;
  }
}

export function refit(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.fit-text').forEach(fitText);
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach(fitBox);
}

let pending = 0;

/** Refits after the current frame and once more after the enter animations settle. */
export function scheduleRefit(): void {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    refit();
    setTimeout(() => refit(), 360);
  });
}

if (typeof window !== 'undefined') window.addEventListener('resize', scheduleRefit);
