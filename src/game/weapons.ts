import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type { WeaponId, WeaponStats } from '../data/types';
import type { Enemy } from './entities';
import { EV } from './events';
import type { World } from './World';

const TAU = Math.PI * 2;

/** Sound/visual codes carried by EV.SHOOT. */
export const SHOT = { PULSE: 0, CHAIN: 1, LASER: 2, MINE: 3, MISSILE: 4, WAVE: 5, DRONE: 6, BLADE: 7 } as const;

/** Visual kinds for Bullet.kind */
export const BK = { PULSE: 0, PULSE_EVO: 1, DRONE: 2, DRONE_EVO: 3, MISSILE: 4, MISSILE_EVO: 5 } as const;

interface LaserBeam {
  ang: number;
  life: number;
  max: number;
}

export interface WeaponInst {
  id: WeaponId;
  slot: number;
  level: number;
  evo: boolean;
  /** damage bonus from rarity */
  bonus: number;
  /** cooldown timer */
  t: number;
  /** generic accumulator (orbit angle, pending wave…) */
  a: number;
  /** tick accumulator */
  tick: number;
  beams: LaserBeam[];
  droneX: number[];
  droneY: number[];
  droneT: number[];
}

export function createWeapon(id: WeaponId, slot: number, bonus: number): WeaponInst {
  return { id, slot, level: 1, evo: false, bonus, t: 0.25, a: 0, tick: 0, beams: [], droneX: [], droneY: [], droneT: [] };
}

export function rawStats(w: WeaponInst): WeaponStats {
  return w.evo ? EVOLUTIONS[WEAPONS[w.id].evolution].stats : WEAPONS[w.id].levels[w.level - 1];
}

interface Eff {
  dmg: number;
  cd: number;
  count: number;
  area: number;
  dur: number;
  st: WeaponStats;
}

const eff: Eff = { dmg: 0, cd: 0, count: 0, area: 1, dur: 1, st: WEAPONS.pulse.levels[0] };

function computeEff(world: World, w: WeaponInst): Eff {
  const s = world.stats;
  const st = rawStats(w);
  eff.st = st;
  eff.dmg = st.dmg * s.might * (1 + w.bonus);
  eff.cd = st.cd / (1 + s.haste);
  eff.count = st.count + s.amount;
  eff.area = s.area;
  eff.dur = s.duration;
  return eff;
}

export function updateWeapons(world: World, dt: number): void {
  world.blades.reset();
  world.beams.reset();
  world.drones.reset();
  for (const w of world.weapons) {
    const e = computeEff(world, w);
    switch (w.id) {
      case 'pulse':
        pulse(world, w, e, dt);
        break;
      case 'orbit':
        orbit(world, w, e, dt);
        break;
      case 'chain':
        chain(world, w, e, dt);
        break;
      case 'laser':
        laser(world, w, e, dt);
        break;
      case 'mines':
        mines(world, w, e, dt);
        break;
      case 'missiles':
        missiles(world, w, e, dt);
        break;
      case 'shockwave':
        shockwave(world, w, e, dt);
        break;
      case 'drones':
        drones(world, w, e, dt);
        break;
    }
  }
}

function fireBullet(
  world: World,
  slot: number,
  x: number,
  y: number,
  ang: number,
  speed: number,
  r: number,
  dmg: number,
  pierce: number,
  kind: number,
  life: number,
  knock: number,
  aoe = 0,
  turn = 0,
  target: Enemy | null = null,
): void {
  const b = world.bulletPool.get();
  b.alive = true;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(ang) * speed;
  b.vy = Math.sin(ang) * speed;
  b.speed = speed;
  b.r = r;
  b.dmg = dmg;
  b.pierce = pierce;
  b.kind = kind;
  b.life = life;
  b.slot = slot;
  b.knock = knock;
  b.aoe = aoe;
  b.turn = turn;
  b.target = target;
  b.hits.length = 0;
  world.bullets.push(b);
}

/** Random alive enemy within range (reservoir sampling). */
function randomEnemy(world: World, x: number, y: number, range: number, exclude?: readonly number[]): Enemy | null {
  let pick: Enemy | null = null;
  let n = 0;
  const r2 = range * range;
  for (const e of world.enemies) {
    if (!e.alive || e.spawnT < 0.5) continue;
    if (exclude && exclude.includes(e.uid)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > r2) continue;
    n++;
    if (world.rng.next() * n < 1) pick = e;
  }
  return pick;
}

// ---------------------------------------------------------------- weapons

function pulse(world: World, w: WeaponInst, e: Eff, dt: number): void {
  w.t -= dt;
  if (w.t > 0) return;
  const p = world.player;
  const target = world.nearestEnemy(p.x, p.y, 540);
  if (!target) {
    w.t = 0.08;
    return;
  }
  const base = Math.atan2(target.y - p.y, target.x - p.x);
  const n = e.count;
  const spread = w.evo ? 0.1 : 0.14;
  const st = e.st;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    fireBullet(
      world,
      w.slot,
      p.x + Math.cos(a) * 12,
      p.y + Math.sin(a) * 12,
      a,
      st.speed,
      st.size * Math.sqrt(e.area),
      e.dmg,
      st.pierce,
      w.evo ? BK.PULSE_EVO : BK.PULSE,
      1.1,
      st.knock,
      w.evo ? st.extra * e.area : 0,
    );
  }
  world.events.push(EV.SHOOT, p.x, p.y, SHOT.PULSE, base);
  w.t += e.cd;
  if (w.t < 0) w.t = 0;
}

function orbit(world: World, w: WeaponInst, e: Eff, dt: number): void {
  const p = world.player;
  const st = e.st;
  w.a += st.speed * dt * (0.85 + 0.15 * e.dur);
  const n = e.count;
  let R = st.extra * e.area;
  if (w.evo) R *= 0.82 + 0.28 * Math.sin(world.t * 2.2);
  const br = st.size * e.area;
  const interval = e.cd;
  for (let i = 0; i < n; i++) {
    const ang = w.a + (i / n) * TAU;
    const bx = p.x + Math.cos(ang) * R;
    const by = p.y + Math.sin(ang) * R;
    const b = world.blades.next();
    b.x = bx;
    b.y = by;
    b.ang = ang + Math.PI / 2;
    b.r = br;
    b.evo = w.evo;
    const list = world.enemiesInRadius(bx, by, br);
    for (let j = list.length - 1; j >= 0; j--) {
      const en = list[j];
      if (world.t - en.hitT[w.slot] < interval) continue;
      en.hitT[w.slot] = world.t;
      const dx = en.x - p.x;
      const dy = en.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      world.hurtEnemy(en, e.dmg, w.slot, (dx / d) * st.knock, (dy / d) * st.knock);
    }
  }
}

function chain(world: World, w: WeaponInst, e: Eff, dt: number): void {
  w.t -= dt;
  if (w.t > 0) return;
  const p = world.player;
  const st = e.st;
  let fired = false;
  const hit: number[] = [];
  for (let s = 0; s < e.count; s++) {
    const first = randomEnemy(world, p.x, p.y, 380, hit);
    if (!first) break;
    fired = true;
    const pts: number[] = [p.x, p.y];
    let cur: Enemy | null = first;
    let k = 1;
    for (let j = 0; j <= st.extra && cur; j++) {
      pts.push(cur.x, cur.y);
      hit.push(cur.uid);
      world.hurtEnemy(cur, e.dmg * k, w.slot, 0, 0);
      cur = world.nearestEnemy(cur.x, cur.y, st.size * Math.sqrt(e.area), hit);
      if (!w.evo) k *= 0.88;
    }
    world.events.push(EV.BOLT, p.x, p.y, w.evo ? 1 : 0, 0, 0, pts);
  }
  if (fired) world.events.push(EV.SHOOT, p.x, p.y, SHOT.CHAIN);
  w.t = fired ? e.cd : 0.15;
}

function laser(world: World, w: WeaponInst, e: Eff, dt: number): void {
  const p = world.player;
  const st = e.st;
  const len = st.extra * Math.sqrt(e.area);
  const width = st.size * e.area;
  if (w.evo) {
    w.a += st.speed * dt;
    const n = e.count;
    w.beams.length = 0;
    for (let i = 0; i < n; i++) w.beams.push({ ang: w.a + (i / n) * TAU, life: 1, max: 1 });
  } else {
    w.t -= dt;
    if (w.t <= 0 && w.beams.length === 0) {
      const target = world.nearestEnemy(p.x, p.y, 520);
      if (!target) {
        w.t = 0.15;
      } else {
        const base = Math.atan2(target.y - p.y, target.x - p.x);
        const dur = st.dur * e.dur;
        for (let i = 0; i < e.count; i++) w.beams.push({ ang: base + (i / e.count) * TAU, life: dur, max: dur });
        w.t = e.cd + dur;
        world.events.push(EV.SHOOT, p.x, p.y, SHOT.LASER);
      }
    }
    for (const b of w.beams) {
      b.life -= dt;
      b.ang += 0.55 * dt;
    }
    for (let i = w.beams.length - 1; i >= 0; i--) if (w.beams[i].life <= 0) w.beams.splice(i, 1);
  }
  if (w.beams.length === 0) return;
  for (const b of w.beams) {
    const vb = world.beams.next();
    vb.x = p.x;
    vb.y = p.y;
    vb.ang = b.ang;
    vb.len = len;
    vb.width = width;
    vb.life = b.life;
    vb.max = b.max;
    vb.evo = w.evo;
  }
  w.tick += dt;
  if (w.tick < 0.1) return;
  w.tick -= 0.1;
  for (const b of w.beams) {
    const cx = Math.cos(b.ang);
    const cy = Math.sin(b.ang);
    for (const en of world.enemies) {
      if (!en.alive) continue;
      const rx = en.x - p.x;
      const ry = en.y - p.y;
      const along = rx * cx + ry * cy;
      if (along < -en.r || along > len + en.r) continue;
      const perp = Math.abs(rx * cy - ry * cx);
      if (perp > width * 0.5 + en.r) continue;
      world.hurtEnemy(en, e.dmg, w.slot, cx * 12, cy * 12);
    }
  }
}

function mines(world: World, w: WeaponInst, e: Eff, dt: number): void {
  const p = world.player;
  const st = e.st;
  w.t -= dt;
  if (w.t <= 0) {
    for (let i = 0; i < e.count; i++) {
      const m = world.minePool.get();
      m.alive = true;
      const a = world.rng.angle();
      const r = i === 0 ? 0 : world.rng.range(30, 70);
      m.x = p.x + Math.cos(a) * r;
      m.y = p.y + Math.sin(a) * r;
      m.arm = 0.45;
      m.life = st.dur * e.dur;
      m.slot = w.slot;
      m.evo = w.evo;
      m.t = 0;
      world.mines.push(m);
    }
    world.events.push(EV.SHOOT, p.x, p.y, SHOT.MINE);
    w.t = e.cd;
  }
  const radius = st.size * e.area;
  for (const m of world.mines) {
    if (!m.alive || m.slot !== w.slot) continue;
    m.t += dt;
    m.arm -= dt;
    m.life -= dt;
    let boom = m.life <= 0;
    if (!boom && m.arm <= 0) boom = world.enemiesInRadius(m.x, m.y, 20).length > 0;
    if (!boom) continue;
    m.alive = false;
    world.explode(m.x, m.y, radius, e.dmg, w.slot, st.knock, w.evo ? 0xfff08a : 0xffd23d);
    if (w.evo) {
      const k = Math.max(1, st.extra);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * TAU + world.rng.next();
        world.explode(m.x + Math.cos(a) * radius * 0.8, m.y + Math.sin(a) * radius * 0.8, radius * 0.6, e.dmg * 0.6, w.slot, st.knock * 0.5, 0xffd23d);
      }
    }
  }
}

function missiles(world: World, w: WeaponInst, e: Eff, dt: number): void {
  w.t -= dt;
  if (w.t > 0) return;
  const p = world.player;
  const st = e.st;
  const first = world.nearestEnemy(p.x, p.y, 650);
  if (!first) {
    w.t = 0.15;
    return;
  }
  const n = e.count;
  const used: number[] = [];
  for (let i = 0; i < n; i++) {
    const target = (i === 0 ? first : randomEnemy(world, p.x, p.y, 520, used)) ?? first;
    used.push(target.uid);
    const a = p.face + Math.PI + (i - (n - 1) / 2) * 0.45 + world.rng.range(-0.15, 0.15);
    fireBullet(
      world,
      w.slot,
      p.x,
      p.y,
      a,
      st.speed,
      7,
      e.dmg,
      0,
      w.evo ? BK.MISSILE_EVO : BK.MISSILE,
      3.2,
      st.knock,
      st.size * e.area,
      w.evo ? 7.5 : 5.5,
      target,
    );
  }
  world.events.push(EV.SHOOT, p.x, p.y, SHOT.MISSILE);
  w.t = e.cd;
}

function shockwave(world: World, w: WeaponInst, e: Eff, dt: number): void {
  const p = world.player;
  const st = e.st;
  const color = w.evo ? 0xb4ffc4 : 0x6dff8a;
  const slow = w.evo ? st.dur * e.dur : 0;
  if (w.a > 0) {
    w.a -= dt;
    if (w.a <= 0) world.addRing(p.x, p.y, st.size * e.area * 1.15, 0.5, w.slot, e.dmg * 0.8, st.knock, color, false, slow);
  }
  w.t -= dt;
  if (w.t > 0) return;
  if (!world.nearestEnemy(p.x, p.y, st.size * e.area + 60)) {
    w.t = 0.2;
    return;
  }
  world.addRing(p.x, p.y, st.size * e.area, 0.45, w.slot, e.dmg, st.knock, color, false, slow);
  if (e.count > 1) w.a = 0.32;
  world.events.push(EV.SHOOT, p.x, p.y, SHOT.WAVE);
  w.t = e.cd;
}

function drones(world: World, w: WeaponInst, e: Eff, dt: number): void {
  const p = world.player;
  const st = e.st;
  const n = e.count;
  w.a += dt * 1.1;
  let fired = false;
  for (let i = 0; i < n; i++) {
    if (w.droneX.length <= i) {
      w.droneX.push(p.x);
      w.droneY.push(p.y);
      w.droneT.push(world.rng.range(0, st.cd));
    }
    const ang = w.a + (i / n) * TAU;
    const R = 58 + (n > 3 ? 10 : 0);
    const tx = p.x + Math.cos(ang) * R;
    const ty = p.y + Math.sin(ang) * R * 0.8 - 12;
    const k = 1 - Math.exp(-7 * dt);
    w.droneX[i] += (tx - w.droneX[i]) * k;
    w.droneY[i] += (ty - w.droneY[i]) * k;
    const dx = w.droneX[i];
    const dy = w.droneY[i];
    w.droneT[i] -= dt;
    const vd = world.drones.next();
    vd.x = dx;
    vd.y = dy;
    vd.evo = w.evo;
    vd.t = w.droneT[i];
    if (w.droneT[i] <= 0) {
      const target = world.nearestEnemy(dx, dy, 470);
      if (target) {
        const a = Math.atan2(target.y - dy, target.x - dx);
        vd.ang = a;
        fireBullet(world, w.slot, dx, dy, a, st.speed, st.size, e.dmg, st.pierce, w.evo ? BK.DRONE_EVO : BK.DRONE, 1, 20);
        w.droneT[i] = e.cd * world.rng.range(0.9, 1.1);
        fired = true;
      } else {
        w.droneT[i] = 0.1;
      }
    }
  }
  if (fired) world.events.push(EV.SHOOT, p.x, p.y, SHOT.DRONE);
}
