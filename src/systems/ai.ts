import { lerpAngle, segmentsIntersect } from '../core/math';
import { ECONOMIC } from '../data/buildings';
import { Building, Unit, type Ent } from '../entities/entities';
import { formation, type Game } from './Game';
import { attack, dealDamage, isAlive } from './combat';

const tmp = { x: 0, z: 0, tx: 0, tz: 0 };

export function updateUnits(g: Game, dt: number): void {
  g.enemyGrid.clear();
  g.allyGrid.clear();
  for (const u of g.units) if (u.alive) (u.team === 1 ? g.enemyGrid : g.allyGrid).insert(u);

  for (let i = 0; i < g.units.length; i++) {
    const u = g.units[i];
    if (!u.alive) continue;
    u.age += dt;
    u.attackT += dt;
    u.hitT += dt;
    u.atkCd -= dt;
    u.think -= dt;
    if (u.burnT > 0) {
      u.burnT -= dt;
      dealDamage(g, u, u.burnDps * dt, { silent: true, src: null });
      if (!u.alive) continue;
    }
    if (u.slowT > 0) u.slowT -= dt;
    if (u.team === 1) enemyAI(g, u, dt);
    else allyAI(g, u, dt);
  }
  separate(g, dt);
}

function nearestBuilding(g: Game, x: number, z: number, r: number, filter?: (b: Building) => boolean): Building | null {
  let best: Building | null = null;
  let bd = Infinity;
  for (const b of g.buildings) {
    if (!b.alive || (filter && !filter(b))) continue;
    let d: number;
    if (b.wall) d = distToSegment(x, z, b.wall.ax, b.wall.az, b.wall.bx, b.wall.bz);
    else d = Math.hypot(b.x - x, b.z - z) - b.radius;
    if (d < r && d < bd) { bd = d; best = b; }
  }
  return best;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Distance from unit edge to target edge. */
export function gap(u: { x: number; z: number; radius: number }, t: Ent): number {
  if (t.ent === 'b' && t.wall) return distToSegment(u.x, u.z, t.wall.ax, t.wall.az, t.wall.bx, t.wall.bz) - u.radius - 0.4;
  return Math.hypot(t.x - u.x, t.z - u.z) - u.radius - t.radius;
}

function acquireEnemyTarget(g: Game, u: Unit): Ent | null {
  const def = u.def;
  const cur = u.target;
  if (def.targets === 'buildings') {
    if (cur && isAlive(cur) && gap(u, cur) < 4) return cur;
    return nearestBuilding(g, u.x, u.z, 3.5 + u.radius);
  }
  if (def.targets === 'economy') {
    if (cur && isAlive(cur) && cur.ent === 'b') return cur;
    const econ = nearestBuilding(g, u.x, u.z, 70, (b) => ECONOMIC.has(b.kind));
    if (econ) return econ;
  }
  const aggro = def.ranged ? def.range + 1 : def.aggro ?? 4.2;
  if (cur && isAlive(cur) && cur.ent !== 'b' && gap(u, cur) < aggro + 1.5) return cur;
  let best: Ent | null = g.allyGrid.nearest(u.x, u.z, aggro + 0.5);
  const h = g.hero;
  if (h.alive) {
    const dh = Math.hypot(h.x - u.x, h.z - u.z);
    if (dh < aggro && (!best || dh < Math.hypot(best.x - u.x, best.z - u.z))) best = h;
  }
  if (best) return best;
  if (cur && isAlive(cur) && cur.ent === 'b' && gap(u, cur) < 3) return cur;
  return nearestBuilding(g, u.x, u.z, (def.ranged ? def.range : 2.2) + u.radius);
}

function enemyAI(g: Game, u: Unit, dt: number): void {
  const def = u.def;
  const spd = u.speed * (u.slowT > 0 ? 1 - u.slowAmt : 1);

  if (def.summon && g.phase === 'night') {
    u.summonT -= dt;
    if (u.summonT <= 0) {
      u.summonT = def.summon.every;
      for (let i = 0; i < def.summon.count; i++) {
        const m = g.spawnEnemy(def.summon.unit, u.path, Math.max(0, u.s - 1.5));
        m.x = u.x + g.rng.range(-2, 2);
        m.z = u.z + g.rng.range(-2, 2);
      }
    }
  }

  let t = u.target;
  if (t && !isAlive(t)) t = u.target = null;
  if (u.think <= 0) {
    u.think = 0.25 + Math.random() * 0.15;
    const prev = t;
    t = u.target = acquireEnemyTarget(g, u) ?? (prev && prev.ent === 'b' && isAlive(prev) ? prev : null);
    // At the end of the road the castle is the only target.
    if (!t && u.s >= g.paths[u.path].length - 0.5) t = u.target = g.castle;
  }

  if (t) {
    const reach = def.ranged ? def.range : def.range;
    if (gap(u, t) <= reach) {
      u.facing = lerpAngle(u.facing, Math.atan2(t.x - u.x, t.z - u.z), Math.min(1, dt * 10));
      u.moving = false;
      if (u.atkCd <= 0) attack(g, u, t);
      return;
    }
    moveToward(g, u, t.x, t.z, spd, dt);
    u.s = Math.max(u.s, g.paths[u.path].project(u.x, u.z).s - 0.5);
    return;
  }

  // Path following.
  const line = g.paths[u.path];
  if (u.s >= line.length) {
    u.target = g.castle;
    return;
  }
  line.sample(Math.min(line.length, u.s + 1.6), tmp);
  const lat = u.lat * Math.min(1, (line.length - u.s) / 6);
  const px = tmp.x - tmp.tz * lat, pz = tmp.z + tmp.tx * lat;
  const ox = u.x, oz = u.z;
  if (moveToward(g, u, px, pz, spd, dt)) {
    const adv = (u.x - ox) * tmp.tx + (u.z - oz) * tmp.tz;
    u.s += Math.max(adv, 0);
    // Catch up if we drifted ahead of the sampling point.
    if (Math.hypot(px - u.x, pz - u.z) < 0.6) u.s += spd * dt * 0.5;
  }
}

function allyAI(g: Game, u: Unit, dt: number): void {
  const def = u.def;
  let hx = u.holdX, hz = u.holdZ;
  const follow = g.rallyFollow && g.hero.alive;
  if (follow) {
    const off = formation(u.slotIdx + (u.owner ? (u.owner.id % 5) * 3 : 0));
    const back = 2.2;
    hx = g.hero.x - Math.sin(g.hero.facing) * back + off.x * 1.3;
    hz = g.hero.z - Math.cos(g.hero.facing) * back + off.z * 1.3;
  }
  const aggro = def.aggro ?? 6;
  let t = u.target;
  if (t && !isAlive(t)) t = u.target = null;
  if (u.think <= 0) {
    u.think = 0.2 + Math.random() * 0.15;
    const leash = follow ? 7 : aggro + 2.5;
    if (t && (Math.hypot(t.x - hx, t.z - hz) > leash + 2 || gap(u, t) > aggro + 2)) t = null;
    if (!t) {
      t = g.enemyGrid.nearest(u.x, u.z, aggro, (e) => Math.hypot(e.x - hx, e.z - hz) < leash);
    }
    u.target = t;
  }
  if (t) {
    if (gap(u, t) <= def.range) {
      u.facing = lerpAngle(u.facing, Math.atan2(t.x - u.x, t.z - u.z), Math.min(1, dt * 10));
      u.moving = false;
      if (u.atkCd <= 0) attack(g, u, t);
      return;
    }
    moveToward(g, u, t.x, t.z, u.speed * (u.slowT > 0 ? 1 - u.slowAmt : 1), dt);
    return;
  }
  const d = Math.hypot(hx - u.x, hz - u.z);
  if (d > 0.35) {
    const boost = follow ? (d > 4 ? 2.4 : 1.6) : d > 6 ? 1.6 : 1;
    moveToward(g, u, hx, hz, u.speed * boost, dt);
  } else {
    u.moving = false;
    if (follow) u.facing = lerpAngle(u.facing, g.hero.facing, Math.min(1, dt * 4));
  }
}

/** Moves a unit; returns false if blocked by a wall (and targets that wall). */
function moveToward(g: Game, u: Unit, tx: number, tz: number, spd: number, dt: number): boolean {
  const dx = tx - u.x, dz = tz - u.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) { u.moving = false; return false; }
  const step = Math.min(spd * dt, len);
  const nx = u.x + (dx / len) * step, nz = u.z + (dz / len) * step;
  if (u.team === 1 && !u.def.flying) {
    for (const w of g.walls) {
      const s = w.wall!;
      if (w.alive && segmentsIntersect(u.x, u.z, nx, nz, s.ax, s.az, s.bx, s.bz)) {
        u.target = w;
        u.moving = false;
        return false;
      }
    }
  }
  u.x = nx;
  u.z = nz;
  u.facing = lerpAngle(u.facing, Math.atan2(dx, dz), Math.min(1, dt * 8));
  u.moving = true;
  return true;
}

function crossesWall(g: Game, x0: number, z0: number, x1: number, z1: number): boolean {
  for (const w of g.walls) {
    const s = w.wall!;
    if (w.alive && segmentsIntersect(x0, z0, x1, z1, s.ax, s.az, s.bx, s.bz)) return true;
  }
  return false;
}

function separate(g: Game, dt: number): void {
  const k = Math.min(1, dt * 8);
  for (const u of g.units) {
    if (!u.alive || u.def.flying) continue;
    let px = 0, pz = 0;
    const r = u.radius;
    const push = (o: Unit) => {
      if (o === u || o.def.flying) return;
      const dx = u.x - o.x, dz = u.z - o.z;
      const min = r + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return;
      const d = Math.sqrt(d2) || 0.01;
      const f = (min - d) / d;
      const w = o.def.big && !u.def.big ? 0.9 : 0.5;
      px += dx * f * w;
      pz += dz * f * w;
      if (d2 < 1e-6) { px += (u.id % 7) * 0.01 - 0.03; pz += (u.id % 5) * 0.01 - 0.02; }
    };
    g.enemyGrid.query(u.x, u.z, r + 2, push);
    g.allyGrid.query(u.x, u.z, r + 2, push);
    // Buildings are solid.
    for (const b of g.buildings) {
      if (!b.alive || b.wall) continue;
      const dx = u.x - b.x, dz = u.z - b.z;
      const min = b.radius + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.01;
        px += (dx / d) * (min - d);
        pz += (dz / d) * (min - d);
      }
    }
    if (px === 0 && pz === 0) continue;
    const nx = u.x + px * k, nz = u.z + pz * k;
    if (u.team === 1 && crossesWall(g, u.x, u.z, nx, nz)) continue;
    u.x = nx;
    u.z = nz;
  }
}
