import { CHARACTERS } from '../data/characters';
import type { CharacterId, PassiveId, SectorId, WeaponId } from '../data/types';
import type { SaveData } from './save';

/**
 * Content is revealed gradually: a few weapons, modules and characters at the start, the rest
 * as the player beats the first mini-boss and clears sectors. Everything is open by the time
 * the fourth sector («Корзина») becomes available.
 */
export interface UnlockStage {
  /** 'start' | 'mb' (first mini-boss destroyed) | a sector that has to be cleared */
  req: 'start' | 'mb' | SectorId;
  weapons: WeaponId[];
  passives: PassiveId[];
  chars: CharacterId[];
}

export const UNLOCK_STAGES: UnlockStage[] = [
  { req: 'start', weapons: ['pulse', 'orbit', 'laser'], passives: ['might', 'haste', 'speed', 'magnet', 'maxhp', 'area'], chars: ['spark', 'sentinel'] },
  { req: 'mb', weapons: ['chain', 'shockwave'], passives: ['armor', 'regen', 'duration'], chars: [] },
  { req: 'ram', weapons: ['mines'], passives: ['crit', 'growth'], chars: ['volt'] },
  { req: 'cpu', weapons: ['missiles'], passives: ['luck'], chars: ['sapper'] },
  { req: 'gpu', weapons: ['drones'], passives: ['amount'], chars: ['hunter'] },
];

function reached(save: SaveData, s: UnlockStage): boolean {
  if (s.req === 'start') return true;
  if (s.req === 'mb') return save.stats.miniBosses > 0 || save.sectorsCleared.length > 0;
  return save.sectorsCleared.includes(s.req);
}

/** Number of stages reached (1..UNLOCK_STAGES.length). */
export function unlockStage(save: SaveData): number {
  let n = 0;
  for (const s of UNLOCK_STAGES) if (reached(save, s)) n++;
  return n;
}

function stageOf<K extends 'weapons' | 'passives' | 'chars'>(key: K, id: UnlockStage[K][number]): UnlockStage {
  return UNLOCK_STAGES.find((s) => (s[key] as string[]).includes(id)) ?? UNLOCK_STAGES[0];
}

export function weaponStage(id: WeaponId): UnlockStage {
  return stageOf('weapons', id);
}
export function passiveStage(id: PassiveId): UnlockStage {
  return stageOf('passives', id);
}
export function charStage(id: CharacterId): UnlockStage {
  return stageOf('chars', id);
}

export function weaponAvailable(save: SaveData, id: WeaponId): boolean {
  return reached(save, weaponStage(id));
}
export function passiveAvailable(save: SaveData, id: PassiveId): boolean {
  return reached(save, passiveStage(id));
}
/** Whether a character can be bought / granted (owned characters always stay owned). */
export function charAvailable(save: SaveData, id: CharacterId): boolean {
  return reached(save, charStage(id));
}

/** Weapons offered in a run: everything unlocked plus the chosen character's starting weapon. */
export function weaponPoolFor(save: SaveData): WeaponId[] {
  const out: WeaponId[] = [];
  for (const s of UNLOCK_STAGES) if (reached(save, s)) out.push(...s.weapons);
  const own = CHARACTERS[save.char]?.weapon;
  if (own && !out.includes(own)) out.push(own);
  return out;
}

export function passivePoolFor(save: SaveData): PassiveId[] {
  const out: PassiveId[] = [];
  for (const s of UNLOCK_STAGES) if (reached(save, s)) out.push(...s.passives);
  return out;
}

export interface UnlockNews {
  weapons: WeaponId[];
  passives: PassiveId[];
  chars: CharacterId[];
}

/** Content opened by moving from stage count `before` to `after`. */
export function unlocksBetween(before: number, after: number): UnlockNews {
  const news: UnlockNews = { weapons: [], passives: [], chars: [] };
  for (const s of UNLOCK_STAGES.slice(before, after)) {
    news.weapons.push(...s.weapons);
    news.passives.push(...s.passives);
    news.chars.push(...s.chars);
  }
  return news;
}
