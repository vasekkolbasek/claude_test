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
  let choiceSeen = false;
  while (Date.now() - start < 60_000) {
    if (held) await page.keyboard.up(held);
    held = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.down(held);
    const cards = page.locator('.card:not(.locked)');
    const n = await cards.count();
    // the world stands still during an upgrade choice: GameplayAPI must be stopped (Yandex 1.19.3)
    if (n > 0 && !choiceSeen) {
      choiceSeen = true;
      expect((await platformLog(page)).at(-1)).toBe('gameplay:stop');
    }
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
  expect(choiceSeen).toBe(true);
  expect((await platformLog(page)).at(-1)).toBe('gameplay:start');

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
  // die again in the middle of a boss fight (the boss bars must not leak into the next run);
  // two mini-bosses alive at once get a bar each
  await page.evaluate(() => (window as unknown as { __ns: { sandbox(c: unknown): void } }).__ns.sandbox({ spawn: [['mb_trojan', 1, 260], ['mb_crypto', 1, 300]] }));
  await expect(page.locator('.bossbar.on')).toHaveCount(2, { timeout: 5000 });
  await expect(page.locator('.bossbars.multi')).toHaveCount(1);
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
  // nothing from the previous run's HUD survives (boss bar, boss pointer, low-HP vignette)
  await expect(page.locator('.bossbar.on, .boss-ptr.on, .danger-vignette.on')).toHaveCount(0);
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
  // a brand-new player sees only «Играть»
  await expect(page.locator(`${cur} .tile`)).toHaveCount(0);
  // a seasoned player: every feature, each marked «new» until visited
  await page.evaluate(() => {
    const a = (window as unknown as { __ns: { save: { data: { stats: { runs: number }; endlessUnlocked: boolean } }; goMenu(ad: boolean): void } }).__ns;
    a.save.data.stats.runs = 10;
    a.save.data.endlessUnlocked = true;
    a.goMenu(false);
  });
  const claimFirst = page.locator('[data-test=claim]');
  await claimFirst.waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
  if (await claimFirst.isVisible()) await claimFirst.click();
  await expect(page.locator('.modal')).toHaveCount(0, { timeout: 5000 });
  for (const f of ['workshop', 'characters', 'achievements', 'codex', 'leaders']) {
    await expect(page.locator('.screen.leave')).toHaveCount(0);
    await page.locator(`${cur} [data-feature=${f}]`).click();
    await expect(page.locator(`${cur} .topbar h2`)).toBeVisible();
    await expect(page.locator('.screen.leave')).toHaveCount(0);
    await page.locator(`${cur} .topbar .btn`).first().click();
    await expect(page.locator(`${cur} [data-test=play]`)).toBeVisible();
    await expect(page.locator(`${cur} [data-feature=${f}] .new-tag`)).toHaveCount(0);
  }
  await expect(page.locator('.screen.leave')).toHaveCount(0);
  // daily reward modal
  await page.locator(`${cur} [data-feature=daily]`).click();
  await page.locator('[data-test=claim]').click();
  await expect(page.locator('[data-test=play]').last()).toBeVisible();
  // no scrollbars on the document
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth > window.innerWidth, document.documentElement.scrollHeight > window.innerHeight]);
  expect(overflow).toEqual([false, false]);
  expect(errors).toEqual([]);
});

test('sound comes back after the page was in the background, even if the phone wants a touch', async ({ page }) => {
  await page.addInitScript(() => {
    let vis: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => vis });
    Object.defineProperty(document, 'hidden', { get: () => vis === 'hidden' });
    const w = window as unknown as { __setVis(v: DocumentVisibilityState): void; __refuse: boolean };
    w.__setVis = (v) => {
      vis = v;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    // like a phone after the background: resume() outside a touch / key handler is refused
    let inGesture = false;
    for (const ev of ['pointerdown', 'touchend', 'keydown']) {
      window.addEventListener(ev, () => {
        inGesture = true;
        setTimeout(() => (inGesture = false), 0);
      }, true);
    }
    w.__refuse = false;
    const orig = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function (this: AudioContext) {
      return w.__refuse && !inGesture ? Promise.reject(new Error('not allowed')) : orig.call(this);
    };
  });
  await page.goto('index.html?test=1&mock=1');
  await expect(page.locator('[data-test=play]')).toBeVisible({ timeout: 20_000 });
  await page.mouse.click(5, 200); // first gesture unlocks audio
  const state = () => page.evaluate(() => (window as unknown as { __ns: { audio: { ctx: AudioContext | null } } }).__ns.audio.ctx?.state);
  await expect.poll(state).toBe('running');
  await page.evaluate(() => {
    const w = window as unknown as { __setVis(v: string): void; __refuse: boolean };
    w.__refuse = true;
    w.__setVis('hidden');
  });
  await expect.poll(state).toBe('suspended');
  await page.evaluate(() => (window as unknown as { __setVis(v: string): void }).__setVis('visible'));
  await page.mouse.click(5, 200); // the first touch after coming back
  await expect.poll(state).toBe('running');
  expect(await page.evaluate(() => (window as unknown as { __ns: TestApp }).__ns.audio.muted)).toBe(false);
});

test('settings window never scrolls sideways', async ({ page }) => {
  await page.goto('index.html?test=1&mock=1');
  await expect(page.locator('[data-test=play]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (window as unknown as { __ns: { ui: { closeAllModals(): void } } }).__ns.ui.closeAllModals());
  await page.locator('.menu .head .btn.icon-only').click();
  const dialog = page.locator('.dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => getComputedStyle(el).overflowX)).toBe('hidden');
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
