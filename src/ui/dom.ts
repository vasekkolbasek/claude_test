type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, any>;

/** Tiny hyperscript helper. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function icon(name: keyof typeof ICONS, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `ic ${cls}`;
  s.innerHTML = ICONS[name];
  return s;
}

const svg = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  coin: svg('<circle cx="12" cy="12" r="9" fill="#f4c552" stroke="#b9862a" stroke-width="2"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff3c4" stroke-width="1.6"/>'),
  moon: svg('<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" fill="#cfd7ff"/>'),
  sun: svg('<circle cx="12" cy="12" r="5" fill="#ffd36b"/><g stroke="#ffd36b" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  gear: svg('<path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>'),
  video: svg('<rect x="2.5" y="6" width="13" height="12" rx="2.5" fill="currentColor"/><path d="M16.5 10.5l5-3v9l-5-3z" fill="currentColor"/><path d="M7.5 9.5l4 2.5-4 2.5z" fill="#fff"/>'),
  trophy: svg('<path fill="currentColor" d="M7 3h10v3h3a4 4 0 0 1-4 4.5A5 5 0 0 1 13 13.8V17h3v3H8v-3h3v-3.2A5 5 0 0 1 8 10.5 4 4 0 0 1 4 6h3zm0 5V8H6.1A2 2 0 0 0 7 9.4zm10 0v1.4A2 2 0 0 0 17.9 8z"/>'),
  crown: svg('<path fill="currentColor" d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z"/>'),
  sword: svg('<path fill="currentColor" d="M19.5 2.5l2 2-9.8 9.8-2-2zM8.6 12.6l2.8 2.8-1.4 1.4-1-1-3.2 3.2a1.5 1.5 0 0 1-2.1-2.1L6.9 13.7l-1-1z"/>'),
  bow: svg('<path fill="none" stroke="currentColor" stroke-width="2.2" d="M5 3c9 2 14 7 16 16M5 3l16 16"/><path fill="currentColor" d="M3 21l5-1.5-3.5-3.5z"/>'),
  spear: svg('<path fill="currentColor" d="M21.5 2.5l-1.2 5.3-2.1-2zM18.5 6.5l-1 1L4 21l-1-1L16.5 6.5l1-1z"/>'),
  staff: svg('<path fill="currentColor" d="M6 21l-1.5-1.5 9-9 1.5 1.5z"/><circle cx="17" cy="7" r="4" fill="#ffe28a"/><path stroke="#fff6c8" stroke-width="1.5" d="M17 1.5v2M17 10.5v2M11.5 7h2M20.5 7h2"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  check: svg('<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  star: svg('<path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z"/>'),
  hammer: svg('<path fill="currentColor" d="M13.5 3.5l6 6-2 2-1.6-1.6-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l8.6-8.6L11.7 5.6z"/>'),
  flag: svg('<path fill="currentColor" d="M5 2.5h2v19H5zM8 3.5h11l-2.5 4 2.5 4H8z"/>'),
  people: svg('<circle cx="8" cy="8" r="3.2" fill="currentColor"/><circle cx="16.5" cy="9" r="2.7" fill="currentColor"/><path fill="currentColor" d="M2.5 19.5a5.5 5.5 0 0 1 11 0zM12.8 19.5a4.6 4.6 0 0 1 8.7-1.9v1.9z"/>'),
  back: svg('<path d="M15 4.5L7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  skull: svg('<path fill="currentColor" d="M12 2.5a8 8 0 0 0-8 8c0 2.7 1.3 4.5 3 5.6V20h10v-3.9c1.7-1.1 3-2.9 3-5.6a8 8 0 0 0-8-8zM8.7 13.5a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8zm6.6 0a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z"/>'),
  castle: svg('<path fill="currentColor" d="M3 21V8h3v2h2V8h3v2h2V8h3v2h2V8h3v13h-7v-5a2 2 0 0 0-4 0v5z"/>'),
  heart: svg('<path fill="currentColor" d="M12 20.5l-1.4-1.3C5.4 14.5 2 11.4 2 7.6 2 4.5 4.4 2.2 7.4 2.2c1.7 0 3.4.8 4.6 2.1 1.2-1.3 2.9-2.1 4.6-2.1 3 0 5.4 2.3 5.4 5.4 0 3.8-3.4 6.9-8.6 11.6z"/>'),
  music: svg('<path fill="currentColor" d="M9 18.5a3 3 0 1 1-2-2.8V5l12-2.5v12.5a3 3 0 1 1-2-2.8V6.9L9 8.6z"/>'),
  sound: svg('<path fill="currentColor" d="M3 9.5h4l5-4.5v14l-5-4.5H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  sparkle: svg('<path fill="currentColor" d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>'),
  book: svg('<path fill="currentColor" d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a1 1 0 0 0 0 2H20v2H6.5A2.5 2.5 0 0 1 4 19.5zM8 6v2h8V6z"/>'),
  map: svg('<path fill="currentColor" d="M9 4l6 2 6-2v16l-6 2-6-2-6 2V6zm1 2.3v12.4l4 1.3V7.6z"/>'),
} as const;

export function vibrate(on: boolean, ms: number | number[]): void {
  if (!on) return;
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
