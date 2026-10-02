/**
 * Headless balance simulator.
 * Simulates "players" (bots of varying skill) who keep playing runs, earning glory and
 * unlocking weapons/perks, and reports how many attempts each map takes to beat.
 *   npm run sim                → default report
 *   npm run sim -- --players 20 --skill 0.75
 */
import { MAP_IDS, type MapId } from '../src/data/maps';
import { PERKS, levelForGlory, perkSlots, type PerkId } from '../src/data/perks';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../src/data/weapons';
import { defaultSave, type SaveData } from '../src/save/save';
import { Bot } from '../src/systems/bot';
import { Game } from '../src/systems/Game';
import { applyRun, isMapUnlocked } from '../src/systems/meta';

const args = process.argv.slice(2);
const opt = (k: string, d: number) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
const PLAYERS = opt('players', 12);
const SKILL = opt('skill', 0.7);
const MAX_ATTEMPTS = opt('attempts', 25);
const PERK_PRIORITY: PerkId[] = ['tithe', 'purse', 'masons', 'drill', 'focus', 'guard', 'harvest', 'stout', 'ramparts', 'swift'];
const WEAPON_PRIORITY: WeaponId[] = ['spear', 'staff', 'sword', 'bow'];

export interface RunOutcome { victory: boolean; nights: number; kills: number; lost: number; seconds: number }

export function simulateRun(map: MapId, weapon: WeaponId, perks: PerkId[], skill: number, seed: number): RunOutcome {
  const g = new Game({ map, weapon, perks, mutators: [], endless: false, seed });
  const bot = new Bot(g, { skill, noise: 0.15 * (1 - skill) + 0.03, seed: seed ^ 0x5bd1 });
  const dt = 1 / 10;
  let t = 0;
  while (g.phase !== 'victory' && g.phase !== 'defeat' && t < 4000) {
    bot.update(dt);
    g.update(dt);
    t += dt;
  }
  return { victory: g.phase === 'victory', nights: g.phase === 'victory' ? g.map.nights : g.night - 1, kills: g.stats.kills, lost: g.stats.lost, seconds: t };
}

function loadout(save: SaveData): { weapon: WeaponId; perks: PerkId[] } {
  const lvl = levelForGlory(save.glory);
  const weapon = WEAPON_PRIORITY.find((w) => WEAPONS[w].unlockLevel <= lvl) ?? 'sword';
  const perks = PERK_PRIORITY.filter((p) => (PERKS.find((x) => x.id === p)?.unlockLevel ?? 99) <= lvl).slice(0, perkSlots(lvl));
  return { weapon, perks };
}

function main(): void {
  const firstWin: Record<MapId, number[]> = { valley: [], swamp: [], pass: [] };
  const levelAtWin: Record<MapId, number[]> = { valley: [], swamp: [], pass: [] };
  const nightsHist: Record<MapId, number[]> = { valley: [], swamp: [], pass: [] };
  const t0 = Date.now();
  for (let p = 0; p < PLAYERS; p++) {
    const save = defaultSave();
    const skill = Math.min(0.95, Math.max(0.3, SKILL + ((p % 5) - 2) * 0.06));
    const attempts: Record<MapId, number> = { valley: 0, swamp: 0, pass: 0 };
    for (let a = 0; a < MAX_ATTEMPTS; a++) {
      const map = MAP_IDS.find((id) => isMapUnlocked(save, id) && !save.maps[id].won);
      if (!map) break;
      attempts[map]++;
      const { weapon, perks } = loadout(save);
      const r = simulateRun(map, weapon, perks, skill, p * 1000 + a * 17 + 1);
      nightsHist[map].push(r.nights);
      applyRun(save, { map, endless: false, victory: r.victory, nights: r.nights, stats: { kills: r.kills, heroKills: 0, lost: r.lost, built: 10, cleanStreak: 0, bestClean: 0, maxIncome: 0, abilityUses: 0, bossKills: r.victory ? 1 : 0, maxArmy: 0, maxCoins: 0, fullUpgrades: 0, castleMinHp: 0 }, weapon, mutators: [] });
      if (r.victory) { firstWin[map].push(attempts[map]); levelAtWin[map].push(levelForGlory(save.glory)); }
    }
    process.stdout.write(`player ${p + 1}/${PLAYERS} skill=${skill.toFixed(2)} attempts=${JSON.stringify(attempts)} level=${levelForGlory(save.glory)}\n`);
  }
  const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  console.log('\n=== Balance report ===');
  for (const id of MAP_IDS) {
    console.log(`${id.padEnd(7)} winners ${firstWin[id].length}/${PLAYERS}  median attempts ${med(firstWin[id])}  attempts ${JSON.stringify(firstWin[id])}  level at win ${JSON.stringify(levelAtWin[id])}  median nights/run ${med(nightsHist[id])}`);
  }
  console.log(`weapons available: ${WEAPON_IDS.join(', ')}; ${(Date.now() - t0) / 1000}s`);
}

main();
