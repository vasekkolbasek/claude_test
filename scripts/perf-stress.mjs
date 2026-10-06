// Stress benchmark: a late-game crowd (≈600 enemies, shooters, every evolved weapon) rendered
// frame by frame with the ticker stopped; reports the CPU cost of simulation, view (fx/sprites)
// and the Pixi render pass, plus a CPU profile's hottest functions.
//   npm run build && node scripts/serve.mjs dist 4192 / & node scripts/perf-stress.mjs [WxH] [frames]
import { chromium } from 'playwright';
const [W, H] = (process.argv[2] ?? '1280x800').split('x').map(Number);
const FRAMES = Number(process.argv[3] ?? 240);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:4192/index.html?test=1&mock=1&capture=1&q=2');
await p.waitForFunction(() => window.__ns && document.querySelector('[data-test=play]'));
await p.evaluate(() => {
  const a = window.__ns;
  a.save.data.stats.runs = 20;
});
await p.locator('[data-test=play]').click();
await p.locator('[data-test=start]').click();
await p.waitForTimeout(300);
await p.evaluate(() => {
  const a = window.__ns;
  a.godMode = true;
  a.enableBot(0.8);
  a.world.player.xpNext = 1e12;
  a.sandbox({ time: 200, evolve: ['pulse_evo', 'orbit_evo', 'chain_evo', 'laser_evo', 'missiles_evo', 'shockwave_evo'] });
});
const result = await p.evaluate(async (FRAMES) => {
  const a = window.__ns;
  const w = a.world;
  const ids = ['grunt', 'swarmer', 'tank', 'shooter', 'sniper', 'spawner', 'weaver', 'phantom', 'bomber'];
  const top = () => {
    const need = 600 - w.enemies.length;
    for (let i = 0; i < need; i++) {
      const id = ids[i % ids.length];
      const ang = Math.random() * Math.PI * 2;
      const r = 200 + Math.random() * 500;
      try { w.spawnEnemy(id, w.player.x + Math.cos(ang) * r, w.player.y + Math.sin(ang) * r); } catch { /* unknown id */ }
    }
  };
  const t = { playing: 0, kills: 0, sim: 0, view: 0, hud: 0, render: 0, frames: 0, enemies: 0, eb: 0, b: 0, fx: 0 };
  const wrap = (obj, name, key) => {
    const f = obj[name].bind(obj);
    obj[name] = (...args) => { const t0 = performance.now(); const r = f(...args); t[key] += performance.now() - t0; return r; };
  };
  wrap(w, 'update', 'sim');
  wrap(a.view, 'render', 'view');
  wrap(a.view, 'consume', 'view');
  wrap(a.hud, 'update', 'hud');
  const pr = a.pixi.render.bind(a.pixi);
  // warm-up
  for (let i = 0; i < 30; i++) { top(); a.captureFrame(1 / 60); }
  for (const k of Object.keys(t)) t[k] = 0;
  for (let i = 0; i < FRAMES; i++) {
    if (i % 10 === 0) top();
    a.captureFrame(1 / 60);
    const t0 = performance.now(); pr(); t.render += performance.now() - t0; // second render to time it alone
    t.frames++; t.playing += w.state === 'playing' ? 1 : 0;
    t.enemies += w.enemies.length; t.eb += w.ebullets.length; t.b += w.bullets.length; t.fx += a.view.stats().particles;
    if (w.state !== 'playing') { const c = document.querySelector('.card'); c?.click(); }
  }
  t.kills = w.run.kills * t.frames;
  const out = {};
  for (const k of Object.keys(t)) out[k] = +(t[k] / t.frames).toFixed(2);
  return out;
}, FRAMES);
console.log(JSON.stringify(result));
await b.close();
