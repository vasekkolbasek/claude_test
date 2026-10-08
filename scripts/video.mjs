// Renders deterministic gameplay videos (MP4/H.264) for the Yandex Games draft.
// Usage: npm run build && node scripts/video.mjs [out dir, default release/video] [--quick]   (needs ffmpeg with libx264 in PATH)
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4191;
const BASE = `http://localhost:${PORT}/`;
const exe = process.env.PW_CHROMIUM || undefined;
const FPS = 30;
const server = spawn('node', ['scripts/serve.mjs', 'dist', String(PORT), '/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const save = {
  v: 2, updatedAt: 1, bits: 2480, workshop: { core_dmg: 3, hp: 3 }, chars: ['spark', 'sentinel', 'volt'], char: 'spark',
  sectorsCleared: ['ram', 'cpu'], endlessUnlocked: true, bestTime: {}, bestEndless: 0, ach: {}, codex: { e: {}, w: [], p: [] },
  stats: { runs: 12 }, settings: { music: 0.7, sfx: 0.8, vibration: true, shake: true, quality: 2 },
  daily: { lastClaim: 99999, streak: 1, questDay: 99999, questId: 'kills', questDone: false }, chestAt: 0, tutorialDone: true, authOffered: 3,
};

/**
 * Staged moments, each a hard cut, at the times they really happen (the Chaos Core comes at 6:00;
 * past 7:15 the overtime swarm grows several-fold and buries everything in one blob).
 * Setup script, seconds, and in-segment cues [fraction of the segment, script].
 */
const SEGMENTS = [
  // hook: four evolutions at once
  [`ns.startRun('bin','normal'); ns.sandbox({ god: true, skip: 330, give: [['laser',5],['chain',5],['missiles',5],['drones',5],['pulse',5]], passives: [['duration',3],['area',3],['haste',2]], evolve: ['laser_evo','chain_evo','missiles_evo','drones_evo'],
      spawn: [['shielded',8,300],['glitch',6,340]] });
    ns.world.player.level = 36; ns.enableBot(0.9);`, 5.5, []],
  // a mini-boss arrives (banner, bar, rumble) and starts shooting
  [`ns.startRun('gpu','normal'); ns.sandbox({ god: true, skip: 200, give: [['laser',4],['chain',4],['shockwave',3],['drones',3]], passives: [['haste',2],['crit',2]],
      spawn: [['nano',40,230],['glitch',10,260],['worm',30,300],['byte',24,340]] });
    ns.world.player.level = 21; ns.enableBot(0.9);`, 6, [[0.12, `{ const w = ns.world; w.spawnEnemy('mb_botnet', w.player.x + 200, w.player.y - 100); }`]]],
  // spinning blades, then an upgrade choice
  [`ns.startRun('ram','normal'); ns.sandbox({ god: true, skip: 300, give: [['orbit',5],['pulse',4],['mines',3],['drones',3]], passives: [['area',4],['might',3]], evolve: ['orbit_evo'],
      spawn: [['byte',40,300],['worm',30,380],['trojan',10,440],['splitter',10,340]] });
    ns.world.player.level = 29; ns.enableBot(0.9);`, 4.5, [[0.5, `ns.bot = null; ns.world.player.xpNext = 140; ns.world.player.xp = 70; ns.world.pendingLevels++;`]]],
  // the Chaos Core joins a mini-boss fight: two bars, the mini-boss falls, then the Core
  // (a modest crowd: hundreds of simultaneous kill bursts turn the frame into a white blob)
  [`ns.startRun('cpu','normal'); ns.sandbox({ god: true, skip: 361, give: [['orbit',5],['missiles',5],['chain',4],['drones',3]], passives: [['might',4],['area',2],['haste',3]], evolve: ['orbit_evo','missiles_evo'],
      spawn: [['byte',8,300],['dasher',4,340],['trojan',4,320]] });
    { const w = ns.world; w.spawnEnemy('mb_hydra', w.player.x - 200, w.player.y + 110); }
    ns.world.player.level = 38;`, 8.5, [
    // no bot here: it would kite the Core off screen and the finale would happen out of frame
    [0.14, `{ const w = ns.world; w.spawnEnemy('boss_core', w.player.x + 210, w.player.y - 90); }`],
    // (its data container would open a choice screen over the finale: no bot here to pick a card)
    [0.42, `{ const w = ns.world; const b = w.bosses.find((x) => x.def.boss === 'mini'); if (b) w.hurtEnemy(b, b.hp + 1, -1, 0, 0, false); for (const g of w.gems) if (g.kind === 3) g.alive = false; }`],
    [0.7, `{ const w = ns.world; const b = w.boss; if (b) w.hurtEnemy(b, b.hp + 1, -1, 0, 0, false); }`],
  ]],
];

async function render(lang, viewport, out) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = `release/build/frames-${lang}-${viewport.width}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // CSS size of a phone / small laptop, rendered at 2x: the game looks as on a device, the file is Full HD
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
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
  for (const [script, seconds, cues] of SEGMENTS) {
    await page.evaluate(`(() => { const ns = window.__ns; ns.ui.closeAllModals(); ${script} ns.world.player.xpNext = 1e9; ns.world.player.xp = 4e8; })()`);
    // half a second off camera: fresh spawns fade in and the weapons spin up before the cut
    for (let i = 0; i < FPS / 2; i++) await page.evaluate((dt) => window.__ns.captureFrame(dt), 1 / FPS);
    const frames = Math.round(seconds * FPS);
    for (let i = 0; i < frames; i++) {
      for (const [at, cue] of cues) {
        if (i === Math.round(frames * at)) await page.evaluate(`(() => { const ns = window.__ns; ${cue} })()`);
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

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) || 'release/video';
const quick = args.includes('--quick'); // RU 16:9 only, to review a cut
try {
  mkdirSync(outDir, { recursive: true });
  for (const lang of quick ? ['ru'] : ['ru', 'en']) {
    await render(lang, { width: 960, height: 540 }, `${outDir}/gameplay-16x9-${lang}.mp4`);
    if (!quick) await render(lang, { width: 540, height: 960 }, `${outDir}/gameplay-9x16-${lang}.mp4`);
  }
} finally {
  server.kill();
}
