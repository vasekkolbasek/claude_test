import type { EvolutionDef, EvolutionId, WeaponDef, WeaponId, WeaponStats } from './types';

function s(p: Partial<WeaponStats>): WeaponStats {
  return { dmg: 10, cd: 1, count: 1, pierce: 0, speed: 0, size: 10, dur: 0, knock: 0, extra: 0, ...p };
}

/**
 * Weapon behaviour summary (implemented in src/game/weapons.ts):
 * - pulse: bolts at the nearest enemy. speed=bolt speed, size=bolt radius
 * - orbit: blades circling the player. speed=rad/s, extra=orbit radius, cd=per-enemy hit interval
 * - chain: lightning strikes. extra=jumps, size=jump range
 * - laser: beams. dur=beam time, size=width, extra=length, cd between bursts, dmg per 0.1s tick
 * - mines: dropped mines. size=blast radius, dur=lifetime
 * - missiles: homing rockets. size=blast radius, speed=flight speed
 * - shockwave: expanding ring. size=max radius, knock=push
 * - drones: helper drones that shoot. speed=bolt speed, pierce for bolts
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pulse: {
    id: 'pulse',
    color: 0x29f6ff,
    evolution: 'pulse_evo',
    levels: [
      s({ dmg: 10, cd: 0.62, count: 1, pierce: 0, speed: 560, size: 6, knock: 40 }),
      s({ dmg: 13, cd: 0.58, count: 1, pierce: 1, speed: 580, size: 6, knock: 40 }),
      s({ dmg: 13, cd: 0.54, count: 2, pierce: 1, speed: 600, size: 6.5, knock: 45 }),
      s({ dmg: 17, cd: 0.5, count: 2, pierce: 2, speed: 620, size: 7, knock: 45 }),
      s({ dmg: 21, cd: 0.44, count: 3, pierce: 3, speed: 650, size: 7.5, knock: 50 }),
    ],
  },
  orbit: {
    id: 'orbit',
    color: 0xff3df2,
    evolution: 'orbit_evo',
    levels: [
      s({ dmg: 9, cd: 0.42, count: 2, speed: 3.2, size: 11, extra: 66, knock: 90 }),
      s({ dmg: 11, cd: 0.42, count: 3, speed: 3.3, size: 11, extra: 68, knock: 90 }),
      s({ dmg: 13, cd: 0.4, count: 3, speed: 3.6, size: 12, extra: 74, knock: 100 }),
      s({ dmg: 15, cd: 0.38, count: 4, speed: 3.8, size: 12.5, extra: 78, knock: 100 }),
      s({ dmg: 19, cd: 0.36, count: 5, speed: 4.2, size: 13, extra: 84, knock: 110 }),
    ],
  },
  chain: {
    id: 'chain',
    color: 0x8fd8ff,
    evolution: 'chain_evo',
    levels: [
      s({ dmg: 14, cd: 1.4, count: 1, extra: 3, size: 150 }),
      s({ dmg: 16, cd: 1.3, count: 1, extra: 4, size: 155 }),
      s({ dmg: 18, cd: 1.2, count: 2, extra: 4, size: 160 }),
      s({ dmg: 22, cd: 1.1, count: 2, extra: 5, size: 165 }),
      s({ dmg: 26, cd: 1.0, count: 2, extra: 7, size: 175 }),
    ],
  },
  laser: {
    id: 'laser',
    color: 0xff4d6d,
    evolution: 'laser_evo',
    levels: [
      s({ dmg: 6, cd: 3.0, count: 1, dur: 0.8, size: 10, extra: 430 }),
      s({ dmg: 7, cd: 2.9, count: 1, dur: 1.0, size: 11, extra: 440 }),
      s({ dmg: 8, cd: 2.6, count: 1, dur: 1.05, size: 14, extra: 460 }),
      s({ dmg: 10, cd: 2.5, count: 2, dur: 1.3, size: 15, extra: 470 }),
      s({ dmg: 12, cd: 2.2, count: 2, dur: 1.6, size: 18, extra: 500 }),
    ],
  },
  mines: {
    id: 'mines',
    color: 0xffd23d,
    evolution: 'mines_evo',
    levels: [
      s({ dmg: 30, cd: 2.2, count: 1, size: 70, dur: 9, knock: 160 }),
      s({ dmg: 36, cd: 2.0, count: 1, size: 72, dur: 9, knock: 160 }),
      s({ dmg: 40, cd: 2.0, count: 2, size: 76, dur: 10, knock: 170 }),
      s({ dmg: 48, cd: 1.8, count: 2, size: 85, dur: 10, knock: 180 }),
      s({ dmg: 60, cd: 1.7, count: 3, size: 95, dur: 11, knock: 200 }),
    ],
  },
  missiles: {
    id: 'missiles',
    color: 0xff9a3d,
    evolution: 'missiles_evo',
    levels: [
      s({ dmg: 18, cd: 1.6, count: 1, speed: 300, size: 40, knock: 80 }),
      s({ dmg: 22, cd: 1.6, count: 2, speed: 310, size: 42, knock: 80 }),
      s({ dmg: 25, cd: 1.45, count: 2, speed: 320, size: 48, knock: 90 }),
      s({ dmg: 30, cd: 1.45, count: 3, speed: 330, size: 50, knock: 90 }),
      s({ dmg: 36, cd: 1.3, count: 4, speed: 345, size: 56, knock: 100 }),
    ],
  },
  shockwave: {
    id: 'shockwave',
    color: 0x6dff8a,
    evolution: 'shockwave_evo',
    levels: [
      s({ dmg: 16, cd: 3.2, count: 1, size: 140, knock: 260 }),
      s({ dmg: 20, cd: 3.0, count: 1, size: 145, knock: 270 }),
      s({ dmg: 24, cd: 3.0, count: 1, size: 170, knock: 290 }),
      s({ dmg: 30, cd: 2.6, count: 1, size: 175, knock: 300 }),
      s({ dmg: 38, cd: 2.3, count: 2, size: 200, knock: 320 }),
    ],
  },
  drones: {
    id: 'drones',
    color: 0x7d8cff,
    evolution: 'drones_evo',
    levels: [
      s({ dmg: 8, cd: 0.9, count: 1, speed: 520, size: 5, pierce: 0 }),
      s({ dmg: 10, cd: 0.8, count: 1, speed: 530, size: 5, pierce: 0 }),
      s({ dmg: 11, cd: 0.8, count: 2, speed: 540, size: 5, pierce: 0 }),
      s({ dmg: 13, cd: 0.7, count: 2, speed: 560, size: 5.5, pierce: 1 }),
      s({ dmg: 16, cd: 0.6, count: 3, speed: 580, size: 6, pierce: 1 }),
    ],
  },
};

export const EVOLUTIONS: Record<EvolutionId, EvolutionDef> = {
  pulse_evo: {
    id: 'pulse_evo',
    from: 'pulse',
    passive: 'might',
    color: 0xffffff,
    stats: s({ dmg: 26, cd: 0.22, count: 3, pierce: 4, speed: 720, size: 8, knock: 50, extra: 46 }),
  },
  orbit_evo: {
    id: 'orbit_evo',
    from: 'orbit',
    passive: 'area',
    color: 0xff7df7,
    stats: s({ dmg: 26, cd: 0.3, count: 8, speed: 4.6, size: 15, extra: 104, knock: 140 }),
  },
  chain_evo: {
    id: 'chain_evo',
    from: 'chain',
    passive: 'crit',
    color: 0xd6f4ff,
    stats: s({ dmg: 32, cd: 0.7, count: 3, extra: 9, size: 200 }),
  },
  laser_evo: {
    id: 'laser_evo',
    from: 'laser',
    passive: 'duration',
    color: 0xff9ab0,
    stats: s({ dmg: 13, cd: 0.1, count: 4, dur: 999, size: 20, extra: 520, speed: 0.9 }),
  },
  mines_evo: {
    id: 'mines_evo',
    from: 'mines',
    passive: 'magnet',
    color: 0xfff08a,
    stats: s({ dmg: 70, cd: 1.4, count: 4, size: 100, dur: 12, knock: 220, extra: 4 }),
  },
  missiles_evo: {
    id: 'missiles_evo',
    from: 'missiles',
    passive: 'haste',
    color: 0xffc27d,
    stats: s({ dmg: 40, cd: 1.1, count: 8, speed: 380, size: 64, knock: 110 }),
  },
  shockwave_evo: {
    id: 'shockwave_evo',
    from: 'shockwave',
    passive: 'armor',
    color: 0xb4ffc4,
    stats: s({ dmg: 55, cd: 2.0, count: 2, size: 260, knock: 360, dur: 2.5 }),
  },
  drones_evo: {
    id: 'drones_evo',
    from: 'drones',
    passive: 'regen',
    color: 0xb9c2ff,
    stats: s({ dmg: 18, cd: 0.45, count: 5, speed: 640, size: 6.5, pierce: 2 }),
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const EVOLUTION_IDS = Object.keys(EVOLUTIONS) as EvolutionId[];
