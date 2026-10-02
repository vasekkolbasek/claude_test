import { CONFIG } from '../data/config';
import { ECONOMIC, type BNode } from '../data/buildings';
import { UNITS } from '../data/units';
import type { Building } from '../entities/entities';
import type { Game } from './Game';

export interface BotOptions {
  /** 0 = careless builder, 1 = plans around attack paths. */
  skill: number;
  /** Probability to pick a random option instead of the best. */
  noise: number;
  seed?: number;
}

/**
 * Simple automated player used by the balance simulator and the smoke tests.
 * It writes into game.input exactly like a human controller would.
 */
export class Bot {
  private target: Building | 'night' | null = null;
  private stuckT = 0;
  private lastX = 0;
  private lastZ = 0;
  private detour = 0;
  private waitT = 0;
  private builtSeen = 0;
  private r: () => number;

  constructor(private g: Game, private o: BotOptions = { skill: 0.7, noise: 0.15 }) {
    let s = (o.seed ?? 7) >>> 0;
    this.r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  update(dt: number): void {
    const g = this.g;
    const inp = g.input;
    inp.hold = false;
    inp.moveX = 0;
    inp.moveZ = 0;
    if (g.choice) {
      g.chooseUpgrade(this.pickOption(g.choice.options));
      this.target = null;
      return;
    }
    if (g.phase === 'day') this.day(dt);
    else if (g.phase === 'night') this.night();
    else this.target = null;
  }

  private moveTo(x: number, z: number, dt: number, stopAt: number): boolean {
    const g = this.g;
    const h = g.hero;
    let dx = x - h.x, dz = z - h.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopAt) return true;
    // Detour when stuck behind water or buildings.
    const moved = Math.hypot(h.x - this.lastX, h.z - this.lastZ);
    this.lastX = h.x;
    this.lastZ = h.z;
    if (moved < h.speed * dt * 0.3) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 0.4) { this.detour = (this.r() < 0.5 ? -1 : 1) * (0.9 + this.r() * 0.6); this.stuckT = 0; }
    if (this.detour !== 0) {
      const c = Math.cos(this.detour), s = Math.sin(this.detour);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      this.detour *= Math.pow(0.2, dt);
      if (Math.abs(this.detour) < 0.05) this.detour = 0;
    }
    const l = Math.hypot(dx, dz) || 1;
    g.input.moveX = dx / l;
    g.input.moveZ = dz / l;
    return false;
  }

  private day(dt: number): void {
    const g = this.g;
    if (g.stats.built !== this.builtSeen) {
      // Release the button after every purchase (the game requires it).
      this.builtSeen = g.stats.built;
      this.target = null;
      this.waitT = 0.15;
    }
    if (this.waitT > 0) { this.waitT -= dt; return; }
    if (this.target && this.target !== 'night') {
      const act = g.actionFor(this.target);
      if (!act || act.cost > g.coins) this.target = null;
    }
    if (!this.target) this.target = this.pickTarget();
    if (this.target === 'night') {
      if (this.moveTo(g.castle.x + 3, g.castle.z + 5, dt, 2.5)) {
        g.input.startNight = true;
        this.target = null;
        this.waitT = 0.5;
      }
      return;
    }
    const b = this.target!;
    const reach = b.radius + CONFIG.hero.buildRadius - 0.6;
    if (this.moveTo(b.x, b.z, dt, reach) || g.activeSlot() === b) {
      g.input.moveX = 0;
      g.input.moveZ = 0;
      if (g.activeSlot() === b) g.input.hold = true;
      else this.moveTo(b.x, b.z, dt, 0.5);
    }
  }

  private night(): void {
    const g = this.g;
    const h = g.hero;
    if (!h.alive) return;
    // Defend the hottest spot: the enemy closest to the castle.
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (const u of g.units) {
      if (!u.alive || u.team !== 1) continue;
      const d = Math.hypot(u.x - g.castle.x, u.z - g.castle.z);
      if (d < bd) { bd = d; best = u; }
    }
    if (best && bd < 26) {
      const dx = best.x - h.x, dz = best.z - h.z;
      const d = Math.hypot(dx, dz);
      const keep = h.weapon.range * 0.8;
      if (d > keep) { g.input.moveX = dx / d; g.input.moveZ = dz / d; }
      // Low health: retreat to the castle to regenerate.
      if (h.hp < h.maxHp * 0.3) {
        const cx = g.castle.x + 3 - h.x, cz = g.castle.z + 4 - h.z;
        const cl = Math.hypot(cx, cz) || 1;
        g.input.moveX = cx / cl; g.input.moveZ = cz / cl;
      }
    } else {
      const cx = g.castle.x + 3 - h.x, cz = g.castle.z + 4 - h.z;
      const cl = Math.hypot(cx, cz);
      if (cl > 1.5) { g.input.moveX = cx / cl; g.input.moveZ = cz / cl; }
    }
    let near = 0;
    g.enemyGrid.query(h.x, h.z, h.weapon.abilityRadius + 1, () => { near++; });
    if (near >= 3 && h.abilityCd <= 0) g.input.ability = true;
  }

  private pickOption(options: BNode[]): number {
    if (options.length < 2) return 0;
    if (this.r() < this.o.noise) return this.r() < 0.5 ? 0 : 1;
    const score = (n: BNode) => {
      const s = n.stats;
      let v = 0;
      if (s.income) v += s.income * 6;
      if (s.attack) v += (s.attack.damage * (s.attack.multishot ?? 1) / s.attack.cooldown) * (1 + (s.attack.splash ?? 0) * 0.5) * 1.2;
      if (s.troops) v += s.troops.count * UNITS[s.troops.unit].damage * 1.3;
      v += s.hp / 60;
      v += ((s.buffTroops ?? 0) + (s.buffTowers ?? 0) + (s.buffHero ?? 0)) * 20;
      v += (s.thorns ?? 0) * 1.5 + (s.cleanBonus ?? 0) * 4;
      return v;
    };
    return score(options[0]) >= score(options[1]) ? 0 : 1;
  }

  private pickTarget(): Building | 'night' {
    const g = this.g;
    const nightsLeft = g.cfg.endless ? 8 : g.map.nights - g.night + 1;
    const active = new Set(g.plan.paths);
    const pressure = this.defensePressure();
    let best: Building | null = null;
    let bs = 0;
    for (const b of g.buildings) {
      const act = g.actionFor(b);
      if (!act || act.cost > g.coins) continue;
      const node = act.options[0];
      const prev = b.node;
      let v = 0;
      const s = node.stats;
      if (ECONOMIC.has(b.kind) || b.kind === 'castle') {
        const gain = (s.income ?? 0) - (prev?.stats.income ?? 0);
        v += gain * Math.max(0, nightsLeft - 1) * 1.3;
      }
      if (s.attack) {
        const dps = (s.attack.damage * (s.attack.multishot ?? 1)) / s.attack.cooldown;
        const prevDps = prev?.stats.attack ? (prev.stats.attack.damage * (prev.stats.attack.multishot ?? 1)) / prev.stats.attack.cooldown : 0;
        v += Math.max(0, dps - prevDps) * 1.6 * pressure * this.coverage(b, active, s.attack.range);
      }
      if (s.troops) v += s.troops.count * 4 * pressure * this.coverage(b, active, 10);
      if (b.kind === 'wall') v += (active.has(b.slot.path!) ? 7 : 1.5) * pressure * this.o.skill + (1 - this.o.skill) * 3;
      if (b.kind === 'forge') v += 6 * pressure;
      if (b.kind === 'castle') v += (g.cfg.endless || g.night >= g.map.nights - 2 ? 14 : 4) * pressure;
      v += (s.hp - (prev?.stats.hp ?? 0)) / 150;
      const sc = v / act.cost + this.r() * this.o.noise;
      if (sc > bs) { bs = sc; best = b; }
    }
    return best && bs > 0.35 ? best : 'night';
  }

  private coverage(b: Building, active: Set<number>, range: number): number {
    if (this.o.skill < 0.3) return 1;
    let best = Infinity;
    for (const i of active) best = Math.min(best, this.g.paths[i].distanceTo(b.x, b.z));
    const near = best < range ? 1 : best < range + 8 ? 0.55 : 0.25;
    return near * this.o.skill + (1 - this.o.skill);
  }

  /** Rough ratio of incoming threat to our firepower. */
  private defensePressure(): number {
    const g = this.g;
    let power = 8;
    for (const b of g.buildings) {
      if (!b.node) continue;
      const a = b.node.stats.attack;
      if (a) power += (a.damage * (a.multishot ?? 1)) / a.cooldown;
      if (b.node.stats.troops) power += b.node.stats.troops.count * 5;
    }
    const threat = g.plan.budget * 2.2;
    return Math.max(0.6, Math.min(3, threat / power));
  }
}
