import { BALANCE } from '../data/balance';
import { SECTOR_IDS } from '../data/sectors';
import type { PassiveId, SectorId, WeaponId } from '../data/types';
import type { StatBonus } from '../game/stats';
import type { World } from '../game/World';
import { checkAchievements } from './achievements';
import { questProgress } from './daily';
import type { SaveData } from './save';
import { passivePoolFor, unlockStage, unlocksBetween, weaponPoolFor, type UnlockNews } from './unlocks';
import { workshopBonuses } from './workshop';

export interface RunSummary {
  won: boolean;
  mode: 'normal' | 'endless';
  sector: SectorId;
  time: number;
  kills: number;
  level: number;
  bits: number;
  damageBy: Partial<Record<WeaponId, number>>;
  evolved: Set<string>;
  newRecord: boolean;
  sectorUnlocked: SectorId | null;
  endlessUnlocked: boolean;
  achievements: string[];
  /** content opened by this run (progressive unlocks) */
  unlocks: UnlockNews;
  questReward: number;
  /** extra bits granted by the x2 ad */
  doubled: boolean;
}

export function runBonuses(save: SaveData): StatBonus[] {
  return [workshopBonuses(save)];
}

export function weaponPool(save: SaveData): WeaponId[] {
  return weaponPoolFor(save);
}

export function passivePool(save: SaveData): PassiveId[] {
  return passivePoolFor(save);
}

export function sectorUnlocked(save: SaveData, id: SectorId): boolean {
  const i = SECTOR_IDS.indexOf(id);
  return i === 0 || save.sectorsCleared.includes(SECTOR_IDS[i - 1]);
}

/** Applies a finished run to the save. Pure with respect to the world (reads only). */
export function applyRunResult(save: SaveData, w: World, won: boolean): RunSummary {
  const st = save.stats;
  const stageBefore = unlockStage(save);
  const mode = w.mode;
  const sector = w.cfg.sector;
  const bits = w.computeBits(won);
  save.bits += bits;
  st.bitsEarned += bits;
  st.runs++;
  if (won) st.wins++;
  st.kills += w.run.kills;
  st.bossKills += w.run.bossKills;
  st.miniBosses += w.run.miniBosses;
  st.elites += w.run.elites;
  st.evolutions += w.run.evolutions.length;
  st.gems += w.run.gems;
  st.maxLevel = Math.max(st.maxLevel, w.player.level);
  st.playTime += w.t;
  st.longestRun = Math.max(st.longestRun, w.t);
  st.revives += w.run.revives;
  st.chests += w.run.chests;
  st.maxKillsRun = Math.max(st.maxKillsRun, w.run.kills);
  st.maxNoHit = Math.max(st.maxNoHit, w.run.maxNoHit);

  let newRecord = false;
  if (mode === 'endless') {
    if (w.t > save.bestEndless) {
      newRecord = save.bestEndless > 0;
      save.bestEndless = w.t;
    }
  } else {
    const prev = save.bestTime[sector] ?? 0;
    if (w.t > prev) {
      newRecord = prev > 0;
      save.bestTime[sector] = w.t;
    }
  }

  let sectorUnlockedNow: SectorId | null = null;
  let endlessUnlocked = false;
  if (won && mode === 'normal' && !save.sectorsCleared.includes(sector)) {
    save.sectorsCleared.push(sector);
    const next = SECTOR_IDS[SECTOR_IDS.indexOf(sector) + 1];
    if (next) sectorUnlockedNow = next;
    if (!save.endlessUnlocked) {
      save.endlessUnlocked = true;
      endlessUnlocked = true;
    }
  }

  // codex
  for (const [id, n] of Object.entries(w.run.killsBy)) save.codex.e[id] = (save.codex.e[id] ?? 0) + (n ?? 0);
  for (const id of w.seen) if (save.codex.e[id] === undefined) save.codex.e[id] = 0;
  for (const id of w.weaponsSeen) if (!save.codex.w.includes(id)) save.codex.w.push(id);
  for (const p of w.passives) if (!save.codex.p.includes(p.id)) save.codex.p.push(p.id);

  const questReward = questProgress(save, w);
  if (questReward > 0) {
    save.bits += questReward;
    st.dailyQuests++;
  }
  const achievements = checkAchievements(save, w, won);
  const unlocks = unlocksBetween(stageBefore, unlockStage(save));
  save.tutorialDone = true;

  return {
    won,
    mode,
    sector,
    time: w.t,
    kills: w.run.kills,
    level: w.player.level,
    bits,
    damageBy: { ...w.run.damageBy },
    evolved: new Set(w.weapons.filter((x) => x.evo).map((x) => x.id)),
    newRecord,
    sectorUnlocked: sectorUnlockedNow,
    endlessUnlocked,
    achievements,
    unlocks,
    questReward,
    doubled: false,
  };
}

export const FREE_CHEST_COOLDOWN = 10 * 60 * 1000;

export function chestReward(save: SaveData): number {
  // grows a little with progression so it stays relevant
  return Math.round(40 + Math.min(160, save.stats.runs * 4 + save.sectorsCleared.length * 25));
}

export { BALANCE };
