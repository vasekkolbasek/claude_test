import type { PlayerStats, Rarity } from './types';

/** Global balance knobs. Tuned with scripts/simulate.ts. */
export const BALANCE = {
  player: {
    radius: 14,
    baseSpeed: 150,
    baseMagnet: 72,
    invulnAfterHit: 0.45,
    reviveInvuln: 3,
  },
  slots: { weapons: 6, passives: 6 },
  /** normal-mode final boss time (seconds) */
  bossTime: 600,
  miniBossTimes: [180, 360, 540],
  maxEnemies: 650,
  maxGems: 380,
  /** while a boss is alive the director spawns this fraction of the usual */
  bossSpawnFactor: 0.45,
  /** per minute enemy HP growth: hpMult = 1 + a*m + b*m^2 */
  hpGrowth: { a: 0.18, b: 0.045 },
  /** enemy HP also scales with the player's level (rubber band against snowballing) */
  hpPerLevel: 0.025,
  /** rate-based spawns stop above this multiple of the wave minimum */
  overflowCap: 1.6,
  /** endless mode: extra growth after bossTime */
  endlessHpGrowth: 0.22,
  dmgGrowth: 0.1,
  /** enemy speed grows by this fraction per minute */
  speedGrowth: 0.025,
  /** normal mode: seconds after the final boss appears before overtime pressure kicks in */
  overtimeAfter: 100,
  eliteHpMult: 5,
  eliteXpMult: 6,
  eliteScale: 1.45,
  /** chance that a regular kill drops an XP crystal */
  gemDropChance: 0.92,
  healDropChance: 0.004,
  magnetDropChance: 0.0015,
  /** heal packet restores this fraction of max HP */
  healAmount: 0.25,
  rarityWeights: [62, 27, 9, 2] as const,
  /** luck shifts weight from common to rarer tiers */
  rarityLuckShift: [-30, 12, 12, 6] as const,
  passiveRarityMult: [1, 1.5, 2, 2.75] as const,
  weaponRarityDmgBonus: [0, 0.12, 0.2, 0.35] as const,
  bits: {
    perMinute: 12,
    perKill: 0.01,
    perLevel: 1,
    perMiniBoss: 20,
    win: 120,
  },
};

export const BASE_STATS: PlayerStats = {
  maxHp: 100,
  armor: 0,
  regen: 0,
  speed: 1,
  magnet: 1,
  might: 1,
  haste: 0,
  area: 1,
  duration: 1,
  amount: 0,
  crit: 0.05,
  critMult: 2,
  luck: 1,
  growth: 1,
  greed: 1,
  revives: 0,
  rerolls: 0,
  choices: 3,
};

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const l = level - 1;
  return Math.round(5 + 8 * l + 0.55 * l * l);
}

export function rarityWeights(luck: number): number[] {
  const k = Math.max(0, luck - 1);
  return BALANCE.rarityWeights.map((w, i) => Math.max(0.5, w + BALANCE.rarityLuckShift[i] * k));
}

export const RARITY_NAMES = ['common', 'rare', 'epic', 'legendary'] as const;
export type RarityName = (typeof RARITY_NAMES)[number];
export const RARITY_COLORS: Record<Rarity, number> = { 0: 0x9fb4d8, 1: 0x29a8ff, 2: 0xc04dff, 3: 0xffb52e };
