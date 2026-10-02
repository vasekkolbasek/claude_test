import type { MutatorId, PerkId } from '../data/perks';

/** Run-wide multipliers from perks and mutators, plus dynamic forge auras. */
export interface Mods {
  enemySpeed: number;
  enemyHp: number;
  incomeMul: number;
  castleHp: number;
  noWalls: boolean;
  heroSpeed: number;
  heroHp: number;
  abilityCd: number;
  towerCost: number;
  wallHp: number;
  extraTroops: number;
  tithe: number;
  startCoins: number;
  castleCd: number;
  harvest: boolean;
  // Forge auras (recomputed whenever buildings change).
  dmgTroops: number;
  dmgTowers: number;
  dmgHero: number;
  hpTroops: number;
}

export function computeMods(perks: readonly PerkId[], mutators: readonly MutatorId[]): Mods {
  const p = new Set(perks);
  const m = new Set(mutators);
  return {
    enemySpeed: m.has('swift') ? 1.25 : 1,
    enemyHp: m.has('tough') ? 1.4 : 1,
    incomeMul: m.has('poverty') ? 0.7 : 1,
    castleHp: (m.has('fragile') ? 0.6 : 1) * (p.has('guard') ? 1.5 : 1),
    noWalls: m.has('nowalls'),
    heroSpeed: p.has('swift') ? 1.15 : 1,
    heroHp: p.has('stout') ? 1.4 : 1,
    abilityCd: p.has('focus') ? 0.7 : 1,
    towerCost: p.has('masons') ? 0.8 : 1,
    wallHp: p.has('ramparts') ? 1.6 : 1,
    extraTroops: p.has('drill') ? 1 : 0,
    tithe: p.has('tithe') ? 1 : 0,
    startCoins: p.has('purse') ? 4 : 0,
    castleCd: p.has('guard') ? 0.7 : 1,
    harvest: p.has('harvest'),
    dmgTroops: 0,
    dmgTowers: 0,
    dmgHero: 0,
    hpTroops: 0,
  };
}
