// Full playthrough: a fresh player goes through the real screens (menu → sector → run → level-ups →
// revive → results → menu) with the bot steering; frames are stepped with the ticker stopped, so a
// run takes far less than real time. Logs every run and collects console errors and screenshots.
//   npm run build && node scripts/serve.mjs dist 4192 / & node scripts/playthrough.mjs <outDir> [WxH]
// The plan below: a few honest runs, then god-mode wins through all sectors, then Endless.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'playthrough';
const [W, H] = (process.argv[3] ?? '390x844').split('x').map(Number);
const mobile = W < H;
mkdirSync(out, { recursive: true });
const PLAN = [
  { sector: 'ram', skill: 0.55 },
  { sector: 'ram', skill: 0.6 },
  { sector: 'ram', skill: 0.65 },
  { sector: 'ram', skill: 0.7 },
  { sector: 'ram', skill: 0.75 },
  { sector: 'ram', skill: 0.9, god: true, boost: true },
  { sector: 'cpu', skill: 0.7 },
  { sector: 'cpu', skill: 0.9, god: true, boost: true },
  { sector: 'gpu', skill: 0.9, god: true, boost: true },
  { sector: 'bin', skill: 0.9, god: true, boost: true },
  { sector: 'bin', skill: 0.9, mode: 'endless', godUntil: 480, boost: true },
];

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const p = await b.newPage({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
const errors = [];
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await p.goto('http://localhost:4192/index.html?test=1&mock=1&capture=1');
await p.waitForFunction(() => window.__ns && document.querySelector('[data-test=play]'));
const shot = (name) => p.screenshot({ path: `${out}/${name}.png` });
const vis = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => !x.closest('.leave') && x.offsetParent !== null); return !!e; }, sel);
const click = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => !x.closest('.leave') && x.offsetParent !== null); e?.click(); return !!e; }, sel);
/** steps the frozen ticker so CSS/timers also get real time to run */
const step = (frames) => p.evaluate((n) => {
  const a = window.__ns;
  for (let i = 0; i < n; i++) {
    a.captureFrame(1 / 30);
    if (!a.world || a.world.state !== 'playing' || a.mode !== 'run' || a.pauses.size) break;
  }
  const w = a.world;
  return { mode: a.mode, state: w?.state, t: w?.t ?? 0, pauses: [...a.pauses], enemies: w?.enemies.length ?? 0, level: w?.player.level ?? 0, hp: w?.player.hp ?? 0 };
}, frames);

const log = [];
const menuInfo = async (tag) => {
  // the daily reward pops up by itself once it is open
  await p.waitForTimeout(900);
  if (await vis('[data-test=claim]')) { await click('[data-test=claim]'); await p.waitForTimeout(700); }
  const info = await p.evaluate(() => ({
    tiles: [...document.querySelectorAll('.screen:not(.leave) .tile')].map((t) => t.dataset.feature + (t.classList.contains('is-new') ? '*' : '')),
    hint: document.querySelector('.screen:not(.leave) .feat-hint')?.textContent ?? '',
    quest: document.querySelector('.screen:not(.leave) .quest-card')?.textContent ?? '',
    chest: !!document.querySelector('.screen:not(.leave) .chest-btn'),
    bits: window.__ns.save.data.bits,
    runs: window.__ns.save.data.stats.runs,
  }));
  await shot(`menu-${tag}`);
  return info;
};

for (let r = 0; r < PLAN.length; r++) {
  const plan = PLAN[r];
  const menu = await menuInfo(`${r}`);
  await click('[data-test=play]');
  await p.waitForTimeout(600);
  if (plan.mode === 'endless') await p.evaluate(() => [...document.querySelectorAll('.screen:not(.leave) .seg button')][1]?.click());
  await click(`[data-sector=${plan.sector}]`);
  await p.waitForTimeout(300);
  const prerun = await p.evaluate(() => ({ sel: document.querySelector('.screen:not(.leave) .sector.on')?.dataset.sector, note: [...document.querySelectorAll('.screen:not(.leave) .note')].map((n) => n.textContent).join(' | ') }));
  if (r === 0 || plan.mode === 'endless') await shot(`prerun-${r}`);
  await click('[data-test=start]');
  await p.waitForTimeout(500);
  await p.evaluate((pl) => {
    const a = window.__ns;
    a.enableBot(pl.skill);
    a.godMode = !!(pl.god || pl.godUntil);
    // forced wins: a strong build so the run reaches the Chaos Core and kills it
    if (pl.boost) a.sandbox({ give: [['pulse', 5], ['orbit', 5], ['shockwave', 5]], passives: [['might', 5], ['haste', 5]], evolve: ['pulse_evo'] });
  }, plan);
  let st;
  let levelups = 0, revives = 0, maxEnemies = 0, shots = 0, guard = 0;
  const t0 = Date.now();
  for (;;) {
    if (++guard > 20000) { log.push(`run ${r}: guard stop`); break; }
    if (plan.god || (plan.godUntil && st?.t < plan.godUntil)) await p.evaluate(() => { const w = window.__ns.world; if (w) w.player.inv = 20; });
    st = await step(300);
    maxEnemies = Math.max(maxEnemies, st.enemies);
    if (plan.godUntil && st.t > plan.godUntil) await p.evaluate(() => { window.__ns.godMode = false; });
    if (st.mode !== 'run') break;
    if (st.state === 'levelup' && (await vis('.levelup .card'))) {
      if (shots < 1 && st.level > 6) { await p.waitForTimeout(700); await shot(`levelup-${r}`); shots++; }
      await p.evaluate(() => { const a = window.__ns; const i = a.bot.pick(a.world.choices, a.world); [...document.querySelectorAll('.levelup .card')][i]?.click(); });
      levelups++;
      await p.waitForTimeout(250);
      continue;
    }
    if (await vis('[data-test=revive-ad]') || await vis('[data-test=revive-decline]')) {
      if (r === 0) await shot(`revive-${r}`);
      if (revives === 0 && await vis('[data-test=revive-ad]')) { await click('[data-test=revive-ad]'); await p.waitForTimeout(1300); revives++; }
      else await click('[data-test=revive-decline]');
      await p.waitForTimeout(500);
      continue;
    }
    if (st.pauses.length) await p.waitForTimeout(150);
  }
  // results
  await p.waitForTimeout(1200);
  const res = await p.evaluate(() => {
    const a = window.__ns; const s = a.summary;
    return { won: s?.won, time: s?.time, level: s?.level, kills: s?.kills, bits: s?.bits, news: document.querySelector('.screen:not(.leave) .news')?.textContent ?? '', newsLines: document.querySelectorAll('.screen:not(.leave) .news .pg-page .ni').length, newsPages: document.querySelectorAll('.screen:not(.leave) .news .pg-dot').length || 1,
      weapons: a.world ? a.world.weapons.map((w) => `${w.id}${w.evo ? '★' : ''}:${w.level}`).join(' ') : '', ach: (s?.achievements ?? []).join(',') };
  });
  await shot(`results-${r}`);
  if (r % 2 === 0 && await vis('[data-test=double]')) { await click('[data-test=double]'); await p.waitForTimeout(1300); }
  await click('[data-test=continue]');
  await p.waitForTimeout(1500);
  log.push(JSON.stringify({ run: r, plan, menu, prerun, sec: Math.round((Date.now() - t0) / 1000), levelups, revives, maxEnemies, res }));
  console.log(log.at(-1));
}
const final = await menuInfo('final');
log.push(JSON.stringify({ final }));
// every menu section once
for (const f of ['workshop', 'characters', 'codex', 'achievements', 'leaders']) {
  if (!(await click(`.screen:not(.leave) [data-feature=${f}]`))) { log.push(`no tile ${f}`); continue; }
  await p.waitForTimeout(900);
  await shot(`screen-${f}`);
  await click('.screen:not(.leave) .topbar .btn');
  await p.waitForTimeout(700);
}
writeFileSync(`${out}/log.txt`, `${log.join('\n')}\n\nERRORS:\n${errors.join('\n')}\n`);
console.log('errors:', errors.length);
await b.close();
