import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/game/?test=1');
await page.waitForFunction(() => window.__lb, null, { timeout: 30000 });
await page.evaluate(() => {
  const a = window.__lb.app;
  a.startRun('valley', false, 5);
  a.debugSetup({ tier: 1, coins: 30, night: 8, phase: 'night', hero: [10, -8], spawn: ['grunt','grunt','runner','shieldbearer','skirmisher','ram','wisp','raider','giant','grunt','grunt','runner','boss_warlord','grunt','shieldbearer'], spawnPath: 0, spawnS: 18, dayness: 0 });
  a.enableBot(false);
});
await page.waitForTimeout(400);
await page.evaluate(() => { const a = window.__lb.app; a.fastForward(3.5); a.setSpeed(0.0001); });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/scratch/battle.png' });
await page.evaluate(() => { const a = window.__lb.app; a.startRun('pass', false, 5); a.debugSetup({ tier: 2, hideHud: true, zoom: 1.6 }); a.setSpeed(0.0001); });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/scratch/pass2.png' });
await browser.close();
