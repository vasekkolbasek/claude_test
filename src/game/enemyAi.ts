import { BALANCE } from '../data/balance';
import type { Enemy } from './entities';
import { EV } from './events';
import type { World } from './World';

const TAU = Math.PI * 2;

function p(e: Enemy, key: string, fallback: number): number {
  return e.def.p?.[key] ?? fallback;
}

/** Moves along (nx, ny) at speed `s`. */
function move(e: Enemy, nx: number, ny: number, s: number, dt: number): void {
  e.x += nx * s * dt;
  e.y += ny * s * dt;
}

export function updateEnemy(w: World, e: Enemy, dt: number): void {
  const pl = w.player;
  const dx = pl.x - e.x;
  const dy = pl.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const spd = e.speed * (e.slow > 0 ? 0.5 : 1) * (e.spawnT < 1 ? 0.3 + e.spawnT * 0.7 : 1);

  switch (e.def.ai) {
    case 'chase':
      move(e, nx, ny, spd, dt);
      e.ang = Math.atan2(ny, nx);
      break;

    case 'dash': {
      e.t2 -= dt;
      if (e.state === 0) {
        move(e, nx, ny, spd, dt);
        e.ang = Math.atan2(ny, nx);
        if (d < p(e, 'range', 230) && e.t2 <= 0 && e.spawnT >= 1) {
          e.state = 1;
          e.t = p(e, 'windup', 0.6);
          e.tx = nx;
          e.ty = ny;
        }
      } else if (e.state === 1) {
        e.t -= dt;
        move(e, -e.tx, -e.ty, 18, dt);
        e.ang = Math.atan2(e.ty, e.tx);
        if (e.t <= 0) {
          e.state = 2;
          e.t = p(e, 'dashTime', 0.42);
          w.events.push(EV.DASH, e.x, e.y, e.def.color);
        }
      } else {
        e.t -= dt;
        move(e, e.tx, e.ty, p(e, 'dashSpeed', 420) * (e.slow > 0 ? 0.5 : 1), dt);
        if (e.t <= 0) {
          e.state = 0;
          e.t2 = p(e, 'rest', 1.4);
        }
      }
      break;
    }

    case 'shoot': {
      keepDistance(e, nx, ny, d, spd, p(e, 'keep', 230), dt);
      e.ang += dt * 1.5;
      e.t -= dt;
      if (e.t <= 0 && e.spawnT >= 1) {
        e.t = p(e, 'fireCd', 2.6);
        if (d < 560) {
          w.fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), p(e, 'bulletSpeed', 170), p(e, 'bulletDmg', 9), e.def.color);
          w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
        }
      }
      break;
    }

    case 'teleport': {
      e.t2 += dt;
      const every = p(e, 'every', 3.6);
      const tele = p(e, 'telegraph', 0.45);
      if (e.state === 0) {
        move(e, nx, ny, spd * 0.85, dt);
        if (e.t2 > every - tele && d < 900) {
          e.state = 1;
          const a = Math.atan2(-ny, -nx) + w.rng.range(-1.2, 1.2);
          const j = Math.min(p(e, 'jump', 150), d * 0.8);
          e.tx = pl.x + Math.cos(a) * Math.max(90, d - j);
          e.ty = pl.y + Math.sin(a) * Math.max(90, d - j);
        }
      } else if (e.t2 > every) {
        w.events.push(EV.TELEPORT, e.x, e.y, e.tx, e.ty, e.def.color);
        e.x = e.tx;
        e.y = e.ty;
        e.state = 0;
        e.t2 = w.rng.range(0, 0.6);
        e.spawnT = 0.55;
      }
      e.ang += dt * 3;
      break;
    }

    case 'heal': {
      keepDistance(e, nx, ny, d, spd, p(e, 'keep', 190), dt);
      e.ang += dt;
      e.t2 += dt;
      if (e.t2 >= p(e, 'every', 2.6)) {
        e.t2 = 0;
        const r = p(e, 'radius', 150);
        const amount = p(e, 'amount', 0.18);
        let healed = 0;
        for (const o of w.enemies) {
          if (!o.alive || o === e || o.hp >= o.maxHp) continue;
          const ox = o.x - e.x;
          const oy = o.y - e.y;
          if (ox * ox + oy * oy < r * r) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * amount);
            healed++;
          }
        }
        w.events.push(EV.HEAL_PULSE, e.x, e.y, r, healed);
      }
      break;
    }

    case 'bomber': {
      if (e.state === 0) {
        move(e, nx, ny, spd, dt);
        e.ang += dt * 4;
        if (d < p(e, 'trigger', 62) && e.spawnT >= 1) {
          e.state = 1;
          e.t = p(e, 'fuse', 0.75);
        }
      } else {
        e.t -= dt;
        e.ang += dt * 14;
        e.flash = Math.sin(e.t * 40) > 0 ? 0.05 : 0;
        if (e.t <= 0) {
          const r = p(e, 'radius', 82);
          if (d < r + pl.r) w.hurtPlayer(e.dmg, e.x, e.y);
          w.events.push(EV.EXPLODE, e.x, e.y, r, e.def.color);
          e.noReward = true;
          w.killEnemy(e);
        }
      }
      break;
    }

    case 'spawner': {
      move(e, nx, ny, spd, dt);
      e.ang += dt * 0.6;
      e.t2 += dt;
      if (e.t2 >= p(e, 'every', 4.5) && e.spawnT >= 1) {
        e.t2 = 0;
        if (w.enemies.length < 560) {
          const n = p(e, 'count', 3);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + w.rng.next();
            w.queueSpawn('nano', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
          }
        }
      }
      break;
    }

    case 'stalker': {
      move(e, nx, ny, spd, dt);
      e.ang = Math.atan2(ny, nx);
      const reveal = p(e, 'reveal', 150);
      e.alpha = d < reveal || e.flash > 0 ? Math.min(1, e.alpha + dt * 5) : Math.max(0.14, e.alpha - dt * 1.5);
      break;
    }

    case 'weave': {
      // zig-zags towards the player: hard to line up a shot on
      const side = Math.sin(e.age * p(e, 'freq', 5.5) + e.uid) * p(e, 'amp', 1.1);
      const vx = nx - ny * side;
      const vy = ny + nx * side;
      const l = Math.hypot(vx, vy) || 1;
      move(e, vx / l, vy / l, spd, dt);
      e.ang = Math.atan2(vy, vx);
      break;
    }

    case 'sniper': {
      // keeps far away, aims (blinking) and fires one fast shot
      e.ang += dt * 0.8;
      if (e.state === 0) {
        keepDistance(e, nx, ny, d, spd, p(e, 'keep', 360), dt);
        e.t -= dt;
        if (e.t <= 0 && e.spawnT >= 1 && d < 720) {
          e.state = 1;
          e.t2 = p(e, 'aim', 0.9);
        }
      } else {
        e.t2 -= dt;
        e.flash = Math.sin(e.t2 * 28) > 0 ? 0.05 : 0;
        if (e.t2 <= 0) {
          w.fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), p(e, 'bulletSpeed', 430), p(e, 'bulletDmg', 13), e.def.color, 6);
          w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
          e.state = 0;
          e.t = p(e, 'fireCd', 3.4);
        }
      }
      break;
    }

    case 'phantom': {
      // blinks next to the player and answers with a fan of bullets
      e.t2 += dt;
      const every = p(e, 'every', 3.4);
      const tele = p(e, 'telegraph', 0.5);
      if (e.state === 0) {
        move(e, nx, ny, spd * 0.7, dt);
        if (e.t2 > every - tele && d < 900) {
          e.state = 1;
          const a = w.rng.angle();
          const r = Math.max(140, Math.min(p(e, 'jump', 170), d));
          e.tx = pl.x + Math.cos(a) * r;
          e.ty = pl.y + Math.sin(a) * r;
        }
      } else if (e.t2 > every) {
        w.events.push(EV.TELEPORT, e.x, e.y, e.tx, e.ty, e.def.color);
        e.x = e.tx;
        e.y = e.ty;
        e.state = 0;
        e.t2 = w.rng.range(0, 0.6);
        e.spawnT = 0.55;
        const n = p(e, 'shots', 5);
        const base = Math.atan2(pl.y - e.y, pl.x - e.x);
        for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, base + (i - (n - 1) / 2) * 0.22, p(e, 'bulletSpeed', 165), p(e, 'bulletDmg', 8), e.def.color, 7);
        w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
      }
      e.ang += dt * 2;
      break;
    }

    case 'mb_trojan':
      megaTrojan(w, e, nx, ny, spd, dt);
      break;
    case 'mb_crypto':
      cryptolocker(w, e, nx, ny, d, spd, dt);
      break;
    case 'mb_hydra':
      hydra(w, e, nx, ny, spd, dt);
      break;
    case 'mb_overclock':
      overclock(w, e, nx, ny, spd, dt);
      break;
    case 'mb_botnet':
      botnet(w, e, nx, ny, d, spd, dt);
      break;
    case 'boss_core':
      chaosCore(w, e, nx, ny, d, spd, dt);
      break;
  }
}

function keepDistance(e: Enemy, nx: number, ny: number, d: number, spd: number, keep: number, dt: number): void {
  if (d > keep + 40) move(e, nx, ny, spd, dt);
  else if (d < keep - 40) move(e, -nx, -ny, spd * 0.8, dt);
  else {
    const side = e.uid % 2 === 0 ? 1 : -1;
    move(e, -ny * side, nx * side, spd * 0.55, dt);
  }
}

// ------------------------------------------------------------------ mini-bosses

function megaTrojan(w: World, e: Enemy, nx: number, ny: number, spd: number, dt: number): void {
  e.t2 += dt;
  e.t += dt;
  if (e.state === 0) {
    move(e, nx, ny, spd, dt);
    e.ang += dt * 0.8;
    if (e.t2 >= p(e, 'chargeEvery', 4.2)) {
      e.state = 1;
      e.t2 = 0;
      e.tx = nx;
      e.ty = ny;
    }
  } else if (e.state === 1) {
    e.ang += dt * 6;
    e.flash = Math.sin(e.t2 * 30) > 0 ? 0.04 : 0;
    if (e.t2 >= 0.85) {
      e.state = 2;
      e.t2 = 0;
      w.events.push(EV.DASH, e.x, e.y, e.def.color);
    }
  } else {
    move(e, e.tx, e.ty, p(e, 'chargeSpeed', 430), dt);
    e.ang += dt * 10;
    if (e.t2 >= p(e, 'chargeTime', 0.7)) {
      e.state = 0;
      e.t2 = 0;
    }
  }
  if (e.t >= p(e, 'summonEvery', 6)) {
    e.t = 0;
    const n = p(e, 'summon', 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      w.queueSpawn('byte', e.x + Math.cos(a) * (e.r + 10), e.y + Math.sin(a) * (e.r + 10));
    }
  }
}

function cryptolocker(w: World, e: Enemy, nx: number, ny: number, d: number, spd: number, dt: number): void {
  // after a while it stops kiting and closes in, so a fight can't drag on forever
  if (e.age > BALANCE.miniBossEnrage) move(e, nx, ny, d > e.r + 30 ? spd * 1.6 : 0, dt);
  else keepDistance(e, nx, ny, d, spd, p(e, 'keep', 210), dt);
  e.ang += dt * 0.7;
  e.t += dt;
  e.t2 += dt;
  if (e.t >= p(e, 'ringEvery', 2.4)) {
    e.t = 0;
    e.state++;
    const n = p(e, 'ringCount', 14);
    const off = (e.state % 2) * (Math.PI / n);
    const sp = p(e, 'bulletSpeed', 150);
    const dmg = p(e, 'bulletDmg', 12);
    for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, off + (i / n) * TAU, sp, dmg, e.def.color, 8);
    if (e.state % 3 === 0) {
      const base = Math.atan2(ny, nx);
      for (let i = -2; i <= 2; i++) w.fireEnemyBullet(e.x, e.y, base + i * 0.12, sp * 1.5, dmg, 0xff3df2, 7);
    }
    w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
  }
  if (e.t2 >= 12) {
    e.t2 = 0;
    e.maxShield = e.maxHp * 0.08;
    e.shield = e.maxShield;
  }
}

function hydra(w: World, e: Enemy, nx: number, ny: number, spd: number, dt: number): void {
  move(e, nx, ny, spd, dt);
  e.ang += dt * 1.2;
  e.t += dt;
  if (e.t >= p(e, 'shotEvery', 1.9)) {
    e.t = 0;
    const base = Math.atan2(ny, nx);
    const sp = p(e, 'bulletSpeed', 210);
    for (let i = -1; i <= 1; i++) w.fireEnemyBullet(e.x, e.y, base + i * 0.26, sp, p(e, 'bulletDmg', 13), e.def.color, 8);
    w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
  }
  // sheds elite splitters at 75 / 50 / 25 %
  const thresholds = [0.75, 0.5, 0.25];
  while (e.state < thresholds.length && e.hp / e.maxHp < thresholds[e.state]) {
    e.state++;
    for (let i = 0; i < 2; i++) {
      const a = w.rng.angle();
      w.queueSpawn('splitter', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, true);
    }
    w.events.push(EV.BOSS_PHASE, e.x, e.y, e.state, e.def.color);
  }
}

function overclock(w: World, e: Enemy, nx: number, ny: number, spd: number, dt: number): void {
  // state 0: chase · 1: wind-up (blinking) · 2: lunge (repeats `dashes` times)
  e.t2 += dt;
  if (e.state === 0) {
    move(e, nx, ny, spd, dt);
    e.ang += dt * 2;
    if (e.t2 >= p(e, 'dashEvery', 3.4)) {
      e.state = 1;
      e.t2 = 0;
      e.aux = p(e, 'dashes', 3);
    }
  } else if (e.state === 1) {
    e.ang += dt * 14;
    e.flash = Math.sin(e.t2 * 32) > 0 ? 0.05 : 0;
    if (e.t2 >= p(e, 'windup', 0.55)) {
      e.state = 2;
      e.t2 = 0;
      e.tx = nx;
      e.ty = ny;
      w.events.push(EV.DASH, e.x, e.y, e.def.color);
    }
  } else {
    move(e, e.tx, e.ty, p(e, 'dashSpeed', 520), dt);
    e.ang += dt * 20;
    if (e.t2 >= p(e, 'dashTime', 0.3)) {
      // every lunge ends with a ring of bullets
      const n = p(e, 'ring', 10);
      const off = w.rng.angle();
      for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, off + (i / n) * TAU, p(e, 'bulletSpeed', 165), p(e, 'bulletDmg', 11), e.def.color, 7);
      w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
      e.aux--;
      e.t2 = 0;
      e.state = e.aux > 0 ? 1 : 0;
      if (e.state === 1) e.t2 = p(e, 'windup', 0.55) * 0.4; // quicker follow-up lunges
    }
  }
}

function botnet(w: World, e: Enemy, nx: number, ny: number, d: number, spd: number, dt: number): void {
  if (e.age > BALANCE.miniBossEnrage) move(e, nx, ny, d > e.r + 30 ? spd * 1.5 : 0, dt);
  else keepDistance(e, nx, ny, d, spd, p(e, 'keep', 240), dt);
  e.ang += dt * 0.9;
  e.t += dt;
  e.t2 += dt;
  if (e.t2 >= p(e, 'summonEvery', 5.5)) {
    // surrounds the player with a ring of nano-viruses
    e.t2 = 0;
    const n = p(e, 'summon', 8);
    const r = p(e, 'summonRadius', 210);
    const pl = w.player;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      w.queueSpawn('nano', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r);
    }
    w.events.push(EV.BOSS_PHASE, e.x, e.y, 0, e.def.color);
  }
  if (e.t >= p(e, 'shotEvery', 2.2)) {
    e.t = 0;
    const base = Math.atan2(ny, nx);
    for (let i = -1; i <= 1; i++) w.fireEnemyBullet(e.x, e.y, base + i * 0.18, p(e, 'bulletSpeed', 185), p(e, 'bulletDmg', 11), e.def.color, 8);
    w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
  }
}

// ------------------------------------------------------------------ final boss

function chaosCore(w: World, e: Enemy, nx: number, ny: number, d: number, spd: number, dt: number): void {
  const frac = e.hp / e.maxHp;
  // enrage after a while: straight to the final phase, faster and angrier
  const enraged = e.age > BALANCE.bossEnrage;
  const phase = enraged ? 2 : frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
  if (phase !== e.state) {
    e.state = phase;
    e.t = 0;
    e.t2 = 0;
    w.events.push(EV.BOSS_PHASE, e.x, e.y, phase, e.def.color);
    // clear the arena a bit on phase change
    w.addRing(e.x, e.y, 260, 0.6, -1, 0, 0, e.def.color, true);
  }
  const sp = p(e, 'bulletSpeed', 160);
  const dmg = p(e, 'bulletDmg', 14);
  const speedMul = enraged ? 3 : phase === 2 ? 1.5 : 1;
  // drift to a comfortable distance
  if (e.ty > 0) {
    // dashing
    e.ty -= dt;
    move(e, Math.cos(e.tx), Math.sin(e.tx), 380, dt);
  } else if (enraged) {
    // enraged: keeps up with the player (no more leaving it behind) and presses in close
    const hunt = Math.max(spd * speedMul, BALANCE.player.baseSpeed * w.stats.speed * 0.95);
    move(e, nx, ny, d > 120 ? hunt : 0, dt);
  } else if (d > 170) move(e, nx, ny, spd * speedMul, dt);
  else move(e, -nx, -ny, spd * 0.5, dt);
  e.ang += dt * (0.6 + phase * 0.5);
  e.t += dt;
  e.t2 += dt;

  if (phase === 0) {
    if (e.t >= 2) {
      e.t = 0;
      const n = 20;
      const off = (Math.floor(e.t2 / 2) % 2) * (Math.PI / n);
      for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, off + (i / n) * TAU, sp, dmg, 0xff2a55, 9);
      w.events.push(EV.ENEMY_SHOOT, e.x, e.y, e.def.color);
    }
    if (e.t2 >= 6) {
      e.t2 = 0;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        w.queueSpawn('nano', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
      }
    }
  } else {
    // spiral volley: on for 3 s, off for 1.5 s
    const cycle = e.t2 % 4.5;
    const interval = enraged ? 0.07 : phase === 1 ? 0.13 : 0.1;
    const arms = enraged ? 4 : phase === 1 ? 2 : 3;
    if (cycle < 3 && e.t >= interval) {
      e.t = 0;
      e.aux += 0.32; // spiral angle
      for (let i = 0; i < arms; i++) {
        w.fireEnemyBullet(e.x, e.y, e.aux + (i / arms) * TAU, sp * 0.95, dmg, phase === 1 ? 0xff9a3d : 0xff2a55, 8);
      }
    }
    if (e.t2 >= 9) {
      e.t2 = 0;
      // dash at the player
      e.tx = Math.atan2(ny, nx);
      e.ty = 0.55;
      w.events.push(EV.DASH, e.x, e.y, e.def.color);
      if (phase === 2) {
        const n = 20;
        for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, (i / n) * TAU, sp * 1.1, dmg, 0xffffff, 9);
        const rad = 260;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          w.queueSpawn('byte', w.player.x + Math.cos(a) * rad, w.player.y + Math.sin(a) * rad);
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          w.queueSpawn('nano', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
        }
      }
    }
  }
}
