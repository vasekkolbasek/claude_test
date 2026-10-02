import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/game/?test=1');
await page.waitForFunction(() => window.__lb, null, { timeout: 30000 });
for (const [map, tier] of [['valley', 1], ['swamp', 2], ['pass', 0]]) {
  await page.evaluate(([map, tier]) => { const a = window.__lb.app; a.startRun(map, false, 1); a.debugSetup({ tier, coins: 99 }); a.setSpeed(0.0001); }, [map, tier]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/claude-0/scratch/map_${map}.png` });
  await page.evaluate(() => { const a = window.__lb.app; a.stage.zoom = 2.1; a.debugSetup({ hideHud: true }); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/claude-0/scratch/map_${map}_far.png` });
}
await browser.close();
