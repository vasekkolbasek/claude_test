// Layout audit: every screen/dialog on 14 phone/tablet/desktop sizes (incl. 125% system font)
// in Yandex-like mode; reports scrollable boxes, elements off-screen, overlaps and clipped text.
//   npm run build && node scripts/serve.mjs dist 4192 / & node scripts/layout-audit.mjs <outDir> [WxH]
import { chromium } from 'playwright';
const out = process.argv[2];
const only = process.argv[3];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const audit = (p) => p.evaluate(() => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  const vis = (el) => { if (el.closest('.leave') || el.closest('.covered') || el.closest('.pg-probe')) return false; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const v = el.closest('.pg-view'); if (v) { const vr = v.getBoundingClientRect(); if (r.right <= vr.left + 1 || r.left >= vr.right - 1) return false; } return true; };
  const modals = [...document.querySelectorAll('#ui .modal:not(.leave):not(.covered)')];
  const layer = modals.length ? modals[modals.length - 1] : document.querySelector('#ui .screen:not(.leave)');
  if (!layer) return ['no layer'];
  for (const el of layer.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) bad.push(`SCROLL .${[...el.classList].join('.')}`);
  }
  const sel = 'button, .stat, .li, .char-card, .sector, .ni, .tile, .panel, .quest-card, h2, h3, .title, .reward, .dmg-row, .set-row, .lb-row, .pg-nav, .feat-hint, .card, .day, .bits-pill, .res-sub, .note';
  const els = [...layer.querySelectorAll(sel)].filter(vis);
  const rects = els.map((e) => e.getBoundingClientRect());
  for (let i = 0; i < els.length; i++) {
    const r = rects[i];
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) bad.push(`OUT ${els[i].tagName}.${els[i].className} "${(els[i].textContent || '').trim().slice(0, 16)}"`);
    const e = els[i];
    const cs = getComputedStyle(e); if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis') bad.push(`CLIP "${e.textContent.trim().slice(0, 18)}"`);
    for (let j = i + 1; j < els.length; j++) {
      if (e.contains(els[j]) || els[j].contains(e)) continue;
      const q = rects[j];
      const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left);
      const oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 3 && oy > 3) bad.push(`OVERLAP "${(e.textContent || e.className).trim().slice(0, 14)}" x "${(els[j].textContent || els[j].className).trim().slice(0, 14)}"`);
    }
  }
  return [...new Set(bad)].slice(0, 5);
});
const devices = [[320, 568, 1], [360, 640, 1], [375, 667, 1], [393, 852, 1], [412, 915, 1], [360, 780, 1.25], [640, 360, 1], [740, 360, 1], [915, 412, 1], [768, 1024, 1], [1024, 768, 0], [1280, 720, 0], [1366, 768, 0], [1920, 1080, 0]];
let fails = 0;
for (const [w, h, fs] of devices) {
  if (only && `${w}x${h}` !== only) continue;
  const mobile = fs > 0;
  const tag = `${w}x${h}${fs > 1 ? '@125%' : ''}`;
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4192/index.html?test=1&mock=1');
  await p.waitForTimeout(1200);
  await p.evaluate((fs) => {
    if (fs > 1) document.documentElement.style.fontSize = `${16 * fs}px`;
    const a = window.__ns; const s = a.save.data;
    a.platform.kind = 'yandex';
    s.stats.runs = 11; s.stats.miniBosses = 5; s.stats.kills = 9000; s.endlessUnlocked = true; s.sectorsCleared = ['ram', 'cpu']; s.bits = 3000; s.bestEndless = 400; s.seen = []; s.authOffered = 0;
    for (const id of ['first_run', 'survive_3', 'survive_5', 'win_ram', 'win_cpu', 'kills_1000', 'level_10', 'evolve_1', 'mb_1']) s.ach[id] = 1;
    a.ui.closeAllModals(); a.goMenu(false);
  }, fs);
  await p.waitForTimeout(900);
  const step = async (name) => { await p.waitForTimeout(700); const bad = await audit(p); if (bad.length) fails++; console.log(`${tag} ${name}: ${bad.length ? bad.join(' | ') : 'ok'}`); await p.screenshot({ path: `${out}/${tag}_${name}.png` }); };
  const close = async () => { await p.evaluate(() => window.__ns.ui.closeAllModals()); await p.waitForTimeout(300); };
  const tryStep = async (name, fn) => { try { await fn(); } catch (e) { console.log(`${tag} ${name}: STEP-ERROR ${e.message.split('\n')[0]}`); } };
  await close();
  await step('menu');
  for (const f of ['workshop', 'characters', 'achievements', 'codex', 'leaders']) {
    await tryStep(f, async () => {
      await p.locator(`.screen:not(.leave) [data-feature=${f}]`).click({ timeout: 5000 });
      await step(f);
      if (f === 'workshop' || f === 'codex') { await p.locator('.screen:not(.leave) .tab').last().click(); await step(`${f}-tab`); }
      await p.locator('.screen:not(.leave) .topbar .btn').first().click();
      await p.waitForTimeout(700);
      await close();
    });
  }
  await tryStep('daily', async () => { await p.locator('.screen:not(.leave) [data-feature=daily]').click({ timeout: 5000 }); await step('daily'); await close(); });
  await tryStep('settings-menu', async () => { await p.locator('.screen:not(.leave) .head .btn').click({ timeout: 5000 }); await step('settings-menu'); await close(); });
  await tryStep('run', async () => {
    await p.locator('[data-test=play]').last().click();
    await step('prerun');
    await p.locator('[data-test=start]').click();
    await p.waitForTimeout(400);
    await p.evaluate(() => { const a = window.__ns; a.tutorial?.dispose?.(); a.tutorial = null; a.sandbox({ god: true }); a.world.pendingLevels = 1; });
    await step('levelup');
    for (let i = 0; i < 5 && (await p.locator('.card').count()) > 0; i++) { await p.locator('.card:not(.locked)').first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.evaluate(() => window.__ns.openPauseMenu());
    await step('pause');
    await p.locator('.dialog .btn').nth(1).click();
    await step('settings-run');
    await close();
    await p.evaluate(() => { const a = window.__ns; a.pauses.clear(); a.sync(); a.godMode = false; a.world.player.inv = 0; a.world.hurtPlayer(1e9, 0, 0); });
    await p.locator('[data-test=revive-decline]').waitFor({ timeout: 15000 });
    await step('revive');
    await p.evaluate(() => { const w = window.__ns.world; w.run.kills = 60000; });
    await p.locator('[data-test=revive-decline]').click();
    await p.locator('[data-screen=results]').waitFor({ timeout: 15000 });
    await step('results');
  });
  await p.close();
}
console.log('FAILS', fails);
await b.close();
