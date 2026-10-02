// Renders deterministic gameplay videos (MP4/H.264) for the Yandex Games draft.
// Usage: npm run build && node scripts/video.mjs   (needs ffmpeg with libx264 in PATH)
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4191;
const BASE = `http://localhost:${PORT}/`;
const exe = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FPS = 30;
const server = spawn('node', ['scripts/serve.mjs', 'dist', String(PORT), '/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const save = {
  v: 2, updatedAt: 1, bits: 2480, workshop: { core_dmg: 3, hp: 3 }, chars: ['spark', 'sentinel', 'volt'], char: 'spark',
  sectorsCleared: ['ram', 'cpu'], endlessUnlocked: true, bestTime: {}, bestEndless: 0, ach: {}, codex: { e: {}, w: [], p: [] },
  stats: { runs: 12 }, settings: { music: 0.7, sfx: 0.8, vibration: true, shake: true, quality: 2 },
  daily: { lastClaim: 99999, streak: 1, questDay: 99999, questId: 'kills', questDone: false }, chestAt: 0, tutorialDone: true, authOffered: 3,
};

/** [setup script, seconds] — each segment is a hard cut to a new staged moment. */
const SEGMENTS = [
  [`ns.startRun('ram','normal'); ns.sandbox({ god: true, skip: 150, give: [['pulse',3],['orbit',2],['chain',2]], passives: [['might',1]],
      spawn: [['byte',24,300],['worm',16,360],['dasher',4,330],['trojan',4,420]] });
    ns.world.player.level = 12; ns.enableBot(0.9);`, 7],
  [`ns.startRun('gpu','normal'); ns.sandbox({ god: true, skip: 380, give: [['pulse',5],['shockwave',5],['chain',5],['drones',4],['missiles',3]], passives: [['might',3],['area',2]], evolve: ['pulse_evo','shockwave_evo'],
      spawn: [['nano',40,360],['worm',30,420],['splitter',14,380],['spawner',3,500],['glitch',8,330]] });
    ns.world.player.level = 30; ns.enableBot(0.9);`, 6, 'levelup'],
  [`ns.startRun('cpu','normal'); ns.sandbox({ god: true, skip: 605, give: [['pulse',5],['orbit',5],['missiles',5],['laser',5],['drones',4]], passives: [['might',4],['area',3],['duration',3]], evolve: ['pulse_evo','missiles_evo','orbit_evo'],
      spawn: [['byte',16,360],['dasher',8,400],['nano',16,340]] });
    { const w = ns.world; w.spawnEnemy('boss_core', w.player.x + 40, w.player.y - 260); }
    ns.world.player.level = 44; ns.enableBot(0.9);`, 8, 'boss'],
];

async function render(lang, viewport, out) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = `release/build/frames-${lang}-${viewport.width}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript((d) => localStorage.setItem('neon-swarm:save', d), JSON.stringify(save));
  await page.goto(`${BASE}?test=1&capture=1&q=2&seed=5&lang=${lang}`);
  await page.waitForFunction(() => !!window.__ns);
  await page.evaluate(() => {
    window.__ns.save.data.daily.lastClaim = Math.floor(Date.now() / 86400000);
    window.__ns.ui.closeAllModals();
  });
  let frame = 0;
  const shot = async () => {
    await page.screenshot({ path: `${dir}/${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  };
  for (const [script, seconds, extra] of SEGMENTS) {
    await page.evaluate(`(() => { const ns = window.__ns; ns.ui.closeAllModals(); ${script} ns.world.player.xpNext = 1e9; ns.world.player.xp = 4e8; })()`);
    const frames = Math.round(seconds * FPS);
    for (let i = 0; i < frames; i++) {
      if (extra === 'levelup' && i === Math.round(frames * 0.55)) {
        await page.evaluate(() => {
          const ns = window.__ns;
          ns.bot = null;
          ns.world.player.xpNext = 140;
          ns.world.player.xp = 70;
          ns.world.pendingLevels++;
        });
      }
      if (extra === 'boss' && i === Math.round(frames * 0.62)) {
        await page.evaluate(() => {
          const b = window.__ns.world.boss;
          if (b) b.hp = 1;
        });
      }
      await page.evaluate((dt) => window.__ns.captureFrame(dt), 1 / FPS);
      await shot();
    }
  }
  // hold the results for a moment
  for (let i = 0; i < FPS * 1.5; i++) {
    await page.evaluate((dt) => window.__ns.captureFrame(dt), 1 / FPS);
    await shot();
  }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', out]);
  rmSync(dir, { recursive: true, force: true });
  console.log('✓', out, `${frame} frames`);
}

try {
  mkdirSync('release/video', { recursive: true });
  await render('ru', { width: 1280, height: 720 }, 'release/video/gameplay-16x9-ru.mp4');
  await render('en', { width: 1280, height: 720 }, 'release/video/gameplay-16x9-en.mp4');
  await render('ru', { width: 720, height: 1280 }, 'release/video/gameplay-9x16-ru.mp4');
} finally {
  server.kill();
}
