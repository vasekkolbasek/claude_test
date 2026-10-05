import { BALANCE, rarityWeights } from '../data/balance';
import { PASSIVES } from '../data/passives';
import { EVOLUTIONS, WEAPONS, WEAPON_IDS } from '../data/weapons';
import type { EvolutionId, PassiveId, Rarity, UpgradeCard, WeaponId } from '../data/types';
import type { Rng } from '../core/math';
import type { PassiveInst } from './stats';

export interface WeaponSlot {
  id: WeaponId;
  level: number;
  evo: boolean;
  bonus: number;
}

export interface LoadoutView {
  weapons: readonly WeaponSlot[];
  passives: readonly PassiveInst[];
  luck: number;
  /** weapons the player may be offered (unlocked in meta) */
  weaponPool: readonly WeaponId[];
  passivePool: readonly PassiveId[];
}

interface Candidate {
  card: Omit<UpgradeCard, 'rarity' | 'value'>;
  weight: number;
}

const MAX_LEVEL = 5;

export function availableEvolutions(l: LoadoutView): EvolutionId[] {
  const out: EvolutionId[] = [];
  for (const w of l.weapons) {
    if (w.evo || w.level < MAX_LEVEL) continue;
    const evoId = WEAPONS[w.id].evolution;
    const need = EVOLUTIONS[evoId].passive;
    // both halves of the recipe must be maxed: the weapon at level 5 and its module at level 5
    if (l.passives.some((p) => p.id === need && p.level >= PASSIVES[need].maxLevel)) out.push(evoId);
  }
  return out;
}

function candidates(l: LoadoutView): Candidate[] {
  const list: Candidate[] = [];
  const evos = availableEvolutions(l);
  for (const id of evos) {
    list.push({ card: { kind: 'evolution', id, levelFrom: MAX_LEVEL, levelTo: MAX_LEVEL }, weight: 40 });
  }
  for (const w of l.weapons) {
    if (!w.evo && w.level < MAX_LEVEL) {
      // a weapon whose module is already owned is on its way to an evolution: favour it
      const paired = l.passives.some((p) => p.id === EVOLUTIONS[WEAPONS[w.id].evolution].passive);
      list.push({ card: { kind: 'weapon_up', id: w.id, levelFrom: w.level, levelTo: w.level + 1 }, weight: paired ? 15 : 12 });
    }
  }
  if (l.weapons.length < BALANCE.slots.weapons) {
    for (const id of l.weaponPool) {
      if (!WEAPON_IDS.includes(id) || l.weapons.some((w) => w.id === id)) continue;
      list.push({ card: { kind: 'weapon_new', id, levelFrom: 0, levelTo: 1 }, weight: l.weapons.length < 3 ? 9 : 5 });
    }
  }
  for (const p of l.passives) {
    if (p.level < PASSIVES[p.id].maxLevel) {
      // evolutions need the module maxed too: its upgrades show up much more often while an
      // owned weapon is waiting for it
      const recipe = l.weapons.some((w) => !w.evo && EVOLUTIONS[WEAPONS[w.id].evolution].passive === p.id);
      list.push({ card: { kind: 'passive_up', id: p.id, levelFrom: p.level, levelTo: p.level + 1 }, weight: recipe ? 13 : 9 });
    }
  }
  if (l.passives.length < BALANCE.slots.passives) {
    for (const id of l.passivePool) {
      if (l.passives.some((p) => p.id === id)) continue;
      // nudge towards passives that complete an evolution recipe the player already owns
      const helps = l.weapons.some((w) => !w.evo && EVOLUTIONS[WEAPONS[w.id].evolution].passive === id);
      list.push({ card: { kind: 'passive_new', id, levelFrom: 0, levelTo: 1 }, weight: helps ? 9 : 6 });
    }
  }
  return list;
}

function rollRarity(rng: Rng, luck: number): Rarity {
  const i = rng.weighted(rarityWeights(luck));
  return (i < 0 ? 0 : i) as Rarity;
}

function finalize(base: Omit<UpgradeCard, 'rarity' | 'value'>, rng: Rng, luck: number): UpgradeCard {
  if (base.kind === 'evolution') return { ...base, rarity: 3, value: 0 };
  let rarity = rollRarity(rng, luck);
  if (base.kind === 'passive_new' || base.kind === 'passive_up') {
    const def = PASSIVES[base.id as PassiveId];
    if (def.integer) return { ...base, rarity: 2, value: def.per };
    if (rarity === 3) rarity = 2; // legendary is reserved for evolutions and lucky weapon jumps
    return { ...base, rarity, value: def.per * BALANCE.passiveRarityMult[rarity] };
  }
  // weapons: epic/legendary may jump two levels
  let levelTo = base.levelTo;
  if (rarity >= 2 && base.kind === 'weapon_up' && base.levelTo < MAX_LEVEL) levelTo = base.levelTo + 1;
  return { ...base, levelTo, rarity, value: BALANCE.weaponRarityDmgBonus[rarity] };
}

/** Rolls `n` distinct upgrade cards. Falls back to heal / bits cards when nothing is left. */
export function rollCards(l: LoadoutView, rng: Rng, n: number): UpgradeCard[] {
  const pool = candidates(l);
  const out: UpgradeCard[] = [];
  // guarantee an available evolution shows up
  const evoIdx = pool.findIndex((c) => c.card.kind === 'evolution');
  if (evoIdx >= 0) {
    out.push(finalize(pool[evoIdx].card, rng, l.luck));
    pool.splice(evoIdx, 1);
  }
  while (out.length < n && pool.length > 0) {
    const i = rng.weighted(pool.map((c) => c.weight));
    if (i < 0) break;
    out.push(finalize(pool[i].card, rng, l.luck));
    pool.splice(i, 1);
  }
  const fillers: UpgradeCard[] = [
    { kind: 'heal', id: 'heal', rarity: 0, levelFrom: 0, levelTo: 0, value: 0.4 },
    { kind: 'bits', id: 'bits', rarity: 1, levelFrom: 0, levelTo: 0, value: 25 },
  ];
  for (const f of fillers) if (out.length < n) out.push(f);
  return out;
}
