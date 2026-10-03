import { ACHIEVEMENTS, type AchievementId } from '../data/achievements';
import { MAP_IDS, MAPS, type MapId } from '../data/maps';
import { MUTATOR_UNLOCK_LEVEL, PERKS, levelForGlory, mutatorMultiplier, type MutatorId } from '../data/perks';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../data/weapons';
import type { SaveData } from '../save/save';
import type { RunStats } from './Game';

export interface RunResult {
  map: MapId;
  endless: boolean;
  victory: boolean;
  nights: number;
  stats: RunStats;
  weapon: WeaponId;
  mutators: MutatorId[];
}

const VICTORY_BONUS: Record<MapId, number> = { valley: 60, swamp: 110, coast: 170, pass: 240, frost: 330 };

export function computeGlory(r: RunResult): number {
  let g = r.nights * (r.endless ? 12 : 15) + Math.floor(r.stats.kills / 4) + r.stats.bossKills * 30;
  if (r.victory && !r.endless) g += VICTORY_BONUS[r.map];
  return Math.round(g * mutatorMultiplier(r.mutators));
}

export function isMapUnlocked(save: SaveData, id: MapId): boolean {
  const i = MAP_IDS.indexOf(id);
  return i === 0 || save.maps[MAP_IDS[i - 1]].won;
}

export function rulerLevel(save: SaveData): number { return levelForGlory(save.glory); }

/** Human readable unlock ids (weapons, perks, mutators) reached when going from level a to b. */
export function unlocksBetween(a: number, b: number): string[] {
  const out: string[] = [];
  for (const w of WEAPON_IDS) if (WEAPONS[w].unlockLevel > a && WEAPONS[w].unlockLevel <= b) out.push(`weapon.${w}`);
  for (const p of PERKS) if (p.unlockLevel > a && p.unlockLevel <= b) out.push(`perk.${p.id}`);
  if (MUTATOR_UNLOCK_LEVEL > a && MUTATOR_UNLOCK_LEVEL <= b) out.push('mut.title');
  return out;
}

export interface MetaOutcome {
  glory: number;
  levelBefore: number;
  levelAfter: number;
  unlocks: string[];
  achievements: AchievementId[];
  record: boolean;
  mapUnlocked: boolean;
}

/** Applies a finished run to the save (pure apart from mutating `save`). */
export function applyRun(save: SaveData, r: RunResult, gloryMul = 1): MetaOutcome {
  const glory = computeGlory(r) * gloryMul;
  const levelBefore = levelForGlory(save.glory);
  const wasUnlocked = MAP_IDS.map((id) => isMapUnlocked(save, id));
  save.glory += glory;
  const levelAfter = levelForGlory(save.glory);
  const mp = save.maps[r.map];
  let record = false;
  if (r.endless) {
    if (r.nights > mp.endlessBest) { mp.endlessBest = r.nights; record = true; }
    save.endlessBest = Math.max(save.endlessBest, r.nights);
  } else {
    if (r.nights > mp.best) { mp.best = r.nights; record = true; }
    if (r.victory) {
      mp.won = true;
      mp.wins++;
      save.totals.wins++;
      if (!save.totals.weaponsWon.includes(r.weapon)) save.totals.weaponsWon.push(r.weapon);
    }
  }
  save.totals.runs++;
  save.totals.kills += r.stats.kills;
  save.totals.built += r.stats.built;
  save.totals.abilities += r.stats.abilityUses;
  const mapUnlocked = MAP_IDS.some((id, i) => !wasUnlocked[i] && isMapUnlocked(save, id));
  const achievements = checkAchievements(save, r);
  return { glory, levelBefore, levelAfter, unlocks: unlocksBetween(levelBefore, levelAfter), achievements, record, mapUnlocked };
}

/** Adds newly earned achievements to the save and returns them. */
export function checkAchievements(save: SaveData, r?: RunResult, live?: RunStats): AchievementId[] {
  const have = new Set(save.ach);
  const got: AchievementId[] = [];
  const s = r?.stats ?? live;
  const lvl = levelForGlory(save.glory);
  const cond: Partial<Record<AchievementId, boolean>> = {
    first_build: (s?.built ?? 0) > 0 || save.totals.built > 0,
    first_night: (r?.nights ?? 0) >= 1 || save.maps.valley.best >= 1,
    win_valley: save.maps.valley.won,
    win_swamp: save.maps.swamp.won,
    win_coast: save.maps.coast.won,
    win_pass: save.maps.pass.won,
    win_frost: save.maps.frost.won,
    boss_slayer: (s?.bossKills ?? 0) > 0,
    clean5: (s?.bestClean ?? 0) >= 5,
    kills500: save.totals.kills + (live?.kills ?? 0) >= 500,
    kills5000: save.totals.kills + (live?.kills ?? 0) >= 5000,
    builder100: save.totals.built + (live?.built ?? 0) >= 100,
    full_upgrade: (s?.fullUpgrades ?? 0) > 0,
    rich50: (s?.maxCoins ?? 0) >= 50,
    hero50: (s?.heroKills ?? 0) >= 50,
    army20: (s?.maxArmy ?? 0) >= 20,
    income15: (s?.maxIncome ?? 0) >= 15,
    mutator_win: !!r && r.victory && !r.endless && r.mutators.length >= 1,
    mutator3_win: !!r && r.victory && !r.endless && r.mutators.length >= 3,
    endless15: save.endlessBest >= 15,
    endless25: save.endlessBest >= 25,
    level5: lvl >= 5,
    level10: lvl >= 10,
    all_weapons: WEAPON_IDS.every((w) => save.totals.weaponsWon.includes(w)),
    ability100: save.totals.abilities + (live?.abilityUses ?? 0) >= 100,
    flawless: !!r && r.victory && !r.endless && r.stats.castleMinHp > 0.5,
  };
  for (const id of ACHIEVEMENTS) {
    if (!have.has(id) && cond[id]) {
      save.ach.push(id);
      got.push(id);
    }
  }
  return got;
}

export function mapNights(id: MapId): number { return MAPS[id].nights; }
