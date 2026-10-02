import './ui/styles.css';
import { App } from './app';
import { capturedErrors, installErrorHandlers } from './core/errors';
import { normalizeLang, setLang, t } from './i18n';
import { createPlatform } from './platform';
import { BNODES } from './data/buildings';
import { UNIT_IDS } from './data/units';

declare global {
  interface Window { __lb?: unknown }
}

function setProgress(p: number): void {
  const bar = document.getElementById('load-fill');
  if (bar) bar.style.width = `${Math.round(Math.min(1, p) * 100)}%`;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  installErrorHandlers();
  setProgress(0.08);
  const platform = await createPlatform();
  setLang(normalizeLang(platform.langCode()));
  const lt = document.getElementById('load-text');
  if (lt) lt.textContent = t('loading');
  setProgress(0.25);
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!webglAvailable()) {
    if (lt) lt.textContent = t('err.fatal');
    platform.loadingReady();
    return;
  }
  const app = new App(platform, document.getElementById('app')!, canvas);
  await app.init((p) => setProgress(0.25 + p * 0.75));
  const loading = document.getElementById('loading');
  loading?.classList.add('out');
  setTimeout(() => loading?.remove(), 500);
  app.ready();
  const q = location.search;
  if (/[?&](test|shot)/.test(q)) window.__lb = { app, errors: capturedErrors, BNODES, UNIT_IDS };
  const promo = /[?&]promo=(\w+)/.exec(q);
  if (promo) {
    const lang = /[?&]lang=(ru|en)/.exec(q);
    if (lang) setLang(lang[1] as 'ru' | 'en');
    const { showPromo } = await import('./world/promo');
    showPromo(promo[1], t('title'), t('subtitle'));
  }
}

void boot().catch((e) => {
  capturedErrors.push(String(e));
  const lt = document.getElementById('load-text');
  if (lt) lt.textContent = t('err.fatal');
});
