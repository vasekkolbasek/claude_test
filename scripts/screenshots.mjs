// Captures store media from the real game build (run `npm run build` first).
//   node scripts/screenshots.mjs           → release/icon-512.png, covers, screenshots/*.png
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 4190;
const BASE = `http://localhost:${PORT}/game/`;
const OUT = 'release';
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });

const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(w, h, scale, lang, extra = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale, hasTouch: h > w, isMobile: h > w });
  await page.addInitScript((l) => {
    try { localStorage.setItem('lastbastion.save', JSON.stringify({ v: 2, t: Date.now(), glory: 2600, tutorialDone: true, settings: { music: 0, sfx: 0, vibration: false, quality: 'high', lang: l }, maps: { valley: { won: true, best: 8, wins: 1, endlessBest: 14 }, swamp: { won: true, best: 10, wins: 1, endlessBest: 0 }, pass: { won: false, best: 7, wins: 0, endlessBest: 0 } } })); } catch { /* ignore */ }
  }, lang);
  await page.goto(`${BASE}?shot=1${extra}`);
  await page.waitForFunction(() => window.__lb, null, { timeout: 60000 });
  await page.evaluate(() => window.__lb.app.stage.setQualitySetting('high'));
  return page;
}

const frame = (page, ms = 1200) => page.waitForTimeout(ms);

// Scene helpers executed in the page.
const scenes = {
  async golden(page) {
    await page.evaluate(() => {
      const a = window.__lb.app;
      a.startRun('coast', false, 11);
      a.debugSetup({ tier: 2, coins: 34, night: 6, hero: [6.4, 9.6], facing: -2.4, dayness: 0.62, skip: ['tower3', 'range1'] });
      a.setSpeed(0.0001);
      a.stage.zoom = 0.95;
      document.querySelectorAll('.banner').forEach((b) => b.remove());
    });
    await frame(page, 1500);
    // Hero holding the build button on an empty slot: ring + flying coins.
    await page.evaluate(() => {
      const a = window.__lb.app, g = a.game;
      const b = g.bySlot.get('tower3');
      g.hero.x = b.x + 2.4; g.hero.z = b.z + 0.6; g.hero.facing = -1.6;
      g.hold = { b, t: 0.32, need: 0.45, cost: 5 };
      let n = 0;
      const id = setInterval(() => { g.events.emit('coinIn', { b }); if (++n > 3) clearInterval(id); }, 90);
    });
    await frame(page, 260);
  },
  async nightBattle(page, map = 'swamp') {
    await page.evaluate((map) => {
      const a = window.__lb.app;
      a.startRun(map, false, 21);
      const g = a.game;
      a.debugSetup({ tier: 1, coins: 12, night: 7, phase: 'night', dayness: 0.2 });
      const mix = ['grunt', 'shieldbearer', 'grunt', 'runner', 'giant', 'grunt', 'skirmisher', 'raider', 'grunt', 'shieldbearer', 'wisp', 'grunt', 'runner', 'grunt', 'wisp', 'grunt', 'skirmisher', 'grunt'];
      const walls = g.walls.filter((w) => w.alive).slice(0, 2);
      walls.forEach((w, k) => {
        const p = w.slot.path, L = g.paths[p].length, sw = L * w.slot.at;
        a.debugSetup({ spawn: k === 0 ? [...mix, ...mix.slice(0, 8)] : mix.slice(0, 12), spawnPath: p, spawnS: sw - 16 });
      });
      const w0 = walls[0];
      const pt = g.paths[w0.slot.path].sample(g.paths[w0.slot.path].length * w0.slot.at + 3, { x: 0, z: 0, tx: 0, tz: 0 });
      g.hero.x = pt.x; g.hero.z = pt.z;
      a.fastForward(3.4);
      g.input.ability = true;
      a.fastForward(0.15);
      a.setSpeed(0.0001);
      document.querySelectorAll('.banner').forEach((b) => b.remove());
      let cx = 0, cz = 0, n = 0;
      for (const u of g.units) if (u.team === 1 && Math.hypot(u.x - g.hero.x, u.z - g.hero.z) < 16) { cx += u.x; cz += u.z; n++; }
      if (n) a.stage.follow((cx / n + g.hero.x) / 2, 0, (cz / n + g.hero.z) / 2, 0, true);
      a.stage.zoom = 0.82;
      a.view.showcase = false;
    }, map);
    await frame(page, 300);
    await page.evaluate(() => { const a = window.__lb.app; const g = a.game; let cx = 0, cz = 0, n = 0; for (const u of g.units) if (u.team === 1 && Math.hypot(u.x - g.hero.x, u.z - g.hero.z) < 16) { cx += u.x; cz += u.z; n++; } a.view.update = ((orig) => function (dt, t) { orig.call(this, dt, t); if (n) a.stage.follow((cx / n + g.hero.x) / 2, 0, (cz / n + g.hero.z) / 2, 0, true); a.stage.zoom = 0.82; })(a.view.update); });
    await frame(page, 1300);
  },
  async boss(page) {
    await page.evaluate(() => {
      const a = window.__lb.app;
      a.startRun('coast', false, 31);
      const g = a.game;
      a.debugSetup({ tier: 1, night: 8, phase: 'night', dayness: 0.2 });
      const w = g.bySlot.get('wall1');
      const L = g.paths[0].length, sw = L * w.slot.at;
      a.debugSetup({ spawn: ['boss_tide', 'grunt', 'grunt', 'grunt', 'shieldbearer', 'grunt', 'runner', 'grunt', 'skirmisher', 'grunt'], spawnPath: 0, spawnS: sw - 12 });
      const pt = g.paths[0].sample(sw + 3.5, { x: 0, z: 0, tx: 0, tz: 0 });
      g.hero.x = pt.x; g.hero.z = pt.z;
      a.fastForward(4.5);
      a.setSpeed(0.0001);
      document.querySelectorAll('.banner').forEach((b) => b.remove());
      const boss = g.bossUnit;
      const fx = boss ? (boss.x + g.hero.x) / 2 : g.hero.x, fz = boss ? (boss.z + g.hero.z) / 2 : g.hero.z;
      a.view.update = ((orig) => function (dt, t) { orig.call(this, dt, t); a.stage.follow(fx, 0, fz, 0, true); a.stage.zoom = 0.8; })(a.view.update);
    });
    await frame(page, 1500);
  },
  async buildDay(page) {
    await page.evaluate(() => {
      const a = window.__lb.app;
      a.startRun('pass', false, 41);
      a.debugSetup({ tier: 1, coins: 23, night: 3, hero: [-5.5, 3.5], facing: 2.4, dayness: 1, skip: ['tower2', 'tower4', 'magic1', 'range1', 'barracks2', 'mine1', 'forge1', 'wall2', 'wall4', 'tower5', 'range2'] });
      a.setSpeed(0.0001);
      setTimeout(() => document.querySelectorAll('.banner').forEach((b) => b.remove()), 50);
    });
    await frame(page, 1600);
  },
  async choice(page) {
    await page.evaluate(() => {
      const a = window.__lb.app;
      a.startRun('valley', false, 51);
      const g = a.game;
      a.debugSetup({ tier: 1, coins: 40, night: 4, dayness: 1, skip: ['magic1'] });
      const b = g.bySlot.get('tower1');
      g.applyNode(b, window.__lb.BNODES.tower_archer, false, true);
      g.hero.x = b.x + 2.2; g.hero.z = b.z + 0.8;
      g.choice = { b, options: b.node.next.map((id) => window.__lb.BNODES[id]), cost: 10 };
      a.hud.showChoice(b, g.choice.options);
      a.setSpeed(0.0001);
      setTimeout(() => document.querySelectorAll('.banner').forEach((b) => b.remove()), 50);
    });
    await frame(page, 1500);
  },
};

async function shot(page, file) {
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log('saved', file);
}

try {
  // Store art (not screenshots): icon and covers.
  for (const [kind, w, h, lang, file] of [['icon', 512, 512, 'ru', 'icon-512.png'], ['cover', 800, 470, 'ru', 'cover-800x470-ru.png'], ['cover', 800, 470, 'en', 'cover-800x470-en.png']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}?shot=1&promo=${kind}&lang=${lang}`);
    await page.waitForFunction(() => window.__lb, null, { timeout: 60000 });
    await frame(page, 2500);
    await shot(page, file);
    await page.close();
  }
  // Landscape 1920×1080 (RU)
  let page = await open(1920, 1080, 1, 'ru');
  await scenes.golden(page); await shot(page, 'screenshots/ru-1-landscape-build.png');
  await scenes.nightBattle(page, 'swamp'); await shot(page, 'screenshots/ru-2-landscape-night-battle.png');
  await scenes.boss(page); await shot(page, 'screenshots/ru-3-landscape-boss.png');
  await scenes.buildDay(page); await shot(page, 'screenshots/ru-4-landscape-mountain-pass.png');
  await scenes.choice(page); await shot(page, 'screenshots/ru-5-landscape-upgrade-choice.png');
  await page.close();
  // Portrait 1080×1920 (RU)
  page = await open(540, 960, 2, 'ru');
  await scenes.nightBattle(page, 'valley'); await shot(page, 'screenshots/ru-6-portrait-night.png');
  await scenes.golden(page); await shot(page, 'screenshots/ru-7-portrait-build.png');
  await page.close();
  // English landscape set
  page = await open(1920, 1080, 1, 'en');
  await scenes.golden(page); await shot(page, 'screenshots/en-1-landscape-build.png');
  await scenes.nightBattle(page, 'swamp'); await shot(page, 'screenshots/en-2-landscape-night-battle.png');
  await scenes.choice(page); await shot(page, 'screenshots/en-3-landscape-upgrade-choice.png');
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
