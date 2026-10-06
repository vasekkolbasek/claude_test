// Generates store materials into release/: icon, covers and gameplay screenshots (RU + EN).
// Usage: npm run build && node scripts/shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4190;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'release';
const exe = process.env.PW_CHROMIUM || undefined;

const server = spawn('node', ['scripts/serve.mjs', 'dist', String(PORT), '/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const save = {
  v: 2, updatedAt: 1, bits: 2480, workshop: { core_dmg: 3, hp: 3, speed: 2, haste: 2, area: 1, magnet: 2, greed: 2 },
  chars: ['spark', 'sentinel', 'volt'], char: 'spark', sectorsCleared: ['ram', 'cpu'], endlessUnlocked: true,
  bestTime: { ram: 640, cpu: 655, gpu: 402 }, bestEndless: 984, ach: { first_run: 1 },
  codex: { e: {}, w: [], p: [] }, stats: { runs: 12 }, settings: { music: 0.7, sfx: 0.8, vibration: true, shake: false, quality: 2 },
  daily: { lastClaim: 99999, streak: 1, questDay: 99999, questId: 'kills', questDone: false }, chestAt: 0, tutorialDone: true, authOffered: 3,
};

/** Scene scripts run in the page; `ns` is the App test hook. */
const SCENES = {
  battle: `ns.startRun('ram','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 262, give: [['pulse',4],['orbit',3],['chain',3],['drones',2]], passives: [['might',2],['area',1]],
      spawn: [['byte',26,260],['worm',18,330],['trojan',8,400],['dasher',6,300],['splitter',6,360],['spammer',4,420],['mb_trojan',1,330]] });
    ns.world.player.level = 18; ns.world.player.xp = ns.world.player.xpNext * 0.62;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3200);`,
  boss: `ns.startRun('cpu','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 605, give: [['pulse',5],['orbit',5],['missiles',5],['shockwave',4],['drones',4]], passives: [['might',4],['area',3],['haste',3]], evolve: ['pulse_evo','missiles_evo'],
      spawn: [['byte',14,340],['dasher',6,380],['nano',14,320]] });
    { const w = ns.world; w.spawnEnemy('boss_core', w.player.x + 40, w.player.y - 250); }
    ns.world.player.level = 41; ns.world.player.xpNext = 1e9; ns.world.player.xp = 3.1e8;
    await wait(3600);`,
  levelup: `ns.startRun('gpu','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 330, give: [['pulse',5],['chain',3],['mines',3]], passives: [['might',1],['luck',2]],
      spawn: [['byte',20,280],['glitch',8,340],['spawner',2,420],['splitter',8,360],['nano',16,300]] });
    ns.world.player.level = 23;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(2200); ns.bot = null; ns.world.player.xpNext = 120; ns.world.player.xp = 60; ns.world.pendingLevels++; await wait(1700);`,
  hydra: `ns.startRun('ram','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 545, give: [['orbit',5],['chain',5],['missiles',3],['drones',3]], passives: [['area',3],['crit',2]], evolve: ['orbit_evo'],
      spawn: [['shielded',8,360],['medic',3,420],['rootkit',8,300],['bomber',6,330],['mb_hydra',1,280]] });
    ns.world.player.level = 34;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3600);`,
  evo: `ns.startRun('bin','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 470, give: [['laser',5],['orbit',5],['missiles',5],['drones',5],['pulse',5]], passives: [['duration',3],['area',3],['haste',2],['regen',1]], evolve: ['laser_evo','orbit_evo','missiles_evo','drones_evo'],
      spawn: [['trojan',16,360],['shielded',12,300],['byte',30,420],['glitch',8,330],['medic',3,450]] });
    ns.world.player.level = 47;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3400);`,
  swarm: `ns.startRun('gpu','endless');
    await wait(400);
    ns.sandbox({ god: true, skip: 760, give: [['pulse',5],['shockwave',5],['chain',5],['mines',5],['drones',4]], passives: [['might',5],['magnet',3],['speed',2]], evolve: ['pulse_evo','shockwave_evo','chain_evo'],
      spawn: [['nano',60,380],['worm',40,450],['byte',40,520],['splitter',20,470],['spawner',4,560]] });
    ns.world.player.level = 52;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3600);`,
};

const SETS = [
  { name: 'portrait', viewport: { width: 540, height: 960 }, scenes: ['battle', 'boss', 'levelup', 'hydra'] },
  { name: 'landscape', viewport: { width: 960, height: 540 }, scenes: ['evo', 'swarm', 'battle'] },
];

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  mkdirSync(`${OUT}/screenshots`, { recursive: true });
  // store art
  for (const [kind, lang, w, h, file] of [
    ['icon', 'ru', 512, 512, 'icon-512.png'],
    ['cover', 'ru', 800, 470, 'cover-800x470-ru.png'],
    ['cover', 'en', 800, 470, 'cover-800x470-en.png'],
    ['hero', 'ru', 1560, 520, 'hero-1560x520-ru.png'],
    ['hero', 'en', 1560, 520, 'hero-1560x520-en.png'],
  ]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(`${BASE}?art=${kind}&lang=${lang}`);
    await p.waitForSelector('body[data-art=ready]');
    await p.locator('#art').screenshot({ path: `${OUT}/${file}` });
    await p.close();
    console.log('✓', file);
  }
  for (const lang of process.argv.includes('--art-only') ? [] : ['ru', 'en']) {
    for (const set of SETS) {
      let i = 0;
      for (const scene of set.scenes) {
        i++;
        const page = await browser.newPage({ viewport: set.viewport, deviceScaleFactor: 2, hasTouch: set.name === 'portrait' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((d) => localStorage.setItem('neon-swarm:save', d), JSON.stringify(save));
        await page.goto(`${BASE}?test=1&q=2&seed=${7 + i}&lang=${lang}`);
        await page.waitForFunction(() => !!window.__ns && document.querySelector('[data-test=play]'));
        await page.evaluate(`(async () => { const ns = window.__ns; const wait = (ms) => new Promise(r => setTimeout(r, ms)); ns.save.data.daily.lastClaim = Math.floor(Date.now() / 86400000); ns.ui.closeAllModals(); ${SCENES[scene]} })()`);
        const file = `${OUT}/screenshots/${lang}-${set.name}-${i}-${scene}.png`;
        await page.screenshot({ path: file });
        if (errors.length) console.warn('page errors:', errors);
        await page.close();
        console.log('✓', file);
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(`${OUT}/screenshots/README.txt`, 'Portrait 1080x1920 and landscape 1920x1080 gameplay screenshots, rendered by scripts/shots.mjs from the release build.\n');
