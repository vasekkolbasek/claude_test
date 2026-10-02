// Ad-hoc screenshot helper: node scripts/shot.mjs <url> <out.png> [w] [h] [actions-json]
import { chromium } from '@playwright/test';

const [, , url, out, w = '390', h = '844', actions = '[]'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(w) < 800 ? 2 : 1, hasTouch: Number(w) < 800 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
if (process.env.SAVE) {
  const { readFileSync } = await import('node:fs');
  const data = readFileSync(process.env.SAVE, 'utf8');
  await page.addInitScript((d) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('neon-swarm:save', d);
      sessionStorage.setItem('seeded', '1');
    }
  }, data);
}
await page.goto(url);
await page.waitForTimeout(1500);
for (const a of JSON.parse(actions)) {
  if (a.click) await page.click(a.click);
  if (a.eval) await page.evaluate(a.eval);
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.key) await page.keyboard.down(a.key);
  if (a.keyup) await page.keyboard.up(a.keyup);
  if (a.shot) await page.screenshot({ path: a.shot });
}
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
