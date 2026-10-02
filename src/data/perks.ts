export type PerkId =
  | 'tithe' | 'masons' | 'swift' | 'stout' | 'purse' | 'drill' | 'ramparts' | 'focus' | 'guard' | 'harvest';

export interface PerkDef { id: PerkId; unlockLevel: number }

export const PERKS: PerkDef[] = [
  { id: 'tithe', unlockLevel: 1 },     // +1 coin every dawn
  { id: 'swift', unlockLevel: 1 },     // hero +15% speed
  { id: 'purse', unlockLevel: 2 },     // +4 starting coins
  { id: 'masons', unlockLevel: 2 },    // towers & magic towers 20% cheaper
  { id: 'stout', unlockLevel: 3 },     // hero +40% hp
  { id: 'ramparts', unlockLevel: 4 },  // walls +60% hp
  { id: 'drill', unlockLevel: 4 },     // +1 soldier per troop building
  { id: 'focus', unlockLevel: 6 },     // ability cooldown -30%
  { id: 'guard', unlockLevel: 7 },     // castle +50% hp, shoots faster
  { id: 'harvest', unlockLevel: 8 },   // economic buildings +1 income from night 4
];
export const PERK_IDS = PERKS.map((p) => p.id);

/** Number of perk slots for a ruler level. */
export function perkSlots(level: number): number { return level >= 6 ? 3 : 2; }

export type MutatorId = 'swift' | 'poverty' | 'nowalls' | 'tough' | 'fragile';
export interface MutatorDef { id: MutatorId; mult: number }
export const MUTATORS: MutatorDef[] = [
  { id: 'swift', mult: 1.25 },
  { id: 'poverty', mult: 1.3 },
  { id: 'nowalls', mult: 1.25 },
  { id: 'tough', mult: 1.4 },
  { id: 'fragile', mult: 1.2 },
];
export const MUTATOR_UNLOCK_LEVEL = 3;

export function mutatorMultiplier(ids: readonly MutatorId[]): number {
  let m = 1;
  for (const id of ids) m *= MUTATORS.find((d) => d.id === id)?.mult ?? 1;
  return Math.round(m * 100) / 100;
}

/** Cumulative glory needed to reach a ruler level. */
export function gloryForLevel(level: number): number { return 25 * (level - 1) * (level + 2); }
export function levelForGlory(glory: number): number {
  let l = 1;
  while (gloryForLevel(l + 1) <= glory && l < 99) l++;
  return l;
}
