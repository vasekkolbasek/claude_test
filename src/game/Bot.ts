import { hypot, Rng } from '../core/math';
import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type { UpgradeCard } from '../data/types';
import type { World } from './World';

export interface BotOptions {
  /** 0 = clueless newbie, 1 = sharp player */
  skill: number;
  seed?: number;
}

const PASSIVE_PRIORITY: Record<string, number> = {
  might: 9,
  haste: 8,
  maxhp: 7,
  armor: 7,
  amount: 9,
  area: 6,
  regen: 5,
  speed: 5,
  crit: 5,
  magnet: 4,
  duration: 4,
  growth: 4,
  luck: 3,
};

/**
 * Simple steering bot used by the balance simulator and smoke tests.
 * Repels from threats, drifts towards crystals, picks upgrades by heuristic.
 */
export class Bot {
  private readonly rng: Rng;
  private think = 0;
  private dirX = 0;
  private dirY = 0;
  private wander = 0;

  constructor(private readonly opts: BotOptions) {
    this.rng = new Rng(opts.seed ?? 1234);
    this.wander = this.rng.angle();
  }

  /** Writes movement intent into world.input. */
  steer(w: World, dt: number): void {
    this.think -= dt;
    if (this.think > 0) {
      w.input.x = this.dirX;
      w.input.y = this.dirY;
      return;
    }
    const skill = this.opts.skill;
    this.think = 0.05 + (1 - skill) * 0.22;
    const p = w.player;
    const sense = 120 + skill * 140;
    let ax = 0;
    let ay = 0;
    for (const e of w.enemies) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = hypot(dx, dy) || 1;
      const healthy = p.hp > w.stats.maxHp * 0.6;
      const range = sense + e.r + (e.def.boss ? (healthy ? 40 : 120) : 0);
      if (d > range) continue;
      const wgt = Math.pow((range - d) / range, 2) * (e.def.boss ? (healthy ? 1.5 : 3) : 1) * (1 + e.dmg / 20);
      ax += (dx / d) * wgt;
      ay += (dy / d) * wgt;
    }
    for (const b of w.ebullets) {
      if (!b.alive) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = hypot(dx, dy) || 1;
      if (d > sense * 0.8) continue;
      const wgt = Math.pow((sense * 0.8 - d) / (sense * 0.8), 2) * 2 * skill;
      // dodge sideways relative to the bullet direction
      const side = b.vx * dy - b.vy * dx > 0 ? 1 : -1;
      const bl = hypot(b.vx, b.vy) || 1;
      ax += (-b.vy / bl) * side * wgt + (dx / d) * wgt * 0.5;
      ay += (b.vx / bl) * side * wgt + (dy / d) * wgt * 0.5;
    }
    const danger = hypot(ax, ay);
    // seek crystals when it is reasonably safe
    let gx = 0;
    let gy = 0;
    let best = (220 + skill * 200) ** 2;
    for (const g of w.gems) {
      if (!g.alive) continue;
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        const d = Math.sqrt(d2) || 1;
        gx = dx / d;
        gy = dy / d;
      }
    }
    this.wander += this.rng.range(-0.4, 0.4);
    const wx = Math.cos(this.wander) * 0.35;
    const wy = Math.sin(this.wander) * 0.35;
    const gemW = danger > 1.2 ? 0.25 : 0.9;
    let mx = ax * 1.4 + gx * gemW + wx;
    let my = ay * 1.4 + gy * gemW + wy;
    // newbies hesitate and jitter
    if (this.rng.next() > 0.55 + skill * 0.45) {
      mx += this.rng.range(-1, 1);
      my += this.rng.range(-1, 1);
    }
    const l = hypot(mx, my);
    if (l > 0.05) {
      this.dirX = mx / l;
      this.dirY = my / l;
    } else {
      this.dirX = 0;
      this.dirY = 0;
    }
    w.input.x = this.dirX;
    w.input.y = this.dirY;
  }

  /** Picks the index of the card to take. */
  pick(cards: readonly UpgradeCard[], w: World): number {
    const skill = this.opts.skill;
    let best = 0;
    let bestScore = -Infinity;
    cards.forEach((c, i) => {
      let s = 0;
      switch (c.kind) {
        case 'evolution':
          s = 100;
          break;
        case 'weapon_up':
          s = 20 + c.rarity * 4;
          break;
        case 'weapon_new':
          s = w.weapons.length < 3 ? 24 : w.weapons.length < 5 ? 14 : 8;
          break;
        case 'passive_new':
        case 'passive_up': {
          s = (PASSIVE_PRIORITY[c.id] ?? 3) * 2 + c.rarity * 3;
          // a sensible player completes evolution recipes (weapon 5 + module 5)
          const recipe = w.weapons.some((x) => !x.evo && EVOLUTIONS[WEAPONS[x.id].evolution].passive === c.id);
          if (recipe) s += 6 + skill * 10;
          break;
        }
        case 'heal':
          s = w.player.hp < w.stats.maxHp * 0.5 ? 30 : 2;
          break;
        case 'bits':
          s = 3;
          break;
      }
      s += this.rng.range(0, 25) * (1 - skill);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    return best;
  }
}
