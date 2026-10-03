import { SpatialHash } from '../core/grid';
import { Rng, damp } from '../core/math';
import { BALANCE, xpForLevel } from '../data/balance';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { PASSIVES } from '../data/passives';
import { SECTORS } from '../data/sectors';
import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type {
  CharacterId,
  EnemyDef,
  EnemyId,
  EvolutionId,
  PassiveId,
  PlayerStats,
  SectorDef,
  SectorId,
  UpgradeCard,
  WaveEvent,
  WeaponId,
} from '../data/types';
import { availableEvolutions, rollCards, type LoadoutView } from './cards';
import { eventsBetween, waveStateAt, type GameMode, type WaveState } from './director';
import { updateEnemy } from './enemyAi';
import {
  Bullet,
  Enemy,
  EnemyBullet,
  GEM_CHEST,
  GEM_HEAL,
  GEM_MAGNET,
  GEM_XP,
  Gem,
  Mine,
  Pool,
  Ring,
  ReuseList,
  type Beam,
  type Blade,
  type Drone,
} from './entities';
import { EV, EventQueue } from './events';
import { computeStats, type PassiveInst, type StatBonus } from './stats';
import { createWeapon, updateWeapons, type WeaponInst } from './weapons';

export type RunState = 'playing' | 'levelup' | 'dead' | 'won';

export interface RunConfig {
  mode: GameMode;
  sector: SectorId;
  character: CharacterId;
  seed?: number;
  /** additive stat bonuses from meta progression */
  bonuses?: StatBonus[];
  weaponPool: WeaponId[];
  passivePool: PassiveId[];
}

export interface RunStats {
  kills: number;
  killsBy: Partial<Record<EnemyId, number>>;
  damageBy: Partial<Record<WeaponId, number>>;
  damageTaken: number;
  gems: number;
  miniBosses: number;
  bossKills: number;
  elites: number;
  evolutions: EvolutionId[];
  chests: number;
  maxNoHit: number;
  healed: number;
  bitsBonus: number;
  revives: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  inv: number;
  level: number;
  xp: number;
  xpNext: number;
  face: number;
  moving: boolean;
  noHitT: number;
}

const tmpEnemies: Enemy[] = [];
const bulletNear: Enemy[] = [];
const respawnPt = { x: 0, y: 0 };
const sepNear: Enemy[] = [];

export class World {
  readonly rng: Rng;
  readonly cfg: RunConfig;
  readonly sector: SectorDef;
  readonly mode: GameMode;
  readonly events = new EventQueue();
  readonly grid = new SpatialHash<Enemy>(64, 4096);

  t = 0;
  state: RunState = 'playing';
  readonly player: PlayerState;
  stats: PlayerStats;
  readonly weapons: WeaponInst[] = [];
  readonly passives: PassiveInst[] = [];
  private readonly bonuses: StatBonus[];

  readonly enemies: Enemy[] = [];
  readonly bullets: Bullet[] = [];
  readonly ebullets: EnemyBullet[] = [];
  readonly gems: Gem[] = [];
  readonly mines: Mine[] = [];
  readonly rings: Ring[] = [];
  readonly beams = new ReuseList<Beam>(() => ({ x: 0, y: 0, ang: 0, len: 0, width: 0, life: 0, max: 1, evo: false }));
  readonly blades = new ReuseList<Blade>(() => ({ x: 0, y: 0, ang: 0, r: 0, evo: false }));
  readonly drones = new ReuseList<Drone>(() => ({ x: 0, y: 0, ang: 0, t: 0, evo: false }));

  readonly enemyPool = new Pool(() => new Enemy());
  readonly bulletPool = new Pool(() => new Bullet());
  readonly ebulletPool = new Pool(() => new EnemyBullet());
  readonly gemPool = new Pool(() => new Gem());
  readonly minePool = new Pool(() => new Mine());
  readonly ringPool = new Pool(() => new Ring());

  /** movement intent, length <= 1 */
  readonly input = { x: 0, y: 0 };
  /** half extents of the visible area in world units (set by the view) */
  readonly view = { hw: 280, hh: 600 };

  pendingLevels = 0;
  choices: UpgradeCard[] = [];
  /** set when the current choice screen came from a chest */
  chestChoice = false;
  rerollsLeft: number;
  readonly run: RunStats = {
    kills: 0,
    killsBy: {},
    damageBy: {},
    damageTaken: 0,
    gems: 0,
    miniBosses: 0,
    bossKills: 0,
    elites: 0,
    evolutions: [],
    chests: 0,
    maxNoHit: 0,
    healed: 0,
    bitsBonus: 0,
    revives: 0,
  };
  readonly seen = new Set<EnemyId>();
  readonly weaponsSeen = new Set<string>();
  boss: Enemy | null = null;
  /** alive mini/final bosses (for HUD bars) */
  readonly bosses: Enemy[] = [];
  wave: WaveState;

  private uidSeq = 1;
  private spawnAcc = 0;
  private aimFlip = false;
  /** slow average of the player's velocity: which way the player keeps running */
  driftX = 0;
  driftY = 0;
  private prevT = 0;
  private readonly evScratch: WaveEvent[] = [];
  private readonly spawnQueue: { id: EnemyId; x: number; y: number; elite: boolean }[] = [];
  private magnetT = 0;
  private frame = 0;
  private rosterWeights: number[] = [];

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.mode = cfg.mode;
    this.rng = new Rng(cfg.seed ?? (Date.now() >>> 0));
    this.sector = SECTORS[cfg.sector];
    const ch = CHARACTERS[cfg.character];
    this.bonuses = [ch.bonus, ...(cfg.bonuses ?? [])];
    this.stats = computeStats(this.bonuses, this.passives);
    this.rerollsLeft = this.stats.rerolls;
    this.player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: BALANCE.player.radius,
      hp: this.stats.maxHp,
      inv: 1,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      face: -Math.PI / 2,
      moving: false,
      noHitT: 0,
    };
    this.addWeapon(ch.weapon, 0);
    this.wave = waveStateAt(0, this.mode, this.sector);
  }

  // ---------------------------------------------------------------- loadout

  loadout(): LoadoutView {
    return {
      weapons: this.weapons,
      passives: this.passives,
      luck: this.stats.luck,
      weaponPool: this.cfg.weaponPool,
      passivePool: this.cfg.passivePool,
    };
  }

  addWeapon(id: WeaponId, bonus: number): WeaponInst {
    const w = createWeapon(id, this.weapons.length, bonus);
    this.weapons.push(w);
    this.weaponsSeen.add(id);
    return w;
  }

  private recomputeStats(): void {
    const oldMax = this.stats.maxHp;
    this.stats = computeStats(this.bonuses, this.passives);
    if (this.stats.maxHp > oldMax) this.player.hp += this.stats.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  applyCard(card: UpgradeCard): void {
    switch (card.kind) {
      case 'weapon_new':
        this.addWeapon(card.id as WeaponId, card.value);
        break;
      case 'weapon_up': {
        const w = this.weapons.find((x) => x.id === card.id);
        if (w) {
          w.level = Math.min(5, card.levelTo);
          w.bonus += card.value;
        }
        break;
      }
      case 'passive_new':
        this.passives.push({ id: card.id as PassiveId, level: 1, value: card.value });
        this.recomputeStats();
        break;
      case 'passive_up': {
        const p = this.passives.find((x) => x.id === card.id);
        if (p) {
          p.level = Math.min(PASSIVES[p.id].maxLevel, p.level + 1);
          p.value += card.value;
        }
        this.recomputeStats();
        break;
      }
      case 'evolution':
        this.evolve(card.id as EvolutionId);
        break;
      case 'heal':
        this.heal(this.stats.maxHp * card.value);
        break;
      case 'bits':
        this.run.bitsBonus += card.value;
        break;
    }
  }

  evolve(id: EvolutionId): void {
    const evo = EVOLUTIONS[id];
    const w = this.weapons.find((x) => x.id === evo.from);
    if (!w || w.evo) return;
    w.evo = true;
    w.t = 0;
    this.run.evolutions.push(id);
    this.weaponsSeen.add(id);
    this.events.push(EV.EVOLVE, this.player.x, this.player.y, evo.color, 0, 0, id);
  }

  /** Opens the upgrade choice if levels are pending. */
  private openChoice(): void {
    if (this.pendingLevels <= 0) return;
    this.state = 'levelup';
    this.choices = rollCards(this.loadout(), this.rng, this.stats.choices);
  }

  chooseCard(index: number): void {
    if (this.state !== 'levelup') return;
    const card = this.choices[index];
    if (!card) return;
    this.applyCard(card);
    this.pendingLevels--;
    this.chestChoice = false;
    this.choices = [];
    if (this.pendingLevels > 0) this.openChoice();
    else this.state = 'playing';
  }

  /** Re-rolls current choices. `free` = granted by a rewarded ad. */
  reroll(free: boolean): boolean {
    if (this.state !== 'levelup') return false;
    if (!free) {
      if (this.rerollsLeft <= 0) return false;
      this.rerollsLeft--;
    }
    this.choices = rollCards(this.loadout(), this.rng, this.stats.choices);
    return true;
  }

  revive(): void {
    const p = this.player;
    p.hp = this.stats.maxHp;
    p.inv = BALANCE.player.reviveInvuln;
    this.run.revives++;
    this.state = 'playing';
    // clear the immediate surroundings
    for (const e of this.enemies) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 320) {
        if (!e.def.boss) this.hurtEnemy(e, e.hp * 2, -1, 0, 0, false);
        else {
          e.kx += (dx / d) * 500;
          e.ky += (dy / d) * 500;
        }
      }
    }
    for (const b of this.ebullets) b.alive = false;
    this.events.push(EV.REVIVE, p.x, p.y, 320);
  }

  // ---------------------------------------------------------------- helpers

  heal(amount: number): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + amount);
    const gained = p.hp - before;
    if (gained > 0.5) {
      this.run.healed += gained;
      this.events.push(EV.HEAL, p.x, p.y, gained);
    }
  }

  nearestEnemy(x: number, y: number, maxDist: number, exclude?: readonly number[]): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist * maxDist;
    for (const e of this.enemies) {
      if (!e.alive || e.spawnT < 0.5) continue;
      if (exclude && exclude.includes(e.uid)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy - e.r * e.r;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Auto-aim target: a boss in range gets every other shot (otherwise the endless swarm around
   * the player soaks up all damage and boss fights drag on), else the nearest enemy.
   */
  aimTarget(x: number, y: number, maxDist: number): Enemy | null {
    if (this.bosses.length > 0 && (this.aimFlip = !this.aimFlip)) {
      let best: Enemy | null = null;
      let bd = maxDist * maxDist;
      for (const b of this.bosses) {
        if (!b.alive || b.spawnT < 0.5) continue;
        const d = (b.x - x) ** 2 + (b.y - y) ** 2 - b.r * b.r;
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) return best;
    }
    return this.nearestEnemy(x, y, maxDist);
  }

  /** Enemies whose bodies overlap the circle. Returned array is reused. */
  enemiesInRadius(x: number, y: number, r: number): Enemy[] {
    this.grid.query(x, y, r, tmpEnemies);
    let n = 0;
    for (let i = 0; i < tmpEnemies.length; i++) {
      const e = tmpEnemies[i];
      if (!e.alive) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const rr = r + e.r;
      if (dx * dx + dy * dy <= rr * rr) tmpEnemies[n++] = e;
    }
    tmpEnemies.length = n;
    return tmpEnemies;
  }

  /** Damages an enemy; `dmg` already includes might/weapon bonus. slot -1 = environment. */
  hurtEnemy(e: Enemy, dmg: number, slot: number, kx: number, ky: number, canCrit = true): void {
    if (!e.alive) return;
    let amount = dmg;
    let crit = 0;
    if (canCrit && this.rng.next() < this.stats.crit) {
      amount *= this.stats.critMult;
      crit = 1;
    }
    e.sinceHit = 0;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
      this.events.push(EV.SHIELD_HIT, e.x, e.y, absorbed, e.shield <= 0 ? 1 : 0, e.r);
      if (amount <= 0) {
        e.flash = 0.05;
        return;
      }
    }
    e.hp -= amount;
    e.flash = 0.09;
    const resist = 1 - e.def.mass;
    if (resist > 0) {
      e.kx += kx * resist;
      e.ky += ky * resist;
    }
    if (slot >= 0) {
      const id = this.weapons[slot]?.id;
      if (id) this.run.damageBy[id] = (this.run.damageBy[id] ?? 0) + Math.min(amount, amount + e.hp);
    }
    this.events.push(EV.HIT, e.x, e.y - e.r, amount, crit, e.def.boss ? 1 : 0);
    if (e.hp <= 0) this.killEnemy(e);
  }

  hurtPlayer(amount: number, sx: number, sy: number): void {
    const p = this.player;
    if (p.inv > 0 || this.state !== 'playing') return;
    const dmg = Math.max(1, amount - this.stats.armor);
    p.hp -= dmg;
    p.inv = BALANCE.player.invulnAfterHit;
    this.run.damageTaken += dmg;
    this.run.maxNoHit = Math.max(this.run.maxNoHit, p.noHitT);
    p.noHitT = 0;
    this.events.push(EV.PLAYER_HIT, p.x, p.y, dmg, Math.atan2(p.y - sy, p.x - sx));
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'dead';
    }
  }

  killEnemy(e: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
    const def = e.def;
    if (!e.noReward) {
      this.run.kills++;
      this.run.killsBy[def.id] = (this.run.killsBy[def.id] ?? 0) + 1;
      if (e.elite) this.run.elites++;
    }
    const flags = (e.elite ? 1 : 0) | (def.boss === 'mini' ? 2 : 0) | (def.boss === 'final' ? 4 : 0);
    this.events.push(EV.KILL, e.x, e.y, def.color, e.r, flags, def.id);
    if (def.splitInto && !e.noReward) {
      for (let i = 0; i < def.splitInto.count; i++) {
        const a = (i / def.splitInto.count) * Math.PI * 2 + this.rng.next();
        this.spawnQueue.push({ id: def.splitInto.id, x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, elite: false });
      }
      this.events.push(EV.SPLIT, e.x, e.y, def.color);
    }
    if (e.noReward) return;
    if (def.boss) {
      const bi = this.bosses.indexOf(e);
      if (bi >= 0) this.bosses.splice(bi, 1);
      if (def.boss === 'mini') {
        this.run.miniBosses++;
        this.dropGem(e.x, e.y, GEM_CHEST, 1);
        this.dropGem(e.x + 30, e.y, GEM_HEAL, 0);
      } else {
        this.run.bossKills++;
        if (this.boss === e) this.boss = null;
        if (this.mode === 'normal') {
          this.state = 'won';
        } else {
          this.dropGem(e.x, e.y, GEM_CHEST, 1);
        }
      }
      this.scatterXp(e.x, e.y, def.xp * this.sector.xpMult, 14);
      return;
    }
    const xp = e.xp * this.sector.xpMult;
    if (e.elite) {
      this.scatterXp(e.x, e.y, xp, 5);
      if (this.rng.chance(0.18)) this.dropGem(e.x, e.y, GEM_HEAL, 0);
      return;
    }
    const luck = this.stats.luck;
    if (this.rng.chance(BALANCE.healDropChance * luck)) this.dropGem(e.x, e.y, GEM_HEAL, 0);
    else if (this.rng.chance(BALANCE.magnetDropChance * luck) && this.magnetT <= 0) {
      this.dropGem(e.x, e.y, GEM_MAGNET, 0);
      this.magnetT = 25;
    } else if (this.rng.chance(BALANCE.gemDropChance)) this.dropGem(e.x, e.y, GEM_XP, xp);
  }

  private scatterXp(x: number, y: number, total: number, pieces: number): void {
    const each = total / pieces;
    for (let i = 0; i < pieces; i++) {
      const g = this.dropGem(x, y, GEM_XP, each);
      const a = this.rng.angle();
      const s = this.rng.range(80, 220);
      g.vx = Math.cos(a) * s;
      g.vy = Math.sin(a) * s;
    }
  }

  dropGem(x: number, y: number, kind: number, value: number): Gem {
    if (kind === GEM_XP && this.gems.length >= BALANCE.maxGems) {
      // fuse into the nearest crystal instead of growing the list (keeps XP close to the action)
      let best: Gem | null = null;
      let bd = Infinity;
      for (const g of this.gems) {
        if (!g.alive || g.kind !== GEM_XP || g.pulled) continue;
        const d = (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
      if (best) {
        best.value += value;
        best.tier = gemTier(best.value);
        return best;
      }
    }
    const g = this.gemPool.get();
    g.alive = true;
    g.x = x;
    g.y = y;
    g.vx = 0;
    g.vy = 0;
    g.kind = kind;
    g.value = value;
    g.tier = kind === GEM_XP ? gemTier(value) : 0;
    g.pulled = false;
    g.t = 0;
    this.gems.push(g);
    return g;
  }

  spawnEnemy(id: EnemyId, x: number, y: number, elite = false): Enemy {
    const def: EnemyDef = ENEMIES[id];
    const e = this.enemyPool.get();
    e.uid = this.uidSeq++;
    e.def = def;
    e.alive = true;
    e.x = x;
    e.y = y;
    e.kx = 0;
    e.ky = 0;
    const levelMult = 1 + BALANCE.hpPerLevel * (this.player.level - 1);
    // bosses follow the same time curve as the swarm (and a softer level curve)
    const hpMult = def.boss ? this.wave.hpMult * Math.sqrt(levelMult) : this.wave.hpMult * levelMult;
    e.elite = elite && !def.boss;
    e.maxHp = def.hp * hpMult * (e.elite ? BALANCE.eliteHpMult : 1);
    e.hp = e.maxHp;
    e.maxShield = (def.shield ?? 0) * e.maxHp;
    e.shield = e.maxShield;
    e.sinceHit = 99;
    e.r = def.r * (e.elite ? BALANCE.eliteScale : 1);
    const ot = this.overtime();
    const overtime = ot >= 0;
    const speedGrowth = (1 + BALANCE.speedGrowth * Math.min(this.t / 60, 16)) * (overtime && !def.boss ? 1.6 : 1);
    e.speed = def.speed * this.sector.speedMult * speedGrowth * (def.boss ? 1 : this.rng.range(0.9, 1.1)) * (e.elite ? 0.9 : 1);
    e.dmg = def.dmg * this.wave.dmgMult * (e.elite ? 1.5 : 1) * (overtime && !def.boss ? 1 + BALANCE.overtimeDmgPerMin * ot : 1);
    e.xp = def.xp * (e.elite ? BALANCE.eliteXpMult : 1);
    e.flash = 0;
    e.spawnT = 0;
    e.ang = Math.atan2(this.player.y - y, this.player.x - x);
    e.spin = this.rng.range(-2, 2);
    e.alpha = 1;
    e.state = 0;
    e.t = this.rng.range(0, 1);
    e.t2 = 0;
    e.tx = 0;
    e.ty = 0;
    e.aux = 0;
    e.age = 0;
    e.slow = 0;
    e.noReward = false;
    e.hitT.fill(-99);
    this.enemies.push(e);
    this.seen.add(id);
    if (def.boss) {
      this.bosses.push(e);
      if (def.boss === 'final') this.boss = e;
      this.events.push(EV.BOSS, x, y, def.boss === 'final' ? 1 : 0, 0, 0, id);
    }
    return e;
  }

  /**
   * Picks a spawn point just outside the screen. The more persistently the player runs in one
   * direction, the more spawns land ahead of them, so running away is never a safe strategy.
   * `ahead` forces a point in front of the player whenever they are moving.
   */
  spawnPoint(out: { x: number; y: number }, margin = 50, ahead = false): void {
    const hw = this.view.hw + margin;
    const hh = this.view.hh + margin;
    const p = this.player;
    const drift = Math.hypot(this.driftX, this.driftY);
    const f = Math.min(1, drift / (BALANCE.player.baseSpeed * 0.7));
    // squared: ordinary dodging barely counts, holding one direction counts fully
    if ((ahead && f > 0.5) || this.rng.next() < f * f * BALANCE.aheadSpawnBias) {
      const a = Math.atan2(this.driftY, this.driftX) + this.rng.range(-0.85, 0.85);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(sn)));
      out.x = p.x + c * k;
      out.y = p.y + sn * k;
      return;
    }
    const per = hw * 2 + hh * 2;
    let r = this.rng.next() * per;
    if (r < hw * 2) {
      out.x = p.x - hw + r;
      out.y = p.y + (this.rng.next() < 0.5 ? -hh : hh);
    } else {
      r -= hw * 2;
      out.y = p.y - hh + (r % (hh * 2));
      out.x = p.x + (r < hh * 2 ? -hw : hw);
    }
  }

  fireEnemyBullet(x: number, y: number, ang: number, speed: number, dmg: number, color: number, r = 7): void {
    const b = this.ebulletPool.get();
    b.alive = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.dmg = dmg * this.sector.dmgMult;
    b.r = r;
    b.life = 7;
    b.color = color;
    this.ebullets.push(b);
  }

  addRing(x: number, y: number, maxR: number, dur: number, slot: number, dmg: number, knock: number, color: number, cosmetic: boolean, slow = 0): Ring {
    const g = this.ringPool.get();
    g.alive = true;
    g.x = x;
    g.y = y;
    g.r = 0;
    g.maxR = maxR;
    g.t = 0;
    g.dur = dur;
    g.slot = slot;
    g.dmg = dmg;
    g.knock = knock;
    g.color = color;
    g.cosmetic = cosmetic;
    g.slow = slow;
    g.hits.length = 0;
    this.rings.push(g);
    return g;
  }

  /** Area damage helper used by mines, missiles, bombers. */
  explode(x: number, y: number, radius: number, dmg: number, slot: number, knock: number, color: number): void {
    const list = this.enemiesInRadius(x, y, radius);
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.hurtEnemy(e, dmg, slot, (dx / d) * knock, (dy / d) * knock);
    }
    this.events.push(EV.EXPLODE, x, y, radius, color);
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.events.clear();
    if (this.state !== 'playing') return;
    this.t += dt;
    this.magnetT -= dt;
    this.updatePlayer(dt);
    this.updateDirector(dt);
    this.updateEnemies(dt);
    updateWeapons(this, dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updateRings(dt);
    this.updateGems(dt);
    this.flushSpawnQueue();
    this.compact();
    if (this.state === 'playing' && this.pendingLevels > 0) this.openChoice();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const sp = BALANCE.player.baseSpeed * this.stats.speed;
    let ix = this.input.x;
    let iy = this.input.y;
    const il = Math.hypot(ix, iy);
    if (il > 1) {
      ix /= il;
      iy /= il;
    }
    const k = damp(il > 0.05 ? 16 : 12, dt);
    p.vx += (ix * sp - p.vx) * k;
    p.vy += (iy * sp - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const kd = damp(1 / 2.5, dt);
    this.driftX += (p.vx - this.driftX) * kd;
    this.driftY += (p.vy - this.driftY) * kd;
    p.moving = il > 0.05;
    if (p.moving) p.face = Math.atan2(iy, ix);
    if (p.inv > 0) p.inv -= dt;
    p.noHitT += dt;
    if (p.noHitT > this.run.maxNoHit) this.run.maxNoHit = p.noHitT;
    if (this.stats.regen > 0 && p.hp < this.stats.maxHp) {
      p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.regen * dt);
    }
  }

  private updateDirector(dt: number): void {
    this.wave = waveStateAt(this.t, this.mode, this.sector);
    const w = this.wave;
    let regular = 0;
    for (const e of this.enemies) if (!e.def.boss) regular++;
    // the swarm holds back while a boss makes its entrance (not for the whole fight, or
    // kiting a boss would become the safest way to play)
    let bossFactor = 1;
    for (const b of this.bosses) if (b.age < BALANCE.bossCalmTime) bossFactor = BALANCE.bossSpawnFactor;
    // overtime: the Chaos Core has been up too long in normal mode — the swarm stops holding back
    // and keeps escalating every minute until the run ends one way or the other
    const ot = this.overtime();
    const overtime = ot >= 0;
    const min = overtime ? w.min * (2.5 + 1.5 * ot) : w.min * bossFactor;
    if (regular < min) this.spawnAcc += (min - regular) * dt * 2.5;
    if (overtime || regular < min * BALANCE.overflowCap) this.spawnAcc += w.rate * (overtime ? 3 : bossFactor) * dt;
    const pt = { x: 0, y: 0 };
    let guard = 0;
    while (this.spawnAcc >= 1 && guard++ < 40) {
      this.spawnAcc -= 1;
      if (this.enemies.length >= BALANCE.maxEnemies) {
        this.spawnAcc = 0;
        break;
      }
      const rw = this.rosterWeights;
      rw.length = w.roster.length;
      for (let k = 0; k < w.roster.length; k++) rw[k] = w.roster[k][1];
      const i = this.rng.weighted(rw);
      if (i < 0) break;
      this.spawnPoint(pt);
      this.spawnEnemy(w.roster[i][0], pt.x, pt.y, this.rng.chance(w.elite));
    }
    for (const ev of eventsBetween(this.prevT, this.t, this.mode, this.evScratch)) this.runEvent(ev);
    this.prevT = this.t;
  }

  /** Minutes of overtime in normal mode (negative before it starts). */
  overtime(): number {
    if (this.mode !== 'normal') return -1;
    return (this.t - BALANCE.bossTime - BALANCE.overtimeAfter) / 60;
  }

  private runEvent(ev: WaveEvent): void {
    const p = this.player;
    const pt = { x: 0, y: 0 };
    switch (ev.type) {
      case 'miniboss':
      case 'boss': {
        this.spawnPoint(pt, 80, true);
        this.spawnEnemy(ev.enemy, pt.x, pt.y);
        break;
      }
      case 'ring': {
        const rad = Math.max(this.view.hw, this.view.hh) * 0.9 + 60;
        for (let i = 0; i < ev.count; i++) {
          const a = (i / ev.count) * Math.PI * 2;
          this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
        }
        this.events.push(EV.WARN, p.x, p.y, 0);
        break;
      }
      case 'rush': {
        const a = this.rng.angle();
        const dist = Math.max(this.view.hw, this.view.hh) + 80;
        const cx = p.x + Math.cos(a) * dist;
        const cy = p.y + Math.sin(a) * dist;
        for (let i = 0; i < ev.count; i++) {
          const e = this.spawnEnemy(ev.enemy, cx + this.rng.range(-90, 90), cy + this.rng.range(-90, 90));
          e.speed *= 1.25;
        }
        this.events.push(EV.WARN, cx, cy, 1, a);
        break;
      }
      case 'swarm': {
        this.spawnPoint(pt, 40);
        for (let i = 0; i < ev.count; i++) {
          this.spawnEnemy(ev.enemy, pt.x + this.rng.range(-50, 50), pt.y + this.rng.range(-50, 50));
        }
        break;
      }
    }
  }

  /** Jumps the run clock without replaying scripted events (test / screenshot helper). */
  skipTo(t: number): void {
    this.t = t;
    this.prevT = t;
    this.wave = waveStateAt(t, this.mode, this.sector);
  }

  queueSpawn(id: EnemyId, x: number, y: number, elite = false): void {
    this.spawnQueue.push({ id, x, y, elite });
  }

  private flushSpawnQueue(): void {
    for (const s of this.spawnQueue) {
      if (this.enemies.length >= BALANCE.maxEnemies + 40) break;
      const e = this.spawnEnemy(s.id, s.x, s.y, s.elite);
      e.spawnT = 0.6;
      const a = Math.atan2(s.y - this.player.y, s.x - this.player.x) + this.rng.range(-1, 1);
      e.kx = Math.cos(a) * 140;
      e.ky = Math.sin(a) * 140;
    }
    this.spawnQueue.length = 0;
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const grid = this.grid;
    grid.clear();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.spawnT < 1) e.spawnT = Math.min(1, e.spawnT + dt * 3);
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.slow > 0) e.slow -= dt;
      updateEnemy(this, e, dt);
      // knockback decay
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      const kd = Math.exp(-9 * dt);
      e.kx *= kd;
      e.ky *= kd;
      if (e.maxShield > 0 && e.shield < e.maxShield) {
        e.sinceHit += dt;
        const rd = e.def.p?.regenDelay ?? 3;
        if (e.sinceHit > rd) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * (e.def.p?.regenRate ?? 0.2) * dt);
      }
      // stragglers left far behind are moved back in front of the player; bosses are leashed
      // the same way (further out), so outrunning a boss only brings it back ahead of you
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const far = Math.max(this.view.hw, this.view.hh) * (e.def.boss ? 1.9 : 1.6) + (e.def.boss ? 260 : 160);
      if (dx * dx + dy * dy > far * far) {
        const pt = respawnPt;
        this.spawnPoint(pt, e.def.boss ? e.r + 40 : 50, true);
        if (e.def.boss) this.events.push(EV.TELEPORT, e.x, e.y, pt.x, pt.y, e.def.color);
        e.x = pt.x;
        e.y = pt.y;
        e.kx = e.ky = 0;
      }
      grid.insert(e);
    }
    // soft separation (each enemy every other frame) + contact damage
    const near = sepNear;
    const parity = this.frame++ & 1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dxp = p.x - e.x;
      const dyp = p.y - e.y;
      const rr = p.r + e.r * 0.85;
      if (dxp * dxp + dyp * dyp < rr * rr && e.spawnT > 0.6) this.hurtPlayer(e.dmg, e.x, e.y);
      if (e.def.boss || (e.uid & 1) !== parity) continue;
      grid.query(e.x, e.y, e.r * 2, near);
      let n = 0;
      for (let i = 0; i < near.length && n < 6; i++) {
        const o = near[i];
        if (o === e || !o.alive) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const min = (e.r + o.r) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.6;
          const wE = o.def.boss ? 1 : 0.5;
          e.x += dx * push * wE * 2;
          e.y += dy * push * wE * 2;
          n++;
        }
      }
    }
  }

  private updateBullets(dt: number): void {
    const near = bulletNear;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.life -= dt;
      if (b.life <= 0) {
        if (b.aoe > 0 && b.turn > 0) this.explode(b.x, b.y, b.aoe, b.dmg, b.slot, b.knock, 0xff9a3d);
        b.alive = false;
        continue;
      }
      if (b.turn > 0) {
        if (!b.target || !b.target.alive) b.target = this.nearestEnemy(b.x, b.y, 520);
        if (b.target) {
          const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const step = Math.max(-b.turn * dt, Math.min(b.turn * dt, d));
          const na = cur + step;
          b.vx = Math.cos(na) * b.speed;
          b.vy = Math.sin(na) * b.speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.grid.query(b.x, b.y, b.r, near);
      for (let i = 0; i < near.length; i++) {
        const e = near[i];
        if (!e.alive || e.spawnT < 0.3) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (b.hits.includes(e.uid)) continue;
        b.hits.push(e.uid);
        const sp = Math.hypot(b.vx, b.vy) || 1;
        if (b.aoe > 0) {
          this.explode(b.x, b.y, b.aoe, b.dmg * (b.turn > 0 ? 1 : 0.5), b.slot, b.knock, b.turn > 0 ? 0xff9a3d : 0x5ff2ff);
          if (b.turn > 0) {
            b.alive = false;
            break;
          }
        }
        this.hurtEnemy(e, b.dmg, b.slot, (b.vx / sp) * b.knock, (b.vy / sp) * b.knock);
        b.pierce--;
        if (b.pierce < 0) {
          b.alive = false;
          break;
        }
      }
    }
  }

  private updateEnemyBullets(dt: number): void {
    const p = this.player;
    for (const b of this.ebullets) {
      if (!b.alive) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0) {
        b.alive = false;
        continue;
      }
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const rr = b.r + p.r * 0.8;
      if (dx * dx + dy * dy < rr * rr) {
        if (p.inv <= 0) {
          this.hurtPlayer(b.dmg, b.x, b.y);
          b.alive = false;
        }
      }
    }
  }

  private updateRings(dt: number): void {
    for (const g of this.rings) {
      if (!g.alive) continue;
      g.t += dt;
      const f = Math.min(1, g.t / g.dur);
      const prevR = g.r;
      g.r = g.maxR * (1 - (1 - f) * (1 - f));
      if (!g.cosmetic) {
        const list = this.enemiesInRadius(g.x, g.y, g.r);
        for (let i = list.length - 1; i >= 0; i--) {
          const e = list[i];
          if (g.hits.includes(e.uid)) continue;
          const dx = e.x - g.x;
          const dy = e.y - g.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d + e.r < prevR - 30) continue; // was inside before the wave started
          g.hits.push(e.uid);
          if (g.slow > 0) e.slow = Math.max(e.slow, g.slow);
          this.hurtEnemy(e, g.dmg, g.slot, (dx / d) * g.knock, (dy / d) * g.knock);
        }
      }
      if (f >= 1) g.alive = false;
    }
  }

  private updateGems(dt: number): void {
    const p = this.player;
    const magnetR = BALANCE.player.baseMagnet * this.stats.magnet;
    const m2 = magnetR * magnetR;
    const pickR = p.r + 10;
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.t += dt;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.pulled && d2 < (g.kind === GEM_CHEST ? (pickR + 20) * (pickR + 20) : m2) && g.t > 0.25) g.pulled = true;
      if (g.pulled) {
        const d = Math.sqrt(d2) || 1;
        const speed = 260 + g.t * 120 + (g.kind === GEM_XP ? 0 : 100);
        const k = damp(10, dt);
        g.vx += ((dx / d) * speed - g.vx) * k;
        g.vy += ((dy / d) * speed - g.vy) * k;
      } else {
        const fr = Math.exp(-5 * dt);
        g.vx *= fr;
        g.vy *= fr;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d2 < pickR * pickR) {
        g.alive = false;
        this.collectGem(g);
      }
    }
  }

  private collectGem(g: Gem): void {
    const p = this.player;
    switch (g.kind) {
      case GEM_XP: {
        this.run.gems++;
        p.xp += g.value * this.stats.growth;
        this.events.push(EV.GEM, g.x, g.y, g.tier);
        while (p.xp >= p.xpNext) {
          p.xp -= p.xpNext;
          p.level++;
          p.xpNext = xpForLevel(p.level);
          this.pendingLevels++;
          this.events.push(EV.LEVELUP, p.x, p.y, p.level);
        }
        break;
      }
      case GEM_HEAL:
        this.heal(this.stats.maxHp * BALANCE.healAmount);
        this.events.push(EV.PICKUP, g.x, g.y, 1);
        break;
      case GEM_MAGNET:
        for (const o of this.gems) if (o.alive && o.kind === GEM_XP) o.pulled = true;
        this.events.push(EV.MAGNET, g.x, g.y);
        break;
      case GEM_CHEST: {
        this.run.chests++;
        this.run.bitsBonus += 15;
        const evos = availableEvolutions(this.loadout());
        this.events.push(EV.CHEST, g.x, g.y, evos.length > 0 ? 1 : 0);
        if (evos.length > 0) this.evolve(evos[0]);
        else {
          this.pendingLevels++;
          this.chestChoice = true;
        }
        break;
      }
    }
  }

  private compact(): void {
    compactList(this.enemies, this.enemyPool);
    compactList(this.bullets, this.bulletPool);
    compactList(this.ebullets, this.ebulletPool);
    compactList(this.gems, this.gemPool);
    compactList(this.mines, this.minePool);
    compactList(this.rings, this.ringPool);
  }

  /** Bits earned for this run (before ad doubling). */
  computeBits(won: boolean): number {
    const b = BALANCE.bits;
    const mins = this.t / 60;
    const raw =
      mins * b.perMinute +
      this.run.kills * b.perKill +
      this.player.level * b.perLevel +
      this.run.miniBosses * b.perMiniBoss +
      (won ? b.win : 0);
    return Math.round((raw * this.sector.bitsMult + this.run.bitsBonus) * this.stats.greed);
  }

  weaponDef(id: WeaponId) {
    return WEAPONS[id];
  }
}

export function gemTier(v: number): number {
  return v < 3 ? 0 : v < 12 ? 1 : v < 40 ? 2 : 3;
}

function compactList<T extends { alive: boolean }>(list: T[], pool: Pool<T>): void {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.alive) list[n++] = o;
    else pool.release(o);
  }
  list.length = n;
}
