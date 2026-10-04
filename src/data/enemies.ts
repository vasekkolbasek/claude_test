import type { EnemyDef, EnemyId, SectorId } from './types';

const SECTOR_ORDER: SectorId[] = ['ram', 'cpu', 'gpu', 'bin'];

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  byte: { id: 'byte', ai: 'chase', hp: 7, speed: 66, dmg: 6, r: 11, xp: 1, color: 0xff3df2, shape: 'diamond', mass: 0 },
  worm: { id: 'worm', ai: 'chase', hp: 4, speed: 104, dmg: 5, r: 8, xp: 1, color: 0xb6ff3d, shape: 'triangle', mass: 0 },
  trojan: { id: 'trojan', ai: 'chase', hp: 42, speed: 44, dmg: 13, r: 19, xp: 4, color: 0xff8a1f, shape: 'square', mass: 0.6 },
  dasher: {
    id: 'dasher', ai: 'dash', hp: 16, speed: 58, dmg: 9, r: 12, xp: 2, color: 0xff2a55, shape: 'arrow', mass: 0.2,
    p: { range: 230, windup: 0.7, dashSpeed: 420, dashTime: 0.42, rest: 1.4 },
  },
  spammer: {
    id: 'spammer', ai: 'shoot', hp: 20, speed: 60, dmg: 8, r: 13, xp: 3, color: 0xa35bff, shape: 'hexagon', mass: 0.2,
    p: { keep: 230, fireCd: 3.2, bulletSpeed: 160, bulletDmg: 7 },
  },
  splitter: {
    id: 'splitter', ai: 'chase', hp: 26, speed: 56, dmg: 10, r: 15, xp: 2, color: 0x3dffb0, shape: 'pentagon', mass: 0.3,
    splitInto: { id: 'shard', count: 3 },
  },
  shard: { id: 'shard', ai: 'chase', hp: 6, speed: 92, dmg: 5, r: 8, xp: 1, color: 0x3dffb0, shape: 'shardtri', mass: 0 },
  shielded: {
    id: 'shielded', ai: 'chase', hp: 30, speed: 50, dmg: 11, r: 15, xp: 4, color: 0x3d7bff, shape: 'ringsquare', mass: 0.5,
    shield: 1.2, p: { regenDelay: 3, regenRate: 0.25 },
  },
  glitch: {
    id: 'glitch', ai: 'teleport', hp: 18, speed: 62, dmg: 10, r: 12, xp: 3, color: 0xd6ff6b, shape: 'glitch', mass: 0.1,
    p: { every: 3.6, jump: 150, telegraph: 0.45 },
  },
  medic: {
    id: 'medic', ai: 'heal', hp: 24, speed: 58, dmg: 6, r: 13, xp: 4, color: 0x3dff6e, shape: 'cross', mass: 0.2,
    p: { keep: 190, every: 2.6, radius: 150, amount: 0.18 },
  },
  nano: { id: 'nano', ai: 'chase', hp: 3, speed: 118, dmg: 4, r: 6, xp: 1, color: 0xff9de6, shape: 'dot', mass: 0 },
  bomber: {
    id: 'bomber', ai: 'bomber', hp: 14, speed: 82, dmg: 22, r: 13, xp: 2, color: 0xff5a1f, shape: 'spikeball', mass: 0.1,
    p: { trigger: 62, fuse: 0.75, radius: 82 },
  },
  spawner: {
    id: 'spawner', ai: 'spawner', hp: 80, speed: 30, dmg: 14, r: 24, xp: 8, color: 0xc13dff, shape: 'bighex', mass: 0.8,
    p: { every: 4.5, count: 3 },
  },
  rootkit: {
    id: 'rootkit', ai: 'stalker', hp: 22, speed: 96, dmg: 12, r: 12, xp: 3, color: 0x7dfff2, shape: 'stealth', mass: 0.1,
    p: { reveal: 150 },
  },
  // ---- late-sector viruses (see ENEMY_SECTOR)
  weaver: {
    id: 'weaver', ai: 'weave', hp: 14, speed: 86, dmg: 8, r: 11, xp: 2, color: 0x4dd2ff, shape: 'zigzag', mass: 0.1,
    p: { amp: 1.1, freq: 5.5 },
  },
  sniper: {
    id: 'sniper', ai: 'sniper', hp: 20, speed: 52, dmg: 6, r: 13, xp: 4, color: 0xff4fa8, shape: 'crosshair', mass: 0.2,
    p: { keep: 360, fireCd: 3.4, aim: 0.9, bulletSpeed: 430, bulletDmg: 13 },
  },
  phantom: {
    id: 'phantom', ai: 'phantom', hp: 26, speed: 58, dmg: 10, r: 13, xp: 5, color: 0x9d7dff, shape: 'eye', mass: 0.2,
    p: { every: 3.4, jump: 170, telegraph: 0.5, shots: 5, bulletSpeed: 165, bulletDmg: 8 },
  },
  ransom: {
    id: 'ransom', ai: 'chase', hp: 110, speed: 38, dmg: 16, r: 22, xp: 9, color: 0xffc02e, shape: 'lock', mass: 0.75,
    shield: 0.6, p: { regenDelay: 3.5, regenRate: 0.2 }, splitInto: { id: 'worm', count: 4 },
  },
  mb_trojan: {
    id: 'mb_trojan', ai: 'mb_trojan', hp: 900, speed: 50, dmg: 16, r: 40, xp: 60, color: 0xff8a1f, shape: 'mb_trojan', mass: 0.95,
    boss: 'mini', p: { chargeEvery: 4.6, chargeSpeed: 380, chargeTime: 0.7, summonEvery: 6.5, summon: 4 },
  },
  mb_crypto: {
    id: 'mb_crypto', ai: 'mb_crypto', hp: 1700, speed: 46, dmg: 20, r: 42, xp: 90, color: 0xa35bff, shape: 'mb_crypto', mass: 0.95,
    boss: 'mini', p: { regenRate: 0, keep: 160, ringEvery: 2.4, ringCount: 14, bulletSpeed: 150, bulletDmg: 12 },
  },
  mb_hydra: {
    id: 'mb_hydra', ai: 'mb_hydra', hp: 2600, speed: 58, dmg: 24, r: 44, xp: 120, color: 0x3dffb0, shape: 'mb_hydra', mass: 0.95,
    boss: 'mini', p: { shotEvery: 1.9, bulletSpeed: 210, bulletDmg: 13 },
  },
  boss_core: {
    id: 'boss_core', ai: 'boss_core', hp: 8500, speed: 40, dmg: 30, r: 64, xp: 0, color: 0xff2a55, shape: 'boss_core', mass: 1,
    boss: 'final', p: { bulletSpeed: 165, bulletDmg: 18 },
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

/**
 * First sector where a virus appears. Anything not listed is there from the start; the swarm
 * grows more varied sector by sector and the last new viruses show up in «Корзина».
 */
export const ENEMY_SECTOR: Partial<Record<EnemyId, SectorId>> = {
  spammer: 'cpu',
  shielded: 'cpu',
  glitch: 'cpu',
  weaver: 'cpu',
  medic: 'gpu',
  spawner: 'gpu',
  rootkit: 'gpu',
  sniper: 'gpu',
  phantom: 'bin',
  ransom: 'bin',
};

/**
 * Stand-ins of similar weight for a virus the sector does not have yet (wave mixes and scripted
 * events), so an early sector is less varied but not weaker.
 */
export const ENEMY_FALLBACK: Partial<Record<EnemyId, EnemyId>> = {
  spammer: 'splitter',
  shielded: 'trojan',
  glitch: 'dasher',
  weaver: 'worm',
  medic: 'trojan',
  spawner: 'splitter',
  rootkit: 'trojan',
  sniper: 'spammer',
  phantom: 'glitch',
  ransom: 'shielded',
};

export function enemyInSector(id: EnemyId, sector: SectorId): boolean {
  const from = ENEMY_SECTOR[id];
  return !from || SECTOR_ORDER.indexOf(from) <= SECTOR_ORDER.indexOf(sector);
}

/** The virus to actually spawn for `id` in `sector` (walks the fallback chain). */
export function enemyFor(id: EnemyId, sector: SectorId): EnemyId {
  let cur = id;
  for (let i = 0; i < 6 && !enemyInSector(cur, sector); i++) cur = ENEMY_FALLBACK[cur] ?? 'byte';
  return enemyInSector(cur, sector) ? cur : 'byte';
}
/** Enemies shown in the Codex (excludes internal split children). */
export const CODEX_ENEMIES: EnemyId[] = ENEMY_IDS.filter((id) => id !== 'shard');
