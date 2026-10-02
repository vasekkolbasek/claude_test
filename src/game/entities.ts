import type { GridItem } from '../core/grid';
import type { EnemyDef } from '../data/types';

export const MAX_WEAPON_SLOTS = 8;

export class Enemy implements GridItem {
  _q = 0;
  uid = 0;
  def!: EnemyDef;
  alive = false;
  x = 0;
  y = 0;
  r = 10;
  /** knockback velocity */
  kx = 0;
  ky = 0;
  hp = 1;
  maxHp = 1;
  shield = 0;
  maxShield = 0;
  /** seconds since last hit (shield regen) */
  sinceHit = 99;
  speed = 50;
  dmg = 5;
  xp = 1;
  elite = false;
  flash = 0;
  /** spawn-in animation 0..1 */
  spawnT = 0;
  ang = 0;
  spin = 0;
  alpha = 1;
  /** AI scratch */
  state = 0;
  t = 0;
  t2 = 0;
  tx = 0;
  ty = 0;
  /** extra AI scratch value */
  aux = 0;
  /** seconds alive */
  age = 0;
  slow = 0;
  /** gives no reward when it dies by its own hand (bomber) */
  noReward = false;
  readonly hitT = new Float32Array(MAX_WEAPON_SLOTS);
}

/** Player-owned projectile. */
export class Bullet {
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  r = 5;
  dmg = 1;
  pierce = 0;
  life = 1;
  /** visual kind, see render */
  kind = 0;
  slot = 0;
  /** explosion radius on hit (0 = none) */
  aoe = 0;
  knock = 0;
  /** homing turn rate in rad/s (0 = straight) */
  turn = 0;
  target: Enemy | null = null;
  speed = 0;
  readonly hits: number[] = [];
}

export class EnemyBullet {
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  r = 7;
  dmg = 5;
  life = 6;
  color = 0xff3df2;
}

export const GEM_XP = 0;
export const GEM_HEAL = 1;
export const GEM_MAGNET = 2;
export const GEM_CHEST = 3;

export class Gem {
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  value = 1;
  kind = GEM_XP;
  tier = 0;
  pulled = false;
  t = 0;
}

export class Mine {
  alive = false;
  x = 0;
  y = 0;
  arm = 0.4;
  life = 8;
  slot = 0;
  evo = false;
  t = 0;
}

export class Ring {
  alive = false;
  x = 0;
  y = 0;
  r = 0;
  maxR = 100;
  t = 0;
  dur = 0.45;
  slot = 0;
  dmg = 0;
  knock = 0;
  slow = 0;
  color = 0xffffff;
  /** 0 = damaging wave, 1 = cosmetic only */
  cosmetic = false;
  readonly hits: number[] = [];
}

export interface Beam {
  x: number;
  y: number;
  ang: number;
  len: number;
  width: number;
  life: number;
  max: number;
  evo: boolean;
}

export interface Blade {
  x: number;
  y: number;
  ang: number;
  r: number;
  evo: boolean;
}

export interface Drone {
  x: number;
  y: number;
  ang: number;
  t: number;
  evo: boolean;
}

/** Generic object pool backed by a free list. */
export class Pool<T> {
  private free: T[] = [];
  constructor(private readonly make: () => T) {}
  get(): T {
    return this.free.pop() ?? this.make();
  }
  release(o: T): void {
    this.free.push(o);
  }
}

/** Array of reusable records rebuilt every frame (blades, beams, drones). */
export class ReuseList<T> {
  readonly items: T[] = [];
  count = 0;
  constructor(private readonly make: () => T) {}
  reset(): void {
    this.count = 0;
  }
  next(): T {
    let o = this.items[this.count];
    if (!o) {
      o = this.make();
      this.items.push(o);
    }
    this.count++;
    return o;
  }
}
