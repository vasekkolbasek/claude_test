import { BASE_STATS } from '../data/balance';
import { PASSIVES } from '../data/passives';
import type { PassiveId, PlayerStats, StatKey } from '../data/types';

export type StatBonus = Partial<Record<StatKey, number>>;

export interface PassiveInst {
  id: PassiveId;
  level: number;
  /** accumulated stat value (rarity-scaled) */
  value: number;
}

/** Combines base stats with additive bonuses (character, workshop) and passives. */
export function computeStats(bonuses: readonly StatBonus[], passives: readonly PassiveInst[]): PlayerStats {
  const out: PlayerStats = { ...BASE_STATS };
  for (const b of bonuses) {
    for (const k in b) {
      const key = k as StatKey;
      out[key] += b[key] ?? 0;
    }
  }
  for (const p of passives) {
    const def = PASSIVES[p.id];
    out[def.stat] += p.value;
  }
  out.crit = Math.min(out.crit, 0.95);
  return out;
}
