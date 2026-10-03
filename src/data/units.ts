import type { ProjKind } from './buildings';

export type EnemyId =
  | 'grunt' | 'runner' | 'shieldbearer' | 'skirmisher' | 'ram' | 'wisp' | 'raider' | 'giant'
  | 'boss_warlord' | 'boss_hag' | 'boss_tide' | 'boss_colossus' | 'boss_frost';
export type AllyId = 'militia' | 'spearman' | 'swordsman' | 'bowman' | 'crossbowman';
export type UnitId = EnemyId | AllyId;

export interface UnitDef {
  id: UnitId;
  team: 0 | 1; // 0 = kingdom, 1 = mist
  hp: number;
  speed: number;
  damage: number;
  cooldown: number;
  range: number;
  radius: number;
  scale: number;
  ranged?: ProjKind;
  flying?: boolean;
  /** Who the unit hunts: anything, only buildings, or economic buildings first. */
  targets: 'any' | 'buildings' | 'economy';
  /** Fraction of ranged damage blocked. */
  armor?: number;
  /** Damage multiplier vs big units (giants, rams, bosses). */
  bonusVsBig?: number;
  big?: boolean;
  splash?: number;
  /** Damage multiplier vs buildings. */
  bldMul?: number;
  /** Wave budget cost. */
  threat: number;
  boss?: boolean;
  summon?: { unit: EnemyId; count: number; every: number };
  aggro?: number;
}

const E = (d: Omit<UnitDef, 'team'>): UnitDef => ({ team: 1, ...d });
const A = (d: Omit<UnitDef, 'team' | 'threat' | 'targets'>): UnitDef => ({ team: 0, threat: 0, targets: 'any', ...d });

export const UNITS: Record<UnitId, UnitDef> = {
  grunt: E({ id: 'grunt', hp: 34, speed: 2.6, damage: 5, cooldown: 1, range: 1.1, radius: 0.45, scale: 1, targets: 'any', threat: 1 }),
  runner: E({ id: 'runner', hp: 20, speed: 4.8, damage: 3, cooldown: 0.7, range: 1, radius: 0.4, scale: 0.85, targets: 'any', threat: 1 }),
  shieldbearer: E({ id: 'shieldbearer', hp: 80, speed: 2.1, damage: 6, cooldown: 1.1, range: 1.1, radius: 0.55, scale: 1.1, targets: 'any', armor: 0.6, threat: 3 }),
  skirmisher: E({ id: 'skirmisher', hp: 24, speed: 2.5, damage: 6, cooldown: 1.6, range: 7, radius: 0.4, scale: 0.95, ranged: 'dart', targets: 'any', threat: 2 }),
  ram: E({ id: 'ram', hp: 170, speed: 1.7, damage: 34, cooldown: 2, range: 1.4, radius: 0.9, scale: 1, targets: 'buildings', big: true, bldMul: 1, threat: 5 }),
  wisp: E({ id: 'wisp', hp: 26, speed: 3.6, damage: 4, cooldown: 0.9, range: 1.2, radius: 0.45, scale: 0.9, flying: true, targets: 'any', threat: 2 }),
  raider: E({ id: 'raider', hp: 44, speed: 3.9, damage: 8, cooldown: 0.9, range: 1.1, radius: 0.5, scale: 1, targets: 'economy', bldMul: 2, threat: 3 }),
  giant: E({ id: 'giant', hp: 400, speed: 1.45, damage: 30, cooldown: 2.2, range: 1.8, radius: 1.1, scale: 1.9, targets: 'any', big: true, splash: 1.8, bldMul: 1.3, threat: 12 }),
  boss_warlord: E({ id: 'boss_warlord', hp: 650, speed: 1.5, damage: 24, cooldown: 2, range: 2, radius: 1.2, scale: 2, targets: 'any', big: true, splash: 1.6, bldMul: 1.3, threat: 14, boss: true, summon: { unit: 'grunt', count: 2, every: 14 } }),
  boss_hag: E({ id: 'boss_hag', hp: 1700, speed: 1.6, damage: 24, cooldown: 1.7, range: 7.5, radius: 1.3, scale: 2.2, ranged: 'hex', targets: 'any', big: true, splash: 2.2, bldMul: 1.3, threat: 35, boss: true, summon: { unit: 'wisp', count: 3, every: 9 } }),
  boss_tide: E({ id: 'boss_tide', hp: 2300, speed: 1.6, damage: 42, cooldown: 1.9, range: 2.4, radius: 1.4, scale: 2.4, targets: 'any', big: true, splash: 2.4, bldMul: 1.4, threat: 50, boss: true, summon: { unit: 'runner', count: 3, every: 9 } }),
  boss_colossus: E({ id: 'boss_colossus', hp: 2600, speed: 1.2, damage: 50, cooldown: 2.6, range: 2.6, radius: 1.8, scale: 3, targets: 'buildings', big: true, splash: 3.2, bldMul: 1.3, threat: 70, boss: true, summon: { unit: 'shieldbearer', count: 2, every: 9 } }),
  boss_frost: E({ id: 'boss_frost', hp: 4300, speed: 1.2, damage: 70, cooldown: 2.6, range: 2.6, radius: 1.8, scale: 3.1, targets: 'any', big: true, splash: 3.4, bldMul: 1.5, threat: 85, boss: true, summon: { unit: 'shieldbearer', count: 2, every: 10 } }),

  militia: A({ id: 'militia', hp: 55, speed: 3.4, damage: 6, cooldown: 1, range: 1.1, radius: 0.45, scale: 1, aggro: 6 }),
  spearman: A({ id: 'spearman', hp: 75, speed: 3.4, damage: 8, cooldown: 1, range: 1.8, radius: 0.45, scale: 1, bonusVsBig: 2.5, aggro: 6.5 }),
  swordsman: A({ id: 'swordsman', hp: 100, speed: 3.4, damage: 11, cooldown: 0.9, range: 1.2, radius: 0.5, scale: 1.05, aggro: 6.5 }),
  bowman: A({ id: 'bowman', hp: 40, speed: 3.2, damage: 7, cooldown: 1, range: 8.5, radius: 0.4, scale: 0.95, ranged: 'arrow', aggro: 9 }),
  crossbowman: A({ id: 'crossbowman', hp: 48, speed: 3, damage: 19, cooldown: 2, range: 10, radius: 0.45, scale: 1, ranged: 'bolt', aggro: 10.5 }),
};

export const ENEMY_IDS: EnemyId[] = ['grunt', 'runner', 'shieldbearer', 'skirmisher', 'ram', 'wisp', 'raider', 'giant', 'boss_warlord', 'boss_hag', 'boss_tide', 'boss_colossus', 'boss_frost'];
export const ALLY_IDS: AllyId[] = ['militia', 'spearman', 'swordsman', 'bowman', 'crossbowman'];
export const UNIT_IDS: UnitId[] = [...ENEMY_IDS, ...ALLY_IDS];
