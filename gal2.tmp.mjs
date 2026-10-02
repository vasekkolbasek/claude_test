import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://localhost:4173/game/?test=1');
await page.waitForFunction(() => window.__lb, null, { timeout: 30000 });
await page.evaluate(() => {
  const { app, BNODES, UNIT_IDS } = window.__lb;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;background:#cfe6ee;z-index:99;display:flex;flex-wrap:wrap;gap:2px;padding:4px;overflow:hidden;font:10px sans-serif';
  const add = (src, label) => { const d = document.createElement('div'); d.style.cssText = 'width:86px;text-align:center'; d.innerHTML = `<img src="${src}" style="width:86px;height:86px;background:#fff8"><div>${label}</div>`; wrap.appendChild(d); };
  for (const n of Object.values(BNODES)) if (n.tier < 2 || n.id.endsWith(n.next?.[0] ?? '___') || true) add(app.icons.building(n), n.id.replace(/_/g, ' '));
  for (const u of UNIT_IDS) add(app.icons.unit(u), u);
  document.body.appendChild(wrap);
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/claude-0/scratch/gallery.png' });
await browser.close();
