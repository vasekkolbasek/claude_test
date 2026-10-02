/** Inline SVG icon set (24×24, stroke based). Constant markup only. */
const P: Record<string, string> = {
  pulse: '<circle cx="7" cy="12" r="3"/><path d="M12 12h9M16 8l5 4-5 4"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3.2"/><path d="M12 1.5l2.2 2.2L12 6 9.8 3.7z"/>',
  chain: '<path d="M13 2L5 13h6l-2 9 8-11h-6z"/>',
  laser: '<path d="M6 12h16"/><circle cx="4" cy="12" r="2.2"/><path d="M8 8.5h11M8 15.5h11" opacity=".55"/>',
  mines: '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5"/>',
  missiles: '<path d="M4 20l5-5M14 3.5h6.5V10L12 18.5 5.5 12z"/><path d="M15 9h.01"/>',
  shockwave: '<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15"/>',
  drones: '<path d="M12 3l3.5 6.5h-7z"/><path d="M5 13.5l3.5 6.5h-7zM19 13.5l3.5 6.5h-7z"/>',
  might: '<path d="M12 21V5M6 11l6-6 6 6M5 21h14"/>',
  haste: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3.5 2M9 2.5h6"/>',
  speed: '<path d="M4 6l6 6-6 6M12 6l6 6-6 6"/>',
  magnet: '<path d="M6 3v9a6 6 0 0 0 12 0V3h-4.5v9a1.5 1.5 0 0 1-3 0V3z"/><path d="M6 7h4.5M13.5 7H18"/>',
  armor: '<path d="M12 2.5l8 3v6.5c0 5-3.6 8.2-8 9.5-4.4-1.3-8-4.5-8-9.5V5.5z"/>',
  regen: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
  crit: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  area: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="3"/>',
  duration: '<path d="M6 3h12M6 21h12M7 3.5c0 5 10 5 10 8.5s-10 3.5-10 8.5M17 3.5c0 5-10 5-10 8.5"/>',
  luck: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/><circle cx="12" cy="12" r="1.3"/>',
  maxhp: '<path d="M12 20.5s-8-4.8-8-11a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 6.2-8 11-8 11z"/>',
  amount: '<path d="M3 7h11M3 12h15M3 17h11"/><path d="M15 4l3 3-3 3M18 9l3 3-3 3M15 14l3 3-3 3"/>',
  growth: '<path d="M3 20l6-7 4 3.5 8-10"/><path d="M15.5 6.5H21V12"/>',
  workshop: '<path d="M14.5 5.5a4 4 0 0 0 5 5L10 20a2.1 2.1 0 0 1-3-3l9.5-9.5a4 4 0 0 1-2-2z"/><path d="M3 21l3-3"/>',
  characters: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  codex: '<path d="M4 4.5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6V19h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z"/><path d="M12 5.5V21"/>',
  achievements: '<path d="M8 3.5h8v5.5a4 4 0 0 1-8 0zM8 5.5H4.5a3.5 3.5 0 0 0 4 4.5M16 5.5h3.5a3.5 3.5 0 0 1-4 4.5M12 13v4M8 21h8M9.5 17h5"/>',
  leaders: '<path d="M3 8l4.5 4 4.5-7 4.5 7L21 8l-2 11H5z"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  play: '<path d="M8 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>',
  video: '<rect x="2" y="6" width="13.5" height="12" rx="2.5"/><path d="M15.5 10.2L22 7v10l-6.5-3.2z"/><path d="M7.2 9.4l4 2.6-4 2.6z" fill="currentColor"/>',
  bits: '<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  chest: '<path d="M3 10h18v10H3zM3 10l3-5h12l3 5M10 10v4h4v-4"/>',
  daily: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 15l2.5 2.5 4.5-4.5"/>',
  back: '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
  kills: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.2"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  reroll: '<path d="M20 11a8 8 0 0 0-14.2-4.6M4 13a8 8 0 0 0 14.2 4.6"/><path d="M5.5 2.5v4h4M18.5 21.5v-4h-4"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  skip: '<path d="M5 5l14 14M19 5L5 19"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  vibration: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8M2 10v4M22 10v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
};

export type IconName = keyof typeof P | string;

export function icon(name: IconName, cls = ''): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ico ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = P[name] ?? P.star;
  return svg;
}

/** Icon id for a weapon / evolution / passive id. */
export function itemIcon(id: string): string {
  return id.replace(/_evo$/, '');
}
