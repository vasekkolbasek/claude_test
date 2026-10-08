// Generates store materials into release/: icon, covers and gameplay screenshots (RU + EN).
// Usage: npm run build && node scripts/shots.mjs
//        node scripts/shots.mjs --candidates <dir>   every scene in both orientations (RU) to pick from
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

/**
 * Scene scripts run in the page; `ns` is the App test hook. Normal-mode scenes stay before 7:15:
 * the Chaos Core comes at 6:00, and after that the overtime swarm grows into one blob.
 */
const SCENES = {
  battle: `ns.startRun('ram','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 262, give: [['pulse',4],['orbit',3],['chain',3],['drones',2]], passives: [['might',2],['area',1]],
      spawn: [['byte',26,260],['worm',18,330],['trojan',8,400],['dasher',6,300],['splitter',6,360],['spammer',4,420],['mb_trojan',1,330]] });
    ns.world.player.level = 18; ns.world.player.xp = ns.world.player.xpNext * 0.62;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3200);`,
  boss: `ns.startRun('cpu','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 362, give: [['pulse',5],['orbit',5],['missiles',5],['shockwave',4],['drones',4]], passives: [['might',4],['area',3],['haste',3]], evolve: ['pulse_evo','missiles_evo'],
      spawn: [['byte',30,340],['dasher',8,380],['nano',30,300],['worm',16,420]] });
    { const w = ns.world; w.spawnEnemy('boss_core', w.player.x + 40, w.player.y - 200); }
    ns.world.player.level = 34; ns.world.player.xpNext = 1e9; ns.world.player.xp = 3.1e8;
    await wait(3600);`,
  hydra: `ns.startRun('ram','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 300, give: [['orbit',5],['chain',5],['missiles',3],['drones',3]], passives: [['area',3],['crit',2]], evolve: ['orbit_evo'],
      spawn: [['shielded',8,360],['medic',3,420],['rootkit',8,300],['bomber',6,330],['mb_hydra',1,280]] });
    ns.world.player.level = 34;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3600);`,
  evo: `ns.startRun('bin','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 330, give: [['laser',5],['orbit',5],['missiles',5],['drones',5],['pulse',5]], passives: [['duration',3],['area',3],['haste',2],['regen',1]], evolve: ['laser_evo','orbit_evo','missiles_evo','drones_evo'],
      spawn: [['trojan',16,360],['shielded',12,300],['byte',30,420],['glitch',8,330],['medic',3,450]] });
    ns.world.player.level = 36;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3400);`,
  swarm: `ns.startRun('gpu','endless');
    await wait(400);
    ns.sandbox({ god: true, skip: 760, give: [['pulse',5],['shockwave',5],['chain',5],['mines',5],['drones',4]], passives: [['might',5],['magnet',3],['speed',2]], evolve: ['pulse_evo','shockwave_evo','chain_evo'],
      spawn: [['nano',60,380],['worm',40,450],['byte',40,520],['splitter',20,470],['spawner',4,560]] });
    ns.world.player.level = 52;
    ns.world.player.xpNext = 1e9; ns.world.player.xp = 6.2e8; ns.enableBot(0.9); await wait(3600);`,

  bosses: `ns.startRun('cpu','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 362, give: [['pulse',5],['orbit',5],['missiles',5],['chain',4],['drones',4]], passives: [['might',4],['area',3],['haste',3]], evolve: ['orbit_evo','missiles_evo'],
      spawn: [['byte',34,360],['nano',34,300],['dasher',8,400],['worm',20,440]] });
    { const w = ns.world; w.spawnEnemy('mb_hydra', w.player.x - 170, w.player.y + 190); w.spawnEnemy('boss_core', w.player.x + 30, w.player.y - 260); }
    ns.world.player.level = 35; ns.world.player.xpNext = 1e9; ns.world.player.xp = 4.4e8; ns.enableBot(0.9);
    await wait(3400);`,
  blades: `ns.startRun('ram','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 300, give: [['orbit',5],['pulse',4],['mines',3],['drones',3]], passives: [['area',4],['might',3],['speed',1]], evolve: ['orbit_evo'],
      spawn: [['byte',56,300],['worm',44,380],['trojan',12,440],['splitter',12,340],['mb_crypto',1,300]] });
    ns.world.player.level = 29; ns.world.player.xpNext = 1e9; ns.world.player.xp = 5.4e8; ns.enableBot(0.9);
    await wait(3000);`,
  overclock: `ns.startRun('gpu','normal');
    await wait(400);
    ns.sandbox({ god: true, skip: 240, give: [['laser',4],['chain',4],['shockwave',3],['drones',3]], passives: [['haste',2],['crit',2]],
      spawn: [['nano',46,320],['glitch',12,360],['worm',36,420],['mb_overclock',1,260]] });
    ns.world.player.level = 21; ns.world.player.xpNext = 1e9; ns.world.player.xp = 3.4e8; ns.enableBot(0.9);
    await wait(3200);`,
};

const SETS = [
  // picked from `--candidates`; no level-up screen: its dimmed card overlay leaves well under 70 % gameplay
  { name: 'portrait', viewport: { width: 540, height: 960 }, scenes: ['evo', 'boss', 'bosses', 'blades', 'overclock'] },
  { name: 'landscape', viewport: { width: 960, height: 540 }, scenes: ['evo', 'boss', 'blades', 'overclock', 'battle'] },
];

const candIdx = process.argv.indexOf('--candidates');
const candDir = candIdx > 0 ? process.argv[candIdx + 1] : '';
if (candDir) {
  for (const set of SETS) set.scenes = Object.keys(SCENES);
}

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  mkdirSync(candDir || `${OUT}/screenshots`, { recursive: true });
  // store art
  for (const [kind, lang, w, h, file] of candDir ? [] : [
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
  for (const lang of process.argv.includes('--art-only') ? [] : candDir ? ['ru'] : ['ru', 'en']) {
    for (const set of SETS) {
      let i = 0;
      for (const scene of set.scenes) {
        i++;
        const page = await browser.newPage({ viewport: set.viewport, deviceScaleFactor: 2, hasTouch: set.name === 'portrait' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((d) => localStorage.setItem('neon-swarm:save', d), JSON.stringify(save));
        await page.goto(`${BASE}?test=1&q=2&seed=${8 + Object.keys(SCENES).indexOf(scene)}&lang=${lang}`);
        await page.waitForFunction(() => !!window.__ns && document.querySelector('[data-test=play]'));
        await page.evaluate(`(async () => { const ns = window.__ns; const wait = (ms) => new Promise(r => setTimeout(r, ms)); ns.save.data.daily.lastClaim = Math.floor(Date.now() / 86400000); ns.ui.closeAllModals(); ${SCENES[scene]} })()`);
        const file = candDir ? `${candDir}/${set.name}-${scene}.png` : `${OUT}/screenshots/${lang}-${set.name}-${i}-${scene}.png`;
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
if (!candDir) writeFileSync(`${OUT}/screenshots/README.txt`, 'Portrait 1080x1920 and landscape 1920x1080 gameplay screenshots, rendered by scripts/shots.mjs from the release build.\n');
