/**
 * Weapon balance bench: one weapon at a time, identical passives, the real wave director and
 * the steering bot for 60 s of game time from a given minute. Reports effective damage per
 * second (overkill excluded), kills and damage dealt to a mini-boss.
 *
 *   npx tsx scripts/weapons-bench.ts [--at 240] [--seeds 3] [--stand] [--only orbit]
 */
import { PASSIVE_IDS } from '../src/data/passives';
import type { PassiveId, WeaponId } from '../src/data/types';
import { EVOLUTIONS, WEAPONS, WEAPON_IDS } from '../src/data/weapons';
import { Bot } from '../src/game/Bot';
import { World } from '../src/game/World';

function arg(name: string, d: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
}
const AT = arg('at', 240);
const SEEDS = arg('seeds', 3);
const LEVEL = arg('level', 20);
const DT = 1 / 30;
/** multiplies enemy HP so kills do not cap the measurement (raw damage throughput) */
const TANK = arg('tank', 1);
const SKILL = arg('skill', 0.7);
/** player stands still inside the swarm (melee weapons' best case) */
const STAND = process.argv.includes('--stand');
/** bench a single weapon */
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

/** a typical mid-run passive set; each weapon also gets its own evolution passive */
const BUILD: [PassiveId, number][] = [
  ['might', 2],
  ['haste', 2],
  ['area', 2],
  ['duration', 2],
];

function bench(id: WeaponId, level: number, evo: boolean, seed: number) {
  const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed, weaponPool: [], passivePool: PASSIVE_IDS });
  w.view.hw = 400;
  w.view.hh = 400;
  const ws = w as unknown as { sector: { hpMult: number } };
  ws.sector = { ...ws.sector, hpMult: ws.sector.hpMult * TANK };
  w.skipTo(AT);
  w.player.level = LEVEL;
  w.weapons.length = 0;
  const wp = w.addWeapon(id, 0);
  wp.level = level;
  const build = [...BUILD];
  const evoP = EVOLUTIONS[WEAPONS[id].evolution].passive;
  if (!build.some(([p]) => p === evoP)) build.push([evoP, 1]);
  for (const [pid, lv] of build) {
    for (let i = 0; i < lv; i++) {
      const has = w.passives.find((p) => p.id === pid);
      w.applyCard({ kind: has ? 'passive_up' : 'passive_new', id: pid, rarity: 0, levelFrom: 0, levelTo: 1, value: 0 });
    }
  }
  if (evo) w.evolve(WEAPONS[id].evolution);
  const bot = new Bot({ skill: SKILL, seed });
  const kills0 = w.run.kills;
  let bossDmg = 0;
  let boss = null as null | { hp: number; alive: boolean };
  for (let f = 0; f < 60 / DT; f++) {
    if (f === Math.round(20 / DT)) {
      const e = w.spawnEnemy('mb_trojan', w.player.x + 260, w.player.y);
      boss = e;
    }
    const bh = boss && boss.alive ? boss.hp : 0;
    w.player.hp = w.stats.maxHp;
    w.player.xpNext = 1e12;
    if (w.state !== 'playing') {
      (w as unknown as { pendingLevels: number }).pendingLevels = 0;
      w.state = 'playing';
    }
    if (STAND) {
      w.input.x = 0;
      w.input.y = 0;
    } else bot.steer(w, DT);
    w.update(DT);
    if (boss && bh > 0) bossDmg += Math.max(0, bh - (boss.alive ? boss.hp : 0));
  }
  return { dps: (w.run.damageBy[id] ?? 0) / 60, kills: w.run.kills - kills0, bossDps: bossDmg / 40 };
}

const rows: string[] = [];
for (const id of WEAPON_IDS.filter((x) => !ONLY || x === ONLY)) {
  for (const [label, lv, evo] of [['L1', 1, false], ['L3', 3, false], ['L5', 5, false], ['EVO', 5, true]] as const) {
    let dps = 0;
    let kills = 0;
    let bossDps = 0;
    for (let s = 1; s <= SEEDS; s++) {
      const r = bench(id, lv, evo, s * 101);
      dps += r.dps / SEEDS;
      kills += r.kills / SEEDS;
      bossDps += r.bossDps / SEEDS;
    }
    rows.push(`${id.padEnd(10)} ${label.padEnd(4)} dps ${Math.round(dps).toString().padStart(6)}  kills/min ${Math.round(kills).toString().padStart(5)}  boss dps ${Math.round(bossDps).toString().padStart(5)}`);
  }
}
console.log(`minute ${AT / 60}, seeds ${SEEDS}, tank x${TANK}, ${STAND ? 'standing' : `bot skill ${SKILL}`}`);
console.log(rows.join('\n'));
