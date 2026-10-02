/**
 * Headless balance simulator.
 *
 *   npm run sim                      # default: 6 careers
 *   npm run sim -- --careers 10 --runs 8 --skill 0.35 --learn 0.05
 *
 * A "career" is a sequence of runs by the same bot player: after each run the earned bits are
 * spent in the Workshop (cheapest available upgrade first), the bot's skill grows a little
 * (players learn), and the next sector is attempted after a win.
 * Reports survival time, level tempo, bits and the run on which the first victory happened.
 */
import { WORKSHOP } from '../src/data/workshop';
import { PASSIVE_IDS } from '../src/data/passives';
import { WEAPON_IDS } from '../src/data/weapons';
import { Bot } from '../src/game/Bot';
import { World } from '../src/game/World';
import { checkAchievements } from '../src/meta/achievements';
import { applyRunResult, runBonuses } from '../src/meta/progress';
import { defaultSave, type SaveData } from '../src/meta/save';
import { buyNode, nodeAvailable, nodeCost } from '../src/meta/workshop';
import type { SectorId } from '../src/data/types';

function arg(name: string, d: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
}

const CAREERS = arg('careers', 6);
const RUNS = arg('runs', 8);
const SKILL0 = arg('skill', 0.35);
const LEARN = arg('learn', 0.05);
const DT = 1 / 30;
const OFFSET = arg('offset', 0);
const VERBOSE = process.argv.includes('--verbose');
const TRACE = process.argv.includes('--trace');

export interface RunReport {
  sector: SectorId;
  t: number;
  level: number;
  kills: number;
  bits: number;
  won: boolean;
  maxEnemies: number;
  levelTimes: number[];
  weapons: string;
  hpLeft: number;
  timeout: boolean;
  bossFights: string;
}

function spend(save: SaveData): string[] {
  const bought: string[] = [];
  for (let guard = 0; guard < 100; guard++) {
    let best: string | null = null;
    let bestCost = Infinity;
    for (const n of WORKSHOP) {
      if (!nodeAvailable(save, n.id)) continue;
      const c = nodeCost(save, n.id);
      if (c !== null && c <= save.bits && c < bestCost) {
        best = n.id;
        bestCost = c;
      }
    }
    if (!best) break;
    buyNode(save, best);
    bought.push(best);
  }
  return bought;
}

export function simulateRun(save: SaveData, sector: SectorId, skill: number, seed: number): RunReport {
  const w = new World({ mode: 'normal', sector, character: save.char, seed, bonuses: runBonuses(save), weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
  w.view.hw = 260;
  w.view.hh = 520;
  const bot = new Bot({ skill, seed: seed * 7 + 1 });
  let maxEnemies = 0;
  const levelTimes: number[] = [];
  let revived = false;
  let frames = 0;
  let nextTrace = 60;
  const bossSpawn = new Map<number, [string, number]>();
  const fights: string[] = [];
  let lastDmg = 0;
  const trace: string[] = [];
  while (frames++ < 30 * 60 * 15) {
    if (w.state === 'levelup') {
      levelTimes.push(w.t);
      w.chooseCard(bot.pick(w.choices, w));
      continue;
    }
    if (w.state === 'dead') {
      // a typical player takes the free revive and about half take the ad revive
      if (!revived && (w.stats.revives > 0 || seed % 2 === 0)) {
        revived = true;
        w.revive();
        continue;
      }
      break;
    }
    if (w.state === 'won') break;
    bot.steer(w, DT);
    const before = new Set(w.bosses);
    w.update(DT);
    for (const b of w.bosses) if (!before.has(b)) bossSpawn.set(b.uid, [b.def.id, w.t]);
    for (const b of before) if (!b.alive && bossSpawn.has(b.uid)) {
      const [id, t0] = bossSpawn.get(b.uid) as [string, number];
      fights.push(`${id.replace('mb_', '')}:${Math.round(w.t - t0)}s`);
      bossSpawn.delete(b.uid);
    }
    if (w.enemies.length > maxEnemies) maxEnemies = w.enemies.length;
    if (TRACE && w.t >= nextTrace) {
      const dmg = Object.values(w.run.damageBy).reduce((a, b) => a + (b ?? 0), 0);
      trace.push(`  ${Math.round(w.t / 60)}m lvl ${w.player.level} alive ${w.enemies.length} dps ${Math.round((dmg - lastDmg) / 60)} hpMult ${w.wave.hpMult.toFixed(1)} hp ${Math.round(w.player.hp)} kills ${w.run.kills}`);
      lastDmg = dmg;
      nextTrace += 60;
    }
  }
  const won = w.state === 'won';
  if (TRACE) console.log(trace.join('\n'));
  const summary = applyRunResult(save, w, won);
  return {
    sector,
    t: w.t,
    level: w.player.level,
    kills: w.run.kills,
    bits: summary.bits,
    won,
    maxEnemies,
    levelTimes,
    weapons: w.weapons.map((x) => `${x.id}${x.evo ? '*' : x.level}`).join(' '),
    hpLeft: Math.round(w.player.hp),
    timeout: w.state === 'playing',
    bossFights: fights.join(' '),
  };
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function main(): void {
  const firstRun: number[] = [];
  const winRun: number[] = [];
  const order: SectorId[] = ['ram', 'cpu', 'gpu', 'bin'];
  const t0 = Date.now();
  for (let c = 0; c < CAREERS; c++) {
    const save = defaultSave();
    let skill = SKILL0;
    let sectorIdx = 0;
    let firstWin = -1;
    if (VERBOSE) console.log(`\n=== career ${c + 1} ===`);
    for (let r = 0; r < RUNS; r++) {
      const sector = order[Math.min(sectorIdx, order.length - 1)];
      const rep = simulateRun(save, sector, skill, 1000 * (c + OFFSET) + r + 1);
      checkAchievements(save, null, false);
      const bought = spend(save);
      if (r === 0) firstRun.push(rep.t);
      if (rep.won && firstWin < 0 && sector === 'ram') firstWin = r + 1;
      if (rep.won) sectorIdx++;
      if (VERBOSE) {
        const l10 = rep.levelTimes[8] ?? NaN;
        console.log(
          `run ${r + 1} [${sector}] skill ${skill.toFixed(2)}: ${rep.won ? 'WIN ' : rep.timeout ? 'TIME' : 'dead'} ${fmt(rep.t)} lvl ${rep.level} kills ${rep.kills} maxE ${rep.maxEnemies} bits +${rep.bits} (bank ${save.bits}) lvl10@${fmt(l10)} | ${rep.weapons} | ${rep.bossFights} | bought ${bought.length}`,
        );
      }
      skill = Math.min(0.9, skill + LEARN);
    }
    winRun.push(firstWin);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log('\n--- summary ---');
  console.log(`first run survival: avg ${fmt(avg(firstRun))}  [${firstRun.map(fmt).join(', ')}]`);
  console.log(`RAW first=${JSON.stringify(firstRun.map((x) => Math.round(x)))} win=${JSON.stringify(winRun)}`);
  console.log(`run of first RAM victory: [${winRun.map((x) => (x < 0 ? '—' : x)).join(', ')}]`);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

main();
