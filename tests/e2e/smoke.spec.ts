import { expect, test, type Page } from '@playwright/test';

interface TestApp {
  mode: string;
  godMode: boolean;
  world: { state: string; t: number; run: { kills: number }; player: { hp: number } } | null;
  pauses: Set<string>;
  audio: { muted: boolean };
  enableBot(skill?: number): void;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function platformLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __platformLog: string[] }).__platformLog.slice());
}

async function appState(page: Page): Promise<{ mode: string; state: string | null; t: number; kills: number; pauses: string[] }> {
  return page.evaluate(() => {
    const a = (window as unknown as { __ns: TestApp }).__ns;
    return { mode: a.mode, state: a.world?.state ?? null, t: a.world?.t ?? 0, kills: a.world?.run.kills ?? 0, pauses: [...a.pauses] };
  });
}

test('loads cleanly, plays a run with random input and reaches the results screen', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('index.html?test=1&mock=1');
  const play = page.locator('[data-test=play]');
  await expect(play).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 5000 });
  expect(await platformLog(page)).toContain('ready');

  await play.click();
  await page.locator('[data-test=start]').click();
  await expect(page.locator('.hud')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await platformLog(page)).at(-1)).toBe('gameplay:start');

  // random keyboard input for 60 s (invulnerable, so the whole minute is exercised);
  // upgrade cards are picked at random as they appear
  await page.evaluate(() => {
    (window as unknown as { __ns: { godMode: boolean } }).__ns.godMode = true;
  });
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
  const start = Date.now();
  let held: string | null = null;
  while (Date.now() - start < 60_000) {
    if (held) await page.keyboard.up(held);
    held = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.down(held);
    const cards = page.locator('.card:not(.locked)');
    const n = await cards.count();
    if (n > 0) await cards.nth(Math.floor(Math.random() * n)).click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  if (held) await page.keyboard.up(held);
  // let any level-up dialog resolve
  for (let i = 0; i < 10 && (await page.locator('.card').count()) > 0; i++) {
    await page.locator('.card:not(.locked)').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }

  const st = await appState(page);
  expect(st.t).toBeGreaterThan(15);
  expect(st.mode).toBe('run');

  // background tab → pause + mute, gameplay stop; return → resume
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await appState(page);
  expect(hidden.pauses).toContain('hidden');
  expect((await platformLog(page)).at(-1)).toBe('gameplay:stop');
  expect(await page.evaluate(() => (window as unknown as { __ns: TestApp }).__ns.audio.muted)).toBe(true);
  await page.waitForTimeout(600);
  expect((await appState(page)).t).toBe(hidden.t);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await appState(page)).pauses).not.toContain('hidden');

  // the platform's own pause event (game_api_pause / resume)
  await page.evaluate(() => (window as unknown as { __ns: { platform: { emitPause(): void } } }).__ns.platform.emitPause());
  expect((await appState(page)).pauses).toContain('platform');
  await page.evaluate(() => (window as unknown as { __ns: { platform: { emitResume(): void } } }).__ns.platform.emitResume());
  expect((await appState(page)).pauses).not.toContain('platform');

  // death → revive for a (mock) rewarded video → death again → results
  // (a level-up choice may be open at any moment: the player can only die while playing)
  const kill = async () => {
    for (let i = 0; i < 10 && (await page.locator('.card').count()) > 0; i++) {
      await page.locator('.card:not(.locked)').first().click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => {
      const a = (window as unknown as { __ns: { godMode: boolean; world: { player: { inv: number }; hurtPlayer(d: number, x: number, y: number): void } } }).__ns;
      a.godMode = false;
      a.world.player.inv = 0;
      a.world.hurtPlayer(99999, 0, 0);
    });
  };
  await kill();
  await page.locator('[data-test=revive-ad]').click({ timeout: 15_000 });
  await expect.poll(async () => (await appState(page)).state, { timeout: 15_000 }).toBe('playing');
  expect((await platformLog(page))).toContain('ad:rewarded');
  await page.waitForTimeout(800);
  await kill();
  // the ad revive is spent and there are no free revives: straight to the results
  await expect(page.locator('[data-screen=results]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-test=revive-decline]')).toHaveCount(0);
  expect((await platformLog(page)).at(-1)).toBe('gameplay:stop');

  // ×2 bits through a (mock) rewarded video
  const double = page.locator('[data-test=double]');
  if (await double.isVisible()) {
    await double.click();
    await expect(double).toBeDisabled();
  }
  await page.locator('[data-test=continue]').click();
  await expect(page.locator('[data-test=play]').last()).toBeVisible({ timeout: 10_000 });

  // a second run reuses the HUD element: it must be visible again (regression)
  // the daily reward popup may open shortly after returning to the menu
  const claim = page.locator('[data-test=claim]');
  await claim.waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
  if (await claim.isVisible()) await claim.click();
  await expect(page.locator('.modal')).toHaveCount(0, { timeout: 5000 });
  await page.locator('[data-test=play]').last().click();
  await page.locator('[data-test=start]').click();
  const hud = page.locator('.hud');
  await expect(hud).toBeVisible();
  await expect(hud).not.toHaveClass(/leave/);
  await expect.poll(() => hud.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 5000 }).toBeGreaterThan(0.9);

  expect(errors).toEqual([]);
});

test('bot survives 60 seconds of game time without exceptions', async ({ page }) => {
  // software rendering in headless CI can run well below real time at 1920×1080
  test.setTimeout(360_000);
  const errors = collectErrors(page);
  await page.goto('index.html?test=1&mock=1');
  await page.locator('[data-test=play]').click();
  await page.locator('[data-test=start]').click();
  await page.evaluate(() => (window as unknown as { __ns: TestApp }).__ns.enableBot(0.8));
  await expect
    .poll(async () => (await appState(page)).t, { timeout: 330_000, intervals: [2000] })
    .toBeGreaterThan(60);
  const st = await appState(page);
  expect(st.mode).toBe('run');
  expect(st.state).not.toBe('dead');
  expect(st.kills).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('menu screens open without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('index.html?test=1&mock=1');
  await expect(page.locator('[data-test=play]')).toBeVisible({ timeout: 20_000 });
  const cur = '.screen:not(.leave)';
  for (const i of [0, 1, 2, 3, 4]) {
    await expect(page.locator('.screen.leave')).toHaveCount(0);
    await page.locator(`${cur} .tile`).nth(i).click();
    await expect(page.locator(`${cur} .topbar h2`)).toBeVisible();
    await expect(page.locator('.screen.leave')).toHaveCount(0);
    await page.locator(`${cur} .topbar .btn`).first().click();
    await expect(page.locator(`${cur} [data-test=play]`)).toBeVisible();
  }
  await expect(page.locator('.screen.leave')).toHaveCount(0);
  // daily reward modal
  await page.locator(`${cur} .tile`).nth(5).click();
  await page.locator('[data-test=claim]').click();
  await expect(page.locator('[data-test=play]').last()).toBeVisible();
  // no scrollbars on the document
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth > window.innerWidth, document.documentElement.scrollHeight > window.innerHeight]);
  expect(overflow).toEqual([false, false]);
  expect(errors).toEqual([]);
});
