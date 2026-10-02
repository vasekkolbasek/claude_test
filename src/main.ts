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

async function start(): Promise<void> {
  progress(0.1);
  const platform = await createPlatform();
  setLang(platform.lang());
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
