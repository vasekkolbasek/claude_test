/** Shared data-definition types. All balance numbers live in src/data/*. */

export type Rarity = 0 | 1 | 2 | 3; // common, rare, epic, legendary

export type GameModeId = 'normal' | 'endless';

export type WeaponId = 'pulse' | 'orbit' | 'chain' | 'laser' | 'mines' | 'missiles' | 'shockwave' | 'drones';

export type PassiveId =
  | 'might'
  | 'haste'
  | 'speed'
  | 'magnet'
  | 'armor'
  | 'regen'
  | 'crit'
  | 'area'
  | 'duration'
  | 'luck'
  | 'maxhp'
  | 'amount'
  | 'growth';

/** Aggregated player stats; base values come from balance + character + workshop + passives. */
export interface PlayerStats {
  maxHp: number;
  armor: number;
  regen: number;
  /** multiplier on base move speed */
  speed: number;
  /** multiplier on base pickup radius */
  magnet: number;
  /** damage multiplier */
  might: number;
  /** attack speed bonus; cooldowns are divided by (1 + haste) */
  haste: number;
  area: number;
  duration: number;
  /** extra projectiles / blades / drones */
  amount: number;
  crit: number;
  critMult: number;
  luck: number;
  /** XP gain multiplier */
  growth: number;
  /** Bits gain multiplier */
  greed: number;
  revives: number;
  rerolls: number;
  /** number of upgrade cards offered */
  choices: number;
}

export type StatKey = keyof PlayerStats;

export interface WeaponStats {
  /** damage per hit (or per tick for beams) */
  dmg: number;
  /** cooldown in seconds */
  cd: number;
  /** projectiles / blades / drones / strikes */
  count: number;
  pierce: number;
  /** projectile speed (u/s) or rotation speed (rad/s) */
  speed: number;
  /** radius / width / explosion radius in world units */
  size: number;
  /** active duration in seconds */
  dur: number;
  knock: number;
  /** weapon specific: chain jumps, beam length, orbit radius … */
  extra: number;
}

export interface WeaponDef {
  id: WeaponId;
  color: number;
  levels: WeaponStats[];
  evolution: EvolutionId;
}

export type EvolutionId =
  | 'pulse_evo'
  | 'orbit_evo'
  | 'chain_evo'
  | 'laser_evo'
  | 'mines_evo'
  | 'missiles_evo'
  | 'shockwave_evo'
  | 'drones_evo';

export interface EvolutionDef {
  id: EvolutionId;
  from: WeaponId;
  passive: PassiveId;
  color: number;
  stats: WeaponStats;
}

export interface PassiveDef {
  id: PassiveId;
  stat: StatKey;
  /** value added per level at common rarity */
  per: number;
  maxLevel: number;
  /** integer stats ignore rarity magnitude (e.g. +1 projectile) */
  integer?: boolean;
  color: number;
}

export type EnemyId =
  | 'byte'
  | 'worm'
  | 'trojan'
  | 'dasher'
  | 'spammer'
  | 'splitter'
  | 'shard'
  | 'shielded'
  | 'glitch'
  | 'medic'
  | 'nano'
  | 'bomber'
  | 'spawner'
  | 'rootkit'
  | 'weaver'
  | 'sniper'
  | 'phantom'
  | 'ransom'
  | 'mb_trojan'
  | 'mb_crypto'
  | 'mb_hydra'
  | 'boss_core';

export type EnemyAi =
  | 'chase'
  | 'dash'
  | 'shoot'
  | 'teleport'
  | 'heal'
  | 'bomber'
  | 'spawner'
  | 'stalker'
  | 'weave'
  | 'sniper'
  | 'phantom'
  | 'mb_trojan'
  | 'mb_crypto'
  | 'mb_hydra'
  | 'boss_core';

export type ShapeId =
  | 'diamond'
  | 'triangle'
  | 'square'
  | 'arrow'
  | 'hexagon'
  | 'pentagon'
  | 'shardtri'
  | 'ringsquare'
  | 'glitch'
  | 'cross'
  | 'dot'
  | 'spikeball'
  | 'bighex'
  | 'stealth'
  | 'zigzag'
  | 'crosshair'
  | 'eye'
  | 'lock'
  | 'mb_trojan'
  | 'mb_crypto'
  | 'mb_hydra'
  | 'boss_core';

export interface EnemyDef {
  id: EnemyId;
  ai: EnemyAi;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  xp: number;
  color: number;
  shape: ShapeId;
  /** 0 = full knockback, 1 = immune */
  mass: number;
  /** AI specific parameters */
  p?: Readonly<Record<string, number>>;
  /** spawns these on death */
  splitInto?: { id: EnemyId; count: number };
  /** shield points as a fraction of max HP */
  shield?: number;
  boss?: 'mini' | 'final';
}

export interface WaveSegment {
  /** start time in seconds */
  at: number;
  /** minimum alive enemies the director maintains */
  min: number;
  /** extra spawns per second on top of the minimum */
  rate: number;
  roster: ReadonlyArray<readonly [EnemyId, number]>;
  /** chance that a spawned regular enemy is elite */
  elite: number;
}

export type WaveEventType = 'ring' | 'rush' | 'miniboss' | 'boss' | 'swarm';

export interface WaveEvent {
  at: number;
  type: WaveEventType;
  enemy: EnemyId;
  count: number;
}

export type SectorId = 'ram' | 'cpu' | 'gpu' | 'bin';

export interface SectorDef {
  id: SectorId;
  /** background, grid, accent */
  bg: number;
  grid: number;
  accent: number;
  hpMult: number;
  speedMult: number;
  spawnMult: number;
  xpMult: number;
  bitsMult: number;
  dmgMult: number;
  /** enemy id replacements for this sector's flavour */
  swap?: Partial<Record<EnemyId, EnemyId>>;
  /** roster weight multipliers */
  weights?: Partial<Record<EnemyId, number>>;
}

export type CharacterId = 'spark' | 'sentinel' | 'volt' | 'sapper' | 'hunter';

export type UnlockRule =
  | { type: 'free' }
  | { type: 'bits'; cost: number }
  /** unlocked by watching `count` rewarded videos (progress is saved) */
  | { type: 'ads'; count: number };

export interface CharacterDef {
  id: CharacterId;
  weapon: WeaponId;
  color: number;
  bonus: Partial<Record<StatKey, number>>;
  unlock: UnlockRule;
}

export type CardKind = 'weapon_new' | 'weapon_up' | 'passive_new' | 'passive_up' | 'evolution' | 'heal' | 'bits';

export interface UpgradeCard {
  kind: CardKind;
  id: string;
  rarity: Rarity;
  levelFrom: number;
  levelTo: number;
  /** passive value added, weapon damage bonus, heal fraction or bits amount */
  value: number;
}
