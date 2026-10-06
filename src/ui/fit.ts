/**
 * Fit-to-screen safety net. Layouts are designed to fit, but phones differ a lot (small
 * screens, large system font scaling in WebViews, Yandex-only blocks such as the sign-in offer),
 * so after every screen/dialog change and on resize:
 *  - boxes marked `data-fit` (dialogs, the results screen) get `.tight`, then `.tighter`
 *    while their content is taller than the box — never a scrollbar;
 *  - `.fit-text` headings and labels shrink until they fit on their line; inside a `.fit-row`
 *    (tabs, segmented controls) they all take the smallest size, so the row stays even.
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

/**
 * Natural one-line width of an element's text. `scrollWidth` cannot be trusted here: with
 * `text-overflow: ellipsis` (and on buttons) it reports the already-cut width.
 */
function textWidth(el: HTMLElement, cs: CSSStyleDeclaration): number {
  const probe = document.createElement('span');
  probe.textContent = el.textContent;
  const ps = probe.style;
  ps.position = 'absolute';
  ps.visibility = 'hidden';
  ps.whiteSpace = 'nowrap';
  ps.fontFamily = cs.fontFamily;
  ps.fontSize = cs.fontSize;
  ps.fontWeight = cs.fontWeight;
  ps.fontStyle = cs.fontStyle;
  ps.letterSpacing = cs.letterSpacing;
  ps.textTransform = cs.textTransform;
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

export function fitText(el: HTMLElement): void {
  el.style.fontSize = '';
  const cs = getComputedStyle(el);
  const base = parseFloat(cs.fontSize) || 16;
  if (cs.whiteSpace === 'nowrap') {
    // one-line labels: measure the full text and scale it (text width is linear in font size)
    const box = el.getBoundingClientRect().width;
    const room = box - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    const need = textWidth(el, cs);
    // even a fraction of a pixel too wide makes the browser cut the text with «…»
    if (room > 0 && need > room) el.style.fontSize = `${Math.max(12, Math.floor(base * (room / need) * 0.97 * 10) / 10)}px`;
    return;
  }
  // wrapping headings: only a word wider than the line overflows
  let size = base;
  for (let i = 0; i < 14 && el.scrollWidth > el.clientWidth + 1 && size > 12; i++) {
    size *= 0.92;
    el.style.fontSize = `${size}px`;
  }
}

/** Equal-width controls in a row (tabs, segments) share the smallest fitted size. */
function evenRow(row: HTMLElement): void {
  const items = [...row.querySelectorAll<HTMLElement>(':scope > .fit-text')];
  if (items.length < 2) return;
  const min = Math.min(...items.map((x) => parseFloat(getComputedStyle(x).fontSize)));
  for (const x of items) if (parseFloat(getComputedStyle(x).fontSize) > min) x.style.fontSize = `${min}px`;
}

export function refit(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.fit-text').forEach(fitText);
  root.querySelectorAll<HTMLElement>('.fit-row').forEach(evenRow);
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
