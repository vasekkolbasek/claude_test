import { expect, test, type Page } from '@playwright/test';

type W = Window & { __lb: any; __sdkLog?: string[]; __sdkEmit?: (e: string) => void };

function collect(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function boot(page: Page, url = '?test=1'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as unknown as W).__lb, null, { timeout: 60_000 });
  await page.evaluate(() => (window as unknown as W).__lb.app.stage.setQualitySetting('low'));
}

async function appErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => { const w = window as unknown as W; return [...w.__lb.errors, ...w.__lb.app.errors]; });
}

test('menu → run → bot survives two nights → results → menu', async ({ page }) => {
  const errors = collect(page);
  await boot(page);
  const play = page.locator('.menu .btn.play');
  await expect(play).toBeVisible();
  await play.click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => { const a = (window as unknown as W).__lb.app; a.enableBot(true); });
  // Survive two nights (night counter reaches 3) or at least reach night 3 attempts.
  const reached = await page.evaluate(async () => {
    const a = (window as unknown as W).__lb.app;
    for (let i = 0; i < 120; i++) {
      a.fastForward(5);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const g = a.game;
      if (!g || a.mode !== 'run') break;
      if (g.night >= 3 && g.phase === 'day') return { night: g.night, built: g.stats.built, kills: g.stats.kills, phase: g.phase };
    }
    const g = a.game;
    return { night: g?.night, built: g?.stats.built, kills: g?.stats.kills, phase: g?.phase };
  });
  expect(reached.built).toBeGreaterThan(0);
  expect(reached.kills).toBeGreaterThan(0);
  expect(reached.night).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/smoke-${test.info().project.name}-run.png` });
  await page.evaluate(() => (window as unknown as W).__lb.app.debugEndRun(false));
  const cont = page.locator('.results .btn.green');
  await expect(cont).toBeVisible();
  await page.screenshot({ path: `test-results/smoke-${test.info().project.name}-results.png` });
  await cont.click();
  await expect(page.locator('.menu .btn.play')).toBeVisible();
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('menu screens open and close without errors', async ({ page }) => {
  const errors = collect(page);
  await boot(page);
  for (const idx of [0, 1, 2, 3, 4, 5]) {
    await page.locator('.menu .grid2 .btn').nth(idx).click();
    await expect(page.locator('.screen .panel')).toBeVisible();
    await page.locator('.screen .panel-head .btn').first().click();
    await expect(page.locator('.menu .btn.play')).toBeVisible();
  }
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('no scrollbars, no text selection, layout fits the viewport', async ({ page }) => {
  await boot(page);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    w: window.innerWidth, h: window.innerHeight, sel: getComputedStyle(document.body).userSelect,
  }));
  expect(m.sw).toBeLessThanOrEqual(m.w);
  expect(m.sh).toBeLessThanOrEqual(m.h);
  expect(m.sel).toBe('none');
  // All menu buttons are inside the viewport.
  const boxes = await page.locator('.menu .btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  const vp = page.viewportSize()!;
  for (const [l, t, r, b] of boxes) {
    expect(l).toBeGreaterThanOrEqual(0);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(vp.width + 0.5);
    expect(b).toBeLessThanOrEqual(vp.height + 0.5);
  }
});

test('Yandex SDK integration (mock): ready, gameplay start/stop, ads pause and reward', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'once is enough');
  const errors = collect(page);
  await page.goto('http://localhost:4174/game/?test=1');
  await page.waitForFunction(() => !!(window as unknown as W).__lb, null, { timeout: 60_000 });
  const log = () => page.evaluate(() => [...((window as unknown as W).__sdkLog ?? [])]);
  expect(await page.evaluate(() => (window as unknown as W).__lb.app.platform.id)).toBe('yandex');
  expect(await log()).toContain('ready');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await page.locator('.menu .btn.play').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect((await log()).filter((x) => x === 'start').length).toBe(1);
  // SDK pause event → gameplay stops, pause menu opens.
  await page.evaluate(() => (window as unknown as W).__sdkEmit!('game_api_pause'));
  expect((await log()).slice(-1)[0]).toBe('stop');
  await expect(page.locator('.screen .panel h2')).toBeVisible();
  await page.evaluate(() => (window as unknown as W).__sdkEmit!('game_api_resume'));
  await page.locator('.screen .btn.gold').click();
  expect((await log()).slice(-1)[0]).toBe('start');
  // Rewarded coins: pauses during the ad and grants coins after onRewarded.
  const before = await page.evaluate(() => (window as unknown as W).__lb.app.game.coins);
  await page.locator('.hud-bc .btn.gold').click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => (window as unknown as W).__lb.app.game.coins);
  expect(after).toBe(before + 5);
  const l = await log();
  const ri = l.lastIndexOf('rewarded');
  expect(l[ri - 1]).toBe('stop');
  expect(l.slice(-1)[0]).toBe('start');
  // Results → continue triggers an interstitial only between screens.
  await page.evaluate(() => (window as unknown as W).__lb.app.debugEndRun(true));
  await page.locator('.results .btn.green').click();
  await expect(page.locator('.menu .btn.play')).toBeVisible();
  expect(await log()).toContain('fullscreen');
  expect((await log()).some((x) => x.startsWith('setData'))).toBe(true);
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('restarting runs does not leak GPU resources or listeners', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'once is enough');
  const errors = collect(page);
  await boot(page);
  const sample = () => page.evaluate(() => {
    const a = (window as unknown as W).__lb.app;
    const m = a.stage.renderer.info.memory;
    return { geo: m.geometries, tex: m.textures, sceneChildren: a.stage.scene.children.length, ui: document.getElementById('ui')!.querySelectorAll('*').length };
  });
  const cycle = () => page.evaluate(async () => {
    const a = (window as unknown as W).__lb.app;
    a.startRun('valley', false, 12345);
    a.enableBot(true);
    a.fastForward(40);
    await new Promise((r) => setTimeout(r, 100));
    a.showMenu(false);
    await new Promise((r) => setTimeout(r, 100));
  });
  await cycle();
  const base = await sample();
  for (let i = 0; i < 4; i++) await cycle();
  const after = await sample();
  expect(after.geo).toBeLessThanOrEqual(base.geo + 2);
  expect(after.tex).toBeLessThanOrEqual(base.tex);
  expect(after.sceneChildren).toBe(base.sceneChildren);
  expect(after.ui).toBeLessThanOrEqual(base.ui + 5);
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('tab switches and repeated ads keep state consistent', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'once is enough');
  const errors = collect(page);
  await page.goto('http://localhost:4174/game/?test=1');
  await page.waitForFunction(() => !!(window as unknown as W).__lb, null, { timeout: 60_000 });
  await page.locator('.menu .btn.play').click();
  await page.mouse.click(400, 400); // user gesture → audio unlocked
  const state = () => page.evaluate(() => { const a = (window as unknown as W).__lb.app; return { paused: a.game.paused, muted: a.audio.isMuted, pauses: [...a.pauses] }; });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    let s = await state();
    expect(s.paused).toBe(true);
    expect(s.muted).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    s = await state();
    expect(s.muted).toBe(false);
    expect(s.pauses).toEqual(['user']); // the pause menu stays open until the player resumes
    await page.locator('.screen .btn.gold').click();
    s = await state();
    expect(s.paused).toBe(false);
  }
  // Several rewarded videos in a row (the button is once per day, so call the flow directly).
  for (let i = 0; i < 4; i++) {
    const ok = await page.evaluate(() => (window as unknown as W).__lb.app.rewarded());
    expect(ok).toBe(true);
    const s = await state();
    expect(s.paused).toBe(false);
    expect(s.muted).toBe(false);
  }
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('first-run tutorial reacts to real keyboard input', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'keyboard flow');
  const errors = collect(page);
  await boot(page);
  await page.locator('.menu .btn.play').click();
  const hint = page.locator('.hint');
  await expect(hint).toContainText(/WASD/);
  // Headless rendering is slow (software GL), so hold long enough for ~3 world units.
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => { const g = (window as unknown as W).__lb.app.game; return Math.hypot(g.hero.x - 3.2, g.hero.z - 5.2); }), { timeout: 20_000 }).toBeGreaterThan(3.2);
  await page.keyboard.up('KeyD');
  await expect(hint).toContainText(/circle|круг/i);
  // Walk the hero to the nearest farm slot and hold Space to build.
  await page.evaluate(() => { const g = (window as unknown as W).__lb.app.game; const b = g.bySlot.get('farm1'); g.hero.x = b.x + 2.2; g.hero.z = b.z; });
  await expect(hint).toContainText(/Space|Пробел/);
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__lb.app.game.bySlot.get('farm1').node?.id ?? ''), { timeout: 20_000 }).toBe('farm');
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as unknown as W).__lb.app.game.bySlot.get('farm1').node?.id)).toBe('farm');
  await expect(hint).toContainText(/Red roads|Красные/);
  await page.keyboard.press('Enter');
  await expect(hint).toContainText(/Q/);
  expect(await page.evaluate(() => (window as unknown as W).__lb.app.game.phase)).toBe('night');
  expect(await appErrors(page)).toEqual([]);
  expect(errors).toEqual([]);
});
