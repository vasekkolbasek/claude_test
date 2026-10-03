import { Emitter } from '../core/events';
import { Polyline, clamp, dist2 } from '../core/math';
import { Rng } from '../core/rng';
import { SpatialGrid } from '../core/grid';
import { CONFIG } from '../data/config';
import { BNODES, BUILD_RADIUS, ECONOMIC, type BNode, type ProjKind } from '../data/buildings';
import { MAPS, type MapDef, type MapId } from '../data/maps';
import type { MutatorId, PerkId } from '../data/perks';
import { UNITS, type EnemyId, type UnitDef } from '../data/units';
import { WEAPONS, type AbilityId, type WeaponId } from '../data/weapons';
import { Building, Hero, Projectile, Unit, type Ent } from '../entities/entities';
import { computeMods, type Mods } from './modifiers';
import { Heightfield } from './terrain';
import { generateWave, spawnSchedule, type WavePlan } from './waves';
import { updateUnits } from './ai';
import { updateCombat, updateHero } from './combat';

export type Phase = 'day' | 'night' | 'dawn' | 'victory' | 'defeat';
/** hold = guard the default posts, charge = run at the nearest enemies. */
export type TroopMode = 'hold' | 'charge';

export interface RunStats {
  kills: number;
  heroKills: number;
  lost: number;
  built: number;
  cleanStreak: number;
  bestClean: number;
  maxIncome: number;
  abilityUses: number;
  bossKills: number;
  maxArmy: number;
  maxCoins: number;
  fullUpgrades: number;
  castleMinHp: number;
}

export interface RunSnapshot {
  map: MapId;
  weapon: WeaponId;
  perks: PerkId[];
  mutators: MutatorId[];
  endless: boolean;
  seed: number;
  night: number;
  coins: number;
  nodes: Record<string, string>;
  stats: RunStats;
  secondChanceUsed: boolean;
}

export interface RunConfig {
  map: MapId;
  weapon: WeaponId;
  perks: PerkId[];
  mutators: MutatorId[];
  endless: boolean;
  seed: number;
  snapshot?: RunSnapshot | null;
}

export interface ControlState {
  moveX: number;
  moveZ: number;
  hold: boolean;
  ability: boolean;
  rally: boolean;
  startNight: boolean;
}

export interface GameEvents {
  phase: { phase: Phase; night: number };
  built: { b: Building; upgrade: boolean };
  coinIn: { b: Building };
  holdCancel: { b: Building };
  choice: { b: Building; options: BNode[] };
  shoot: { p: Projectile };
  impact: { x: number; z: number; kind: ProjKind; splash: number };
  hit: { e: Ent; dmg: number };
  death: { u: Unit };
  bdestroyed: { b: Building };
  melee: { x: number; z: number; team: 0 | 1 };
  heroDeath: Record<string, never>;
  heroRespawn: Record<string, never>;
  ability: { kind: AbilityId; x: number; z: number; r: number };
  income: { total: number; parts: { b: Building; n: number }[]; clean: boolean; bonus: number };
  spawn: { u: Unit };
  bossSpawn: { u: Unit };
  rally: { mode: TroopMode };
  troopSpawn: { u: Unit };
  nightStart: { night: number };
  repaired: { b: Building };
}

export const emptyStats = (): RunStats => ({
  kills: 0, heroKills: 0, lost: 0, built: 0, cleanStreak: 0, bestClean: 0, maxIncome: 0,
  abilityUses: 0, bossKills: 0, maxArmy: 0, maxCoins: 0, fullUpgrades: 0, castleMinHp: 1,
});

export class Game {
  readonly map: MapDef;
  readonly hf: Heightfield;
  readonly paths: Polyline[];
  readonly events = new Emitter<GameEvents>();
  readonly rng: Rng;
  readonly mods: Mods;
  readonly hero: Hero;
  readonly buildings: Building[] = [];
  readonly bySlot = new Map<string, Building>();
  readonly castle: Building;
  readonly walls: Building[] = [];
  readonly units: Unit[] = [];
  readonly projectiles: Projectile[] = [];
  readonly enemyGrid = new SpatialGrid<Unit>(4);
  readonly allyGrid = new SpatialGrid<Unit>(4);
  private unitPool: Unit[] = [];
  private projPool: Projectile[] = [];

  phase: Phase = 'day';
  phaseTime = 0;
  time = 0;
  night = 1;
  coins = 0;
  /** Coins already committed to an in-progress hold. */
  holdCoins = 0;
  hold: { b: Building; t: number; need: number; cost: number } | null = null;
  /** After a purchase the button must be released before the next one. */
  private holdLock = false;
  choice: { b: Building; options: BNode[]; cost: number } | null = null;
  plan: WavePlan;
  private spawnQueue: { t: number; unit: EnemyId; path: number }[] = [];
  nightTime = 0;
  troopMode: TroopMode = 'hold';
  secondChanceUsed = false;
  stats: RunStats = emptyStats();
  lastIncome: { total: number; clean: boolean } | null = null;
  readonly input: ControlState = { moveX: 0, moveZ: 0, hold: false, ability: false, rally: false, startNight: false };
  timeScale = 1;
  paused = false;
  enemiesAlive = 0;
  bossUnit: Unit | null = null;

  constructor(readonly cfg: RunConfig) {
    this.map = MAPS[cfg.map];
    this.rng = new Rng(cfg.seed);
    this.hf = new Heightfield(this.map);
    this.paths = this.map.paths.map((p) => new Polyline(p));
    this.mods = computeMods(cfg.perks, cfg.mutators);
    this.hero = new Hero(WEAPONS[cfg.weapon]);

    for (const slot of this.map.slots) {
      let x = slot.x ?? 0, z = slot.z ?? 0;
      let wall: Building['wall'] = null;
      if (slot.kind === 'wall') {
        const line = this.paths[slot.path!];
        const p = line.sample(line.length * slot.at!, { x: 0, z: 0, tx: 0, tz: 0 });
        x = p.x; z = p.z;
        const nx = -p.tz, nz = p.tx; // normal
        const half = 3.2;
        wall = { ax: x - nx * half, az: z - nz * half, bx: x + nx * half, bz: z + nz * half, rot: Math.atan2(p.tx, p.tz) };
      }
      const b = new Building(slot, x, z, BUILD_RADIUS[slot.kind]);
      b.wall = wall;
      this.setDefaultRally(b);
      this.buildings.push(b);
      this.bySlot.set(slot.id, b);
      if (wall) this.walls.push(b);
    }
    this.castle = this.bySlot.get('castle')!;
    this.applyNode(this.castle, BNODES.castle, false);
    this.coins = this.map.startCoins + this.mods.startCoins;

    const snap = cfg.snapshot;
    if (snap) {
      this.night = snap.night;
      this.coins = snap.coins;
      this.stats = { ...emptyStats(), ...snap.stats };
      this.secondChanceUsed = snap.secondChanceUsed;
      for (const [slotId, nodeId] of Object.entries(snap.nodes)) {
        const b = this.bySlot.get(slotId);
        const node = BNODES[nodeId];
        if (b && node && node.kind === b.kind) this.applyNode(b, node, false, true);
      }
    }
    this.hero.maxHp = Math.round(CONFIG.hero.hp * this.mods.heroHp);
    this.hero.hp = this.hero.maxHp;
    this.hero.speed = CONFIG.hero.speed * this.mods.heroSpeed;
    this.hero.radius = CONFIG.hero.radius;
    this.placeHeroAtCastle();
    this.plan = this.makePlan();
    this.recomputeAuras();
  }

  // ---------------------------------------------------------------- helpers
  makePlan(): WavePlan { return generateWave(this.map, this.night, this.cfg.seed, this.cfg.endless); }
  get totalNights(): number { return this.cfg.endless ? Infinity : this.map.nights; }
  get nightsSurvived(): number { return this.phase === 'victory' ? this.map.nights : this.night - 1; }

  heightAt(x: number, z: number): number { return this.hf.height(x, z); }

  placeHeroAtCastle(): void {
    this.hero.x = 3.2;
    this.hero.z = 5.2;
    this.hero.facing = 0;
  }

  setDefaultRally(b: Building): void {
    // Troops gather between the building and the closest path.
    let best = { d2: Infinity, x: b.x, z: b.z };
    for (const p of this.paths) {
      const pr = p.project(b.x, b.z);
      if (pr.d2 < best.d2) {
        const pt = p.sample(pr.s, { x: 0, z: 0, tx: 0, tz: 0 });
        best = { d2: pr.d2, x: pt.x, z: pt.z };
      }
    }
    const d = Math.sqrt(best.d2) || 1;
    const k = Math.min(1, (b.radius + 1.6) / d);
    b.rallyX = b.x + (best.x - b.x) * k;
    b.rallyZ = b.z + (best.z - b.z) * k;
  }

  nodeCost(node: BNode): number {
    let c = node.cost;
    if (node.kind === 'tower' || node.kind === 'magic') c = Math.max(1, Math.round(c * this.mods.towerCost));
    return c;
  }

  /** What the hero can do at this building right now (null = nothing). */
  actionFor(b: Building): { cost: number; options: BNode[] } | null {
    if (b.kind === 'wall' && this.mods.noWalls) return null;
    if (!b.node) {
      const n = BNODES[b.kind];
      return { cost: this.nodeCost(n), options: [n] };
    }
    if (b.ruined || !b.node.next.length) return null;
    const options = b.node.next.map((id) => BNODES[id]);
    return { cost: Math.max(...options.map((o) => this.nodeCost(o))), options };
  }

  /** Closest building the hero stands at that has an available action. */
  activeSlot(): Building | null {
    if (this.phase !== 'day' || !this.hero.alive || this.choice) return null;
    let best: Building | null = null;
    let bd = Infinity;
    for (const b of this.buildings) {
      const r = b.radius + CONFIG.hero.buildRadius;
      const d2 = dist2(b.x, b.z, this.hero.x, this.hero.z);
      if (d2 > r * r || d2 >= bd) continue;
      if (!this.actionFor(b)) continue;
      bd = d2;
      best = b;
    }
    return best;
  }

  // ---------------------------------------------------------------- buildings
  applyNode(b: Building, node: BNode, emit = true, restoring = false): void {
    const upgrade = b.node !== null;
    b.node = node;
    b.ruined = false;
    let hp = node.stats.hp;
    if (b.kind === 'wall') hp *= this.mods.wallHp;
    if (b.kind === 'castle') hp *= this.mods.castleHp;
    b.maxHp = Math.round(hp);
    b.hp = b.maxHp;
    b.builtT = restoring ? 99 : 0;
    this.syncTroops(b, true);
    this.recomputeAuras();
    if (node.tier === 2 && !restoring) this.stats.fullUpgrades++;
    if (emit) {
      this.stats.built++;
      this.events.emit('built', { b, upgrade });
    }
  }

  recomputeAuras(): void {
    const m = this.mods;
    m.dmgTroops = 0; m.dmgTowers = 0; m.dmgHero = 0; m.hpTroops = 0;
    for (const b of this.buildings) {
      if (!b.alive || b.kind !== 'forge') continue;
      const s = b.node!.stats;
      m.dmgTroops += s.buffTroops ?? 0;
      m.dmgTowers += s.buffTowers ?? 0;
      m.dmgHero += s.buffHero ?? 0;
      m.hpTroops += s.hpTroops ?? 0;
    }
  }

  /** Make sure a troop building has its full squad (used on build and at dawn). */
  syncTroops(b: Building, replaceType: boolean, limit = 99): void {
    const tr = b.node?.stats.troops;
    if (!tr) return;
    const def = UNITS[tr.unit];
    const want = tr.count + this.mods.extraTroops;
    if (replaceType) {
      for (const u of b.troops) if (u.def.id !== def.id) { u.alive = false; u.hp = 0; }
    }
    b.troops = b.troops.filter((u) => u.alive);
    // Refresh stats of survivors (upgrades may change hp).
    for (const u of b.troops) this.initAlly(u, def, b, u.slotIdx, false);
    const used = new Set(b.troops.map((u) => u.slotIdx));
    let added = 0;
    for (let i = 0; b.troops.length < want && i < 12 && added < limit; i++) {
      if (used.has(i)) continue;
      added++;
      const u = this.allocUnit();
      this.initAlly(u, def, b, i, true);
      b.troops.push(u);
      this.units.push(u);
      used.add(i);
    }
    this.stats.maxArmy = Math.max(this.stats.maxArmy, this.armySize());
  }

  armySize(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.team === 0) n++;
    return n;
  }

  private initAlly(u: Unit, def: UnitDef, b: Building, idx: number, fresh: boolean): void {
    const hpMul = 1 + this.mods.hpTroops + (b.node?.stats.hpTroops ?? 0);
    u.def = def;
    u.team = 0;
    u.owner = b;
    u.slotIdx = idx;
    u.radius = def.radius;
    u.maxHp = Math.round(def.hp * hpMul);
    u.speed = def.speed;
    u.damage = def.damage;
    u.onHitBurn = b.node?.stats.troopBurn ?? 0;
    if (fresh) {
      u.alive = true;
      u.hp = u.maxHp;
      const a = (idx / 6) * Math.PI * 2;
      u.x = b.x + Math.cos(a) * (b.radius + 0.6);
      u.z = b.z + Math.sin(a) * (b.radius + 0.6);
      u.target = null;
      u.atkCd = 0;
      u.think = Math.random() * 0.3;
      u.slowT = 0; u.burnT = 0;
      u.age = 0;
    } else u.hp = Math.min(u.maxHp, Math.max(u.hp, u.maxHp));
    const off = formation(idx);
    u.holdX = b.rallyX + off.x;
    u.holdZ = b.rallyZ + off.z;
  }

  allocUnit(): Unit {
    const u = this.unitPool.pop() ?? new Unit();
    u.alive = true;
    u.target = null;
    u.owner = null;
    u.attackT = 9; u.hitT = 9; u.age = 0; u.summonT = 0;
    u.slowT = 0; u.burnT = 0; u.bumpX = 0; u.bumpZ = 0;
    return u;
  }

  allocProjectile(): Projectile {
    const p = this.projPool.pop() ?? new Projectile();
    p.alive = true;
    p.hits.length = 0;
    p.target = null;
    p.splash = 0; p.pierce = 0; p.slow = 0; p.burn = 0; p.armorPierce = false; p.bonusVsBig = 1; p.bldMul = 1;
    p.traveled = 0; p.heal = 0; p.fromHero = false; p.delay = 0; p.arc = 1; p.h0 = 1;
    this.projectiles.push(p);
    return p;
  }

  spawnEnemy(id: EnemyId, path: number, s = 0, lat?: number): Unit {
    const def = UNITS[id];
    const u = this.allocUnit();
    u.def = def;
    u.team = 1;
    u.path = path;
    u.s = s;
    u.lat = lat ?? this.rng.range(-1.4, 1.4) * (def.big ? 0.4 : 1);
    const p = this.paths[path].sample(s, { x: 0, z: 0, tx: 0, tz: 0 });
    u.x = p.x - p.tz * u.lat;
    u.z = p.z + p.tx * u.lat;
    u.facing = Math.atan2(p.tx, p.tz);
    u.maxHp = Math.round(def.hp * this.mods.enemyHp * this.plan.hpMul);
    u.hp = u.maxHp;
    u.speed = def.speed * this.mods.enemySpeed;
    u.damage = def.damage;
    u.radius = def.radius;
    u.think = this.rng.range(0, 0.3);
    u.atkCd = this.rng.range(0, 0.5);
    u.summonT = def.summon ? def.summon.every * 0.6 : 0;
    this.units.push(u);
    this.events.emit('spawn', { u });
    if (def.boss) {
      this.bossUnit = u;
      this.events.emit('bossSpawn', { u });
    }
    return u;
  }

  // ---------------------------------------------------------------- phases
  setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
    this.events.emit('phase', { phase: p, night: this.night });
  }

  canStartNight(): boolean { return this.phase === 'day' && !this.choice; }

  startNight(): void {
    if (!this.canStartNight()) return;
    this.cancelHold();
    this.plan = this.makePlan();
    this.spawnQueue = spawnSchedule(this.plan);
    this.nightTime = -CONFIG.duskSeconds;
    for (const b of this.buildings) b.lostThisNight = false;
    this.setPhase('night');
    this.events.emit('nightStart', { night: this.night });
  }

  private endNight(): void {
    // Dawn: income, repairs, troops.
    const parts: { b: Building; n: number }[] = [];
    let clean = true;
    for (const b of this.buildings) if (b.lostThisNight && b.kind !== 'wall') clean = false;
    let total = 0;
    for (const b of this.buildings) {
      if (!b.alive) continue;
      let inc = b.node!.stats.income ?? 0;
      if (this.mods.harvest && ECONOMIC.has(b.kind) && this.night >= 4) inc += 1;
      if (inc > 0) {
        inc = Math.max(1, Math.floor(inc * this.mods.incomeMul));
        parts.push({ b, n: inc });
        total += inc;
      }
    }
    let bonus = this.mods.tithe;
    if (clean) {
      bonus += CONFIG.economy.cleanBonus;
      for (const b of this.buildings) if (b.alive) bonus += b.node!.stats.cleanBonus ?? 0;
      this.stats.cleanStreak++;
      this.stats.bestClean = Math.max(this.stats.bestClean, this.stats.cleanStreak);
    } else this.stats.cleanStreak = 0;
    total += bonus;
    this.coins += total;
    this.stats.maxIncome = Math.max(this.stats.maxIncome, total);
    this.stats.maxCoins = Math.max(this.stats.maxCoins, this.coins);
    this.lastIncome = { total, clean };
    this.events.emit('income', { total, parts, clean, bonus });
    this.repairAll();
    this.troopMode = 'hold';
    this.setPhase('dawn');
  }

  repairAll(): void {
    for (const b of this.buildings) {
      if (!b.node) continue;
      if (b.ruined) {
        b.ruined = false;
        b.builtT = 0;
        this.events.emit('repaired', { b });
      }
      b.hp = b.maxHp;
      this.syncTroops(b, false);
      for (const u of b.troops) u.hp = u.maxHp;
    }
    this.recomputeAuras();
    if (!this.hero.alive) this.respawnHero();
    this.hero.hp = this.hero.maxHp;
  }

  respawnHero(): void {
    this.hero.alive = true;
    this.hero.hp = this.hero.maxHp;
    this.hero.deadT = 0;
    this.placeHeroAtCastle();
    this.events.emit('heroRespawn', {});
  }

  /** Rewarded: castle restored, the night is replayed after a new day. */
  secondChance(): boolean {
    if (this.phase !== 'defeat' || this.secondChanceUsed) return false;
    this.secondChanceUsed = true;
    for (const u of this.units) if (u.team === 1) u.alive = false;
    for (const p of this.projectiles) p.alive = false;
    this.spawnQueue = [];
    this.bossUnit = null;
    this.cleanup();
    this.repairAll();
    this.castle.hp = this.castle.maxHp;
    this.setPhase('day');
    return true;
  }

  snapshot(): RunSnapshot {
    const nodes: Record<string, string> = {};
    for (const b of this.buildings) if (b.node && b.kind !== 'castle') nodes[b.slot.id] = b.node.id;
    if (this.castle.node && this.castle.node.id !== 'castle') nodes.castle = this.castle.node.id;
    return {
      map: this.cfg.map, weapon: this.cfg.weapon, perks: [...this.cfg.perks], mutators: [...this.cfg.mutators],
      endless: this.cfg.endless, seed: this.cfg.seed, night: this.night, coins: this.coins,
      nodes, stats: { ...this.stats }, secondChanceUsed: this.secondChanceUsed,
    };
  }

  // ---------------------------------------------------------------- construction
  cancelHold(): void {
    if (this.hold) {
      this.events.emit('holdCancel', { b: this.hold.b });
      this.hold = null;
      this.holdCoins = 0;
    }
  }

  private updateConstruction(dt: number): void {
    const slot = this.activeSlot();
    if (!this.input.hold) this.holdLock = false;
    if (!this.input.hold || !slot || this.holdLock) {
      if (this.hold) this.cancelHold();
      return;
    }
    const act = this.actionFor(slot)!;
    if (this.coins < act.cost) {
      if (this.hold) this.cancelHold();
      return;
    }
    if (!this.hold || this.hold.b !== slot) {
      this.cancelHold();
      const need = clamp(act.cost * CONFIG.build.secondsPerCoin, CONFIG.build.minHold, CONFIG.build.maxHold);
      this.hold = { b: slot, t: 0, need, cost: act.cost };
    }
    const h = this.hold;
    h.t += dt;
    const flown = Math.min(h.cost, Math.floor((h.t / h.need) * h.cost + 0.999));
    while (this.holdCoins < flown) {
      this.holdCoins++;
      this.events.emit('coinIn', { b: slot });
    }
    if (h.t >= h.need) {
      this.holdLock = true;
      this.coins -= h.cost;
      this.hold = null;
      this.holdCoins = 0;
      if (act.options.length === 1 && !slot.node) this.applyNode(slot, act.options[0]);
      else {
        this.choice = { b: slot, options: act.options, cost: act.cost };
        this.events.emit('choice', { b: slot, options: act.options });
      }
    }
  }

  chooseUpgrade(i: number): void {
    const c = this.choice;
    if (!c) return;
    const node = c.options[clamp(i, 0, c.options.length - 1)];
    this.choice = null;
    // Refund the price difference if the chosen option is cheaper.
    this.coins += c.cost - this.nodeCost(node);
    this.applyNode(c.b, node);
  }

  cancelChoice(): void {
    if (!this.choice) return;
    this.coins += this.choice.cost;
    this.choice = null;
  }

  // ---------------------------------------------------------------- main update
  update(rawDt: number): void {
    if (this.paused) return;
    let dt = Math.min(rawDt, 0.1) * this.timeScale;
    while (dt > 0) {
      const step = Math.min(dt, 1 / 30);
      this.step(step);
      dt -= step;
    }
  }

  private step(dt: number): void {
    this.time += dt;
    this.phaseTime += dt;
    const inp = this.input;

    if (inp.rally) {
      inp.rally = false;
      this.toggleRally();
    }
    if (inp.startNight) {
      inp.startNight = false;
      this.startNight();
    }

    switch (this.phase) {
      case 'day':
        this.updateConstruction(dt);
        break;
      case 'night':
        this.nightTime += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].t <= this.nightTime) {
          const e = this.spawnQueue.shift()!;
          if (this.enemiesAlive < CONFIG.maxUnits) this.spawnEnemy(e.unit, e.path);
          else this.spawnQueue.push({ ...e, t: this.nightTime + 2 });
        }
        break;
      case 'dawn':
        if (this.phaseTime >= CONFIG.dawnSeconds) {
          if (!this.cfg.endless && this.night >= this.map.nights) {
            this.setPhase('victory');
            return;
          }
          this.night++;
          this.plan = this.makePlan();
          this.setPhase('day');
        }
        break;
      default:
        break;
    }

    for (const b of this.buildings) { b.builtT += dt; b.hitT += dt; b.attackT += dt; }
    this.respawnTroops(dt);
    updateHero(this, dt);
    updateUnits(this, dt);
    updateCombat(this, dt);
    this.cleanup();

    if (this.phase === 'night') {
      this.stats.castleMinHp = Math.min(this.stats.castleMinHp, this.castle.hp / this.castle.maxHp);
      if (this.castle.ruined || this.castle.hp <= 0) {
        this.setPhase('defeat');
        return;
      }
      if (!this.spawnQueue.length && this.enemiesAlive === 0 && this.nightTime > 0) this.endNight();
    }
    this.stats.maxCoins = Math.max(this.stats.maxCoins, this.coins);
  }

  toggleRally(): void {
    this.troopMode = this.troopMode === 'hold' ? 'charge' : 'hold';
    for (const u of this.units) if (u.team === 0) u.target = null;
    this.events.emit('rally', { mode: this.troopMode });
  }

  /** Fallen soldiers are replaced one by one at their (standing) building. */
  private respawnTroops(dt: number): void {
    for (const b of this.buildings) {
      const tr = b.node?.stats.troops;
      if (!tr || !b.alive) continue;
      b.troops = b.troops.filter((u) => u.alive);
      if (b.troops.length >= tr.count + this.mods.extraTroops) { b.respawnT = 0; continue; }
      b.respawnT += dt;
      if (b.respawnT < CONFIG.troopRespawn) continue;
      b.respawnT = 0;
      const before = b.troops.length;
      this.syncTroops(b, false, 1);
      if (b.troops.length > before) this.events.emit('troopSpawn', { u: b.troops[b.troops.length - 1] });
    }
  }

  private cleanup(): void {
    let n = 0;
    let enemies = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.alive) {
        this.units[n++] = u;
        if (u.team === 1) enemies++;
      } else {
        if (u === this.bossUnit) this.bossUnit = null;
        this.unitPool.push(u);
      }
    }
    this.units.length = n;
    this.enemiesAlive = enemies;
    n = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.alive) this.projectiles[n++] = p;
      else this.projPool.push(p);
    }
    this.projectiles.length = n;
  }

  /** Remove listeners and pooled objects (run teardown). */
  dispose(): void {
    this.events.clear();
    this.units.length = 0;
    this.projectiles.length = 0;
    this.unitPool.length = 0;
    this.projPool.length = 0;
  }
}

/** Ring formation offsets for squad members. */
export function formation(i: number): { x: number; z: number } {
  if (i === 0) return { x: 0, z: 0 };
  const ring = i < 7 ? 1 : 2;
  const idx = ring === 1 ? i - 1 : i - 7;
  const cnt = ring === 1 ? 6 : 10;
  const a = (idx / cnt) * Math.PI * 2 + ring * 0.4;
  const r = ring * 1.15;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}
