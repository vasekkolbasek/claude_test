import cyr from '@fontsource-variable/exo-2/files/exo-2-cyrillic-wght-normal.woff2?url';
import latExt from '@fontsource-variable/exo-2/files/exo-2-latin-ext-wght-normal.woff2?url';
import lat from '@fontsource-variable/exo-2/files/exo-2-latin-wght-normal.woff2?url';

const FACES: [string, string][] = [
  [lat, 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
  [cyr, 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'],
  [latExt, 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
];

/** Registers the bundled Exo 2 (SIL OFL) font and waits (bounded) for the subsets we need. */
export async function loadFonts(timeoutMs = 2500): Promise<void> {
  if (!('fonts' in document) || typeof FontFace === 'undefined') return;
  const loads: Promise<unknown>[] = [];
  for (const [url, range] of FACES) {
    try {
      const face = new FontFace('Exo 2', `url(${url}) format('woff2')`, { weight: '100 900', style: 'normal', unicodeRange: range, display: 'swap' });
      document.fonts.add(face);
      loads.push(face.load().catch(() => undefined));
    } catch {
      /* ignore */
    }
  }
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
