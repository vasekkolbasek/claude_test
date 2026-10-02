import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [w, h, tag] of [[1280, 720, 'd'], [390, 844, 'p']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900 });
  await page.goto('http://localhost:4173/game/?test=1');
  await page.waitForFunction(() => window.__lb, null, { timeout: 30000 });
  await page.evaluate(() => { const a = window.__lb.app; a.save.change((d) => { d.glory = 1450; d.maps.valley.won = true; d.maps.valley.best = 8; d.maps.valley.endlessBest = 12; d.ach.push('first_build', 'first_night', 'win_valley'); d.perks = ['tithe', 'masons']; d.weapon = 'bow'; d.mutators = ['tough']; }); a.screens.showMenu(); a.stage.setQualitySetting('low'); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/claude-0/scratch/m_${tag}_menu.png` });
  const shots = [['showMaps', 'maps'], ['showArmory', 'armory'], ['showMutators', 'mut'], ['showAchievements', 'ach'], ['showLeaders', 'lb'], ['showSettings', 'set']];
  for (const [fn, name] of shots) {
    await page.evaluate((fn) => { const s = window.__lb.app.screens; s[fn](() => s.showMenu()); }, fn);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/claude-0/scratch/m_${tag}_${name}.png` });
  }
  await page.close();
}
await browser.close();
