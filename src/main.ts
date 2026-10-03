import './ui/styles.css';
import { App } from './app/App';
import { setLang, t } from './i18n';
import { createPlatform } from './platform/detect';
import { loadFonts } from './ui/fonts';

const bar = document.getElementById('loader-bar');
const title = document.getElementById('loader-title');
const loader = document.getElementById('loader');

function progress(f: number): void {
  if (bar) bar.style.width = `${Math.round(Math.max(0.04, Math.min(1, f)) * 100)}%`;
}

// global safety net: log, never let one error kill the session
window.addEventListener('error', (e) => {
  console.warn('[global error]', e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.warn('[unhandled rejection]', e.reason);
});

/** `?art=icon|cover` renders store art only (used by scripts/shots.mjs). */
async function renderArt(kind: string): Promise<void> {
  const { drawCover, drawIcon } = await import('./render/art');
  setLang(new URLSearchParams(location.search).get('lang') ?? 'ru');
  await loadFonts(4000);
  const c = document.createElement('canvas');
  c.id = 'art';
  if (kind === 'icon') {
    c.width = c.height = 512;
    drawIcon(c);
  } else if (kind === 'hero') {
    c.width = 1560;
    c.height = 520;
    drawCover(c, t('game.title'));
  } else {
    c.width = 800;
    c.height = 470;
    drawCover(c, t('game.title'));
  }
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: `${c.width}px`, height: `${c.height}px` });
  document.body.appendChild(c);
  loader?.remove();
  document.body.dataset.art = 'ready';
}

async function start(): Promise<void> {
  const art = new URLSearchParams(location.search).get('art');
  if (art) return renderArt(art);
  progress(0.1);
  const platform = await createPlatform();
  setLang(platform.lang());
  document.title = t('game.title');
  if (title) title.textContent = t('game.title');
  progress(0.3);
  await loadFonts();
  progress(0.45);
  const app = new App(platform);
  await app.boot(progress);
  progress(1);
  if (new URLSearchParams(location.search).has('test') || import.meta.env.DEV) {
    (window as unknown as { __ns: App }).__ns = app;
  }
  // the menu is on screen and interactive: tell the platform
  requestAnimationFrame(() => {
    loader?.classList.add('hide');
    setTimeout(() => loader?.remove(), 500);
    platform.ready();
  });
}

start().catch((e: unknown) => {
  console.error('[boot]', e);
  if (title) title.textContent = 'Error';
});
