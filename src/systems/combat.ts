import { lerpAngle } from '../core/math';
import { CONFIG } from '../data/config';
import type { AttackStats, ProjKind } from '../data/buildings';
import { Building, Unit, type Ent, type Projectile } from '../entities/entities';
import type { Game } from './Game';

export interface DamageOpts {
  src: Unit | Building | 'hero' | null;
  ranged?: boolean;
  armorPierce?: boolean;
  bonusVsBig?: number;
  bldMul?: number;
  burn?: number;
  slow?: number;
  silent?: boolean;
}

export function isAlive(e: Ent): boolean {
  if (e.ent === 'b') return e.alive;
  return e.alive;
}

export function dealDamage(g: Game, e: Ent, amount: number, o: DamageOpts): void {
  if (!isAlive(e) || amount <= 0) return;
  if (e.ent === 'u') {
    let dmg = amount;
    if (o.ranged && !o.armorPierce && e.def.armor) dmg *= 1 - e.def.armor;
    if (o.bonusVsBig && e.def.big) dmg *= o.bonusVsBig;
    e.hp -= dmg;
    if (!o.silent) {
      e.hitT = 0;
      g.events.emit('hit', { e, dmg });
    }
    if (o.burn) { e.burnDps = e.burnT > 0 ? Math.max(e.burnDps, o.burn) : o.burn; e.burnT = 3; }
    if (o.slow) { e.slowAmt = e.slowT > 0 ? Math.max(e.slowAmt, o.slow) : o.slow; e.slowT = 2.2; }
    // Small knock for juicy feedback.
    if (!o.silent && o.src && o.src !== 'hero' && o.src.ent === 'u' && !e.def.big) {
      const dx = e.x - o.src.x, dz = e.z - o.src.z;
      const d = Math.hypot(dx, dz) || 1;
      e.x += (dx / d) * 0.08;
      e.z += (dz / d) * 0.08;
    }
    if (e.hp <= 0) killUnit(g, e, o.src);
  } else if (e.ent === 'b') {
    const dmg = amount * (o.bldMul ?? 1);
    e.hp -= dmg;
    e.hitT = 0;
    if (!o.silent) g.events.emit('hit', { e, dmg });
    const thorns = e.node?.stats.thorns;
    if (thorns && o.src && o.src !== 'hero' && o.src.ent === 'u' && !o.ranged) dealDamage(g, o.src, thorns, { src: e });
    if (e.hp <= 0) {
      e.hp = 0;
      e.ruined = true;
      e.lostThisNight = true;
      g.stats.lost++;
      g.recomputeAuras();
      g.events.emit('bdestroyed', { b: e });
    }
  } else {
    const h = e;
    h.hp -= amount;
    h.hitT = 0;
    h.lastHurt = g.time;
    if (!o.silent) g.events.emit('hit', { e, dmg: amount });
    if (h.hp <= 0) {
      h.hp = 0;
      h.alive = false;
      h.deadT = CONFIG.hero.respawn;
      h.dashT = 0;
      g.events.emit('heroDeath', {});
    }
  }
}

function killUnit(g: Game, u: Unit, src: DamageOpts['src']): void {
  u.alive = false;
  u.hp = 0;
  if (u.team === 1) {
    g.stats.kills++;
    if (src === 'hero') { g.stats.heroKills++; g.hero.kills++; }
    if (u.def.boss) g.stats.bossKills++;
  } else if (u.owner) {
    const i = u.owner.troops.indexOf(u);
    if (i >= 0) u.owner.troops.splice(i, 1);
  }
  g.events.emit('death', { u });
}

function troopDamageMul(g: Game, u: Unit): number {
  return 1 + g.mods.dmgTroops + (u.owner?.node?.stats.buffTroops ?? 0);
}

/** A unit performs its attack on a target. */
export function attack(g: Game, u: Unit, t: Ent): void {
  const def = u.def;
  u.atkCd = def.cooldown * (0.9 + Math.random() * 0.2);
  u.attackT = 0;
  const mul = u.team === 0 ? troopDamageMul(g, u) : 1;
  const dmg = u.damage * mul;
  if (def.ranged) {
    const p = launch(g, def.ranged, u.team, u.x, u.z, t, dmg, def.big ? 2.4 : 1.1);
    p.bonusVsBig = def.bonusVsBig ?? 1;
    p.bldMul = def.bldMul ?? 1;
    p.splash = def.splash ?? 0;
    p.burn = u.onHitBurn;
    p.armorPierce = def.id === 'crossbowman';
    return;
  }
  if (def.targets === 'buildings' && t.ent !== 'b') return;
  const opts: DamageOpts = { src: u, bonusVsBig: def.bonusVsBig, bldMul: def.bldMul ?? 1, burn: u.onHitBurn || undefined };
  if (def.splash) {
    const r = def.splash;
    const grid = u.team === 1 ? g.allyGrid : g.enemyGrid;
    grid.query(t.x, t.z, r, (o) => { if (o !== t) dealDamage(g, o, dmg * 0.6, opts); });
    if (u.team === 1 && g.hero.alive && t !== g.hero && Math.hypot(g.hero.x - t.x, g.hero.z - t.z) < r) dealDamage(g, g.hero, dmg * 0.6, opts);
  }
  dealDamage(g, t, dmg, opts);
  g.events.emit('melee', { x: t.x, z: t.z, team: u.team });
}

/** Spawn a homing projectile from (x,z) to target. */
export function launch(g: Game, kind: ProjKind, team: 0 | 1, x: number, z: number, t: Ent | null, dmg: number, h0: number, tx?: number, tz?: number): Projectile {
  const p = g.allocProjectile();
  p.kind = kind;
  p.team = team;
  p.x = p.sx = x;
  p.z = p.sz = z;
  p.target = t;
  p.tx = t ? t.x : tx ?? x;
  p.tz = t ? t.z : tz ?? z;
  p.damage = dmg;
  p.h0 = h0;
  p.speed = SPEED[kind];
  p.arc = ARC[kind];
  p.total = Math.max(0.5, Math.hypot(p.tx - x, p.tz - z));
  g.events.emit('shoot', { p });
  return p;
}

const SPEED: Record<ProjKind, number> = { arrow: 24, bolt: 30, orb: 14, frost: 15, fire: 13, dart: 18, hex: 11, rock: 12, star: 18 };
const ARC: Record<ProjKind, number> = { arrow: 0.18, bolt: 0.04, orb: 0.08, frost: 0.08, fire: 0.2, dart: 0.15, hex: 0.1, rock: 0.35, star: 0.05 };

function buildingShoot(g: Game, b: Building, a: AttackStats): void {
  const shots = a.multishot ?? 1;
  const isTower = b.kind === 'tower' || b.kind === 'magic' || b.kind === 'mine';
  const mul = 1 + (isTower ? g.mods.dmgTowers : b.kind === 'castle' ? g.mods.dmgTowers * 0.5 : 0);
  const targets: Unit[] = [];
  const range = a.range;
  // Pick the closest enemies, prefer ones closer to the castle.
  g.enemyGrid.query(b.x, b.z, range, (u) => {
    targets.push(u);
  });
  if (!targets.length) return;
  targets.sort((p, q) => (p.x - b.x) ** 2 + (p.z - b.z) ** 2 - ((q.x - b.x) ** 2 + (q.z - b.z) ** 2));
  const h0 = b.kind === 'castle' ? 6.5 : b.kind === 'mine' ? 2.5 : 4.4;
  for (let i = 0; i < shots; i++) {
    const t = targets[i % targets.length];
    const p = launch(g, a.projectile, 0, b.x, b.z, t, a.damage * mul, h0);
    p.splash = a.splash ?? 0;
    p.pierce = a.pierce ?? 0;
    p.slow = a.slow ?? 0;
    p.burn = a.burn ?? 0;
    p.armorPierce = !!a.armorPierce;
    if (p.pierce) {
      const d = Math.hypot(t.x - b.x, t.z - b.z) || 1;
      p.dirX = (t.x - b.x) / d;
      p.dirZ = (t.z - b.z) / d;
      p.total = range + 2;
      p.target = null;
    }
    if (i < shots - 1 && targets.length === 1) p.delay = i * 0.12;
  }
  b.attackT = 0;
}

export function updateCombat(g: Game, dt: number): void {
  const night = g.phase === 'night' || g.phase === 'defeat';
  if (night) {
    for (const b of g.buildings) {
      if (!b.alive) continue;
      const a = b.node!.stats.attack;
      if (!a) continue;
      b.atkCd -= dt;
      if (b.atkCd <= 0 && g.enemiesAlive > 0) {
        const before = g.projectiles.length;
        buildingShoot(g, b, a);
        if (g.projectiles.length > before) b.atkCd = a.cooldown * (b.kind === 'castle' ? g.mods.castleCd : 1);
        else b.atkCd = 0.2;
      }
    }
  }
  for (const p of g.projectiles) {
    if (!p.alive) continue;
    if (p.delay > 0) { p.delay -= dt; continue; }
    updateProjectile(g, p, dt);
  }
}

function updateProjectile(g: Game, p: Projectile, dt: number): void {
  const step = p.speed * dt;
  if (p.pierce) {
    p.x += p.dirX * step;
    p.z += p.dirZ * step;
    p.tx = p.x + p.dirX;
    p.tz = p.z + p.dirZ;
    p.traveled += step;
    g.enemyGrid.query(p.x, p.z, 0.9, (u) => {
      if (p.hits.includes(u.id)) return;
      p.hits.push(u.id);
      dealDamage(g, u, p.damage, { src: null, ranged: true, armorPierce: p.armorPierce });
      if (p.hits.length >= p.pierce) { p.alive = false; return true; }
    });
    if (p.traveled >= p.total) p.alive = false;
    return;
  }
  if (p.target && isAlive(p.target)) { p.tx = p.target.x; p.tz = p.target.z; }
  const dx = p.tx - p.x, dz = p.tz - p.z;
  const d = Math.hypot(dx, dz);
  p.traveled += step;
  if (d <= step + 0.15) {
    p.x = p.tx;
    p.z = p.tz;
    impact(g, p);
    p.alive = false;
    return;
  }
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  p.total = Math.max(p.total, p.traveled + d);
}

function impact(g: Game, p: Projectile): void {
  const src = p.fromHero ? 'hero' : null;
  const opts: DamageOpts = { src, ranged: true, armorPierce: p.armorPierce, bonusVsBig: p.bonusVsBig, bldMul: p.bldMul, burn: p.burn || undefined, slow: p.slow || undefined };
  if (p.heal) healArea(g, p.x, p.z, 1.6, p.heal);
  if (p.splash > 0) {
    if (p.team === 0) g.enemyGrid.query(p.x, p.z, p.splash, (u) => { dealDamage(g, u, p.damage, opts); });
    else {
      g.allyGrid.query(p.x, p.z, p.splash, (u) => { dealDamage(g, u, p.damage * 0.7, opts); });
      if (g.hero.alive && Math.hypot(g.hero.x - p.x, g.hero.z - p.z) < p.splash) dealDamage(g, g.hero, p.damage * 0.7, opts);
      for (const b of g.buildings) if (b.alive && Math.hypot(b.x - p.x, b.z - p.z) < p.splash + b.radius) dealDamage(g, b, p.damage, opts);
    }
  } else if (p.target && isAlive(p.target)) {
    dealDamage(g, p.target, p.damage, opts);
  }
  g.events.emit('impact', { x: p.x, z: p.z, kind: p.kind, splash: p.splash });
}

function healArea(g: Game, x: number, z: number, r: number, frac: number): void {
  for (const u of g.units) if (u.alive && u.team === 0 && Math.hypot(u.x - x, u.z - z) < r) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * frac);
  for (const b of g.buildings) if (b.alive && Math.hypot(b.x - x, b.z - z) < r + b.radius) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * frac);
  const h = g.hero;
  if (h.alive && Math.hypot(h.x - x, h.z - z) < r) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * frac);
}

// ------------------------------------------------------------------ hero
export function updateHero(g: Game, dt: number): void {
  const h = g.hero;
  h.attackT += dt;
  h.hitT += dt;
  h.abilityT += dt;
  h.abilityCd = Math.max(0, h.abilityCd - dt);
  if (!h.alive) {
    h.deadT -= dt;
    if (h.deadT <= 0) g.respawnHero();
    g.input.ability = false;
    return;
  }
  // Movement (or dash).
  const inp = g.input;
  let mx = inp.moveX, mz = inp.moveZ;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  let speed = h.speed;
  if (h.dashT > 0) {
    h.dashT -= dt;
    mx = h.dashX; mz = h.dashZ;
    speed = 26;
    g.enemyGrid.query(h.x, h.z, h.weapon.abilityRadius, (u) => {
      if (h.dashHit.has(u.id)) return;
      h.dashHit.add(u.id);
      dealDamage(g, u, h.weapon.abilityDamage * (1 + g.mods.dmgHero), { src: 'hero' });
      if (u.alive && !u.def.big) { u.x += h.dashX * 1.2; u.z += h.dashZ * 1.2; }
    });
  }
  h.moving = Math.hypot(mx, mz) > 0.05;
  if (h.moving) {
    const step = speed * dt;
    const nx = h.x + mx * step, nz = h.z + mz * step;
    if (g.hf.walkable(nx, nz)) { h.x = nx; h.z = nz; }
    else if (g.hf.walkable(nx, h.z)) h.x = nx;
    else if (g.hf.walkable(h.x, nz)) h.z = nz;
    pushOutOfBuildings(g, h);
    h.facing = lerpAngle(h.facing, Math.atan2(mx, mz), Math.min(1, dt * 12));
  }
  // Regeneration out of combat.
  if (g.time - h.lastHurt > CONFIG.hero.regenDelay) h.hp = Math.min(h.maxHp, h.hp + CONFIG.hero.regen * dt);

  // Auto attack.
  h.atkCd -= dt;
  const w = h.weapon;
  if (h.atkCd <= 0 && g.enemiesAlive > 0) {
    const t = g.enemyGrid.nearest(h.x, h.z, w.range + 1.2);
    if (t && Math.hypot(t.x - h.x, t.z - h.z) - t.radius <= w.range) {
      h.atkCd = w.cooldown;
      h.attackT = 0;
      if (!h.moving) h.facing = Math.atan2(t.x - h.x, t.z - h.z);
      const dmg = w.damage * (1 + g.mods.dmgHero);
      if (w.projectile) {
        const p = launch(g, w.projectile, 0, h.x, h.z, t, dmg, 2.2);
        p.splash = w.splash ?? 0;
        p.fromHero = true;
      } else {
        dealDamage(g, t, dmg, { src: 'hero' });
        let extra = w.cleave;
        if (extra > 0) {
          g.enemyGrid.query(t.x, t.z, 1.8, (u) => {
            if (u === t || extra <= 0) return;
            extra--;
            dealDamage(g, u, dmg * 0.6, { src: 'hero' });
          });
        }
        g.events.emit('melee', { x: t.x, z: t.z, team: 0 });
      }
    }
  }

  if (inp.ability) {
    inp.ability = false;
    if (h.abilityCd <= 0) useAbility(g);
  }
}

/** Circle collision response: slide around buildings instead of stopping. */
function pushOutOfBuildings(g: Game, h: Game['hero']): void {
  for (const b of g.buildings) {
    if (!b.alive || b.wall) continue;
    const min = b.radius + h.radius * 0.8;
    const dx = h.x - b.x, dz = h.z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.01;
    const px = b.x + (dx / d) * min, pz = b.z + (dz / d) * min;
    if (g.hf.walkable(px, pz)) { h.x = px; h.z = pz; }
  }
}

export function abilityReady(g: Game): boolean { return g.hero.alive && g.hero.abilityCd <= 0; }

export function useAbility(g: Game): void {
  const h = g.hero;
  const w = h.weapon;
  h.abilityCd = w.abilityCd * g.mods.abilityCd;
  h.abilityT = 0;
  g.stats.abilityUses++;
  const dmg = w.abilityDamage * (1 + g.mods.dmgHero);
  switch (w.ability) {
    case 'whirl':
      g.enemyGrid.query(h.x, h.z, w.abilityRadius, (u) => {
        dealDamage(g, u, dmg, { src: 'hero' });
        if (u.alive && !u.def.big) {
          const dx = u.x - h.x, dz = u.z - h.z, d = Math.hypot(dx, dz) || 1;
          u.x += (dx / d) * 1.4; u.z += (dz / d) * 1.4;
        }
      });
      g.events.emit('ability', { kind: 'whirl', x: h.x, z: h.z, r: w.abilityRadius });
      break;
    case 'volley': {
      const t = g.enemyGrid.nearest(h.x, h.z, 16);
      const cx = t ? t.x : h.x + Math.sin(h.facing) * 6;
      const cz = t ? t.z : h.z + Math.cos(h.facing) * 6;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * w.abilityRadius;
        const p = launch(g, 'arrow', 0, h.x, h.z, null, dmg, 2.2, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
        p.splash = 1.5;
        p.arc = 0.5;
        p.speed = 20;
        p.delay = i * 0.04;
        p.fromHero = true;
      }
      g.events.emit('ability', { kind: 'volley', x: cx, z: cz, r: w.abilityRadius });
      break;
    }
    case 'charge': {
      let dx = g.input.moveX, dz = g.input.moveZ;
      const l = Math.hypot(dx, dz);
      if (l < 0.1) {
        const t = g.enemyGrid.nearest(h.x, h.z, 12);
        if (t) { dx = t.x - h.x; dz = t.z - h.z; } else { dx = Math.sin(h.facing); dz = Math.cos(h.facing); }
      }
      const n = Math.hypot(dx, dz) || 1;
      h.dashX = dx / n;
      h.dashZ = dz / n;
      h.dashT = 0.3;
      h.dashHit.clear();
      h.facing = Math.atan2(h.dashX, h.dashZ);
      g.events.emit('ability', { kind: 'charge', x: h.x, z: h.z, r: w.abilityRadius });
      break;
    }
    case 'starfall': {
      const targets: Unit[] = [];
      g.enemyGrid.query(h.x, h.z, w.abilityRadius, (u) => { targets.push(u); });
      for (let i = 0; i < 10; i++) {
        const t = targets.length ? targets[i % targets.length] : null;
        const a = Math.random() * Math.PI * 2, r = Math.random() * w.abilityRadius;
        const p = launch(g, 'star', 0, h.x + Math.cos(a) * 2, h.z + Math.sin(a) * 2, t, dmg, 9, h.x + Math.cos(a) * r, h.z + Math.sin(a) * r);
        p.splash = 1.6;
        p.delay = i * 0.07;
        p.fromHero = true;
        p.arc = 0;
      }
      healArea(g, h.x, h.z, w.abilityRadius, 0.3);
      g.events.emit('ability', { kind: 'starfall', x: h.x, z: h.z, r: w.abilityRadius });
      break;
    }
  }
}
