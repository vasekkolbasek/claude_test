import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/game/?test=1');
await page.waitForFunction(() => window.__lb, null, { timeout: 30000 });
await page.evaluate(() => { const a = window.__lb.app; a.save.change((d) => { d.glory = 1450; }); a.screens.showArmory(() => {}); });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/claude-0/scratch/weapons.png', clip: { x: 200, y: 100, width: 880, height: 280 } });
await browser.close();
