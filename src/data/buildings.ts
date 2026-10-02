import type { AllyId } from './units';

export type BKind = 'castle' | 'wall' | 'tower' | 'magic' | 'barracks' | 'range' | 'farm' | 'mine' | 'fish' | 'forge';
export type ProjKind = 'arrow' | 'bolt' | 'orb' | 'frost' | 'fire' | 'dart' | 'hex' | 'rock' | 'star';

export interface AttackStats {
  damage: number;
  range: number;
  cooldown: number;
  projectile: ProjKind;
  splash?: number;
  pierce?: number;
  slow?: number;
  burn?: number;
  multishot?: number;
  armorPierce?: boolean;
}

export interface BStats {
  hp: number;
  attack?: AttackStats;
  income?: number;
  troops?: { unit: AllyId; count: number };
  /** Forge auras: additive damage multipliers. */
  buffTroops?: number;
  buffTowers?: number;
  buffHero?: number;
  hpTroops?: number;
  thorns?: number;
  /** Troops from this building set targets on fire (dps). */
  troopBurn?: number;
  cleanBonus?: number;
}

export interface BNode {
  id: string;
  kind: BKind;
  tier: 0 | 1 | 2;
  /** Cost to build / upgrade to this node. */
  cost: number;
  stats: BStats;
  next: string[];
  parent?: string;
  /** Visual variant (spec id), used by the model builder. */
  look: string;
}

/** Declarative tier-2 modifier applied on top of a specialisation. */
interface Mod {
  id: string;
  hpMul?: number;
  dmgMul?: number;
  rangeAdd?: number;
  cdMul?: number;
  multishotAdd?: number;
  incomeAdd?: number;
  troopsAdd?: number;
  burnAdd?: number;
  splashAdd?: number;
  thornsAdd?: number;
  buffAdd?: number;
  hpTroopsAdd?: number;
  cleanAdd?: number;
}

interface KindDef {
  base: { cost: number; stats: BStats };
  specs: [{ id: string; cost: number; stats: BStats }, { id: string; cost: number; stats: BStats }];
  modCost: number;
  mods: [Mod, Mod];
}

export const ECONOMIC: ReadonlySet<BKind> = new Set<BKind>(['farm', 'mine', 'fish']);
export const BUILD_RADIUS: Record<BKind, number> = {
  castle: 3.4, wall: 0.9, tower: 1.3, magic: 1.3, barracks: 1.8, range: 1.8, farm: 1.7, mine: 1.6, fish: 1.5, forge: 1.6,
};

const KINDS: Record<BKind, KindDef> = {
  castle: {
    base: { cost: 0, stats: { hp: 800, income: 4, attack: { damage: 6, range: 9, cooldown: 1.2, projectile: 'arrow' } } },
    specs: [
      { id: 'citadel', cost: 10, stats: { hp: 1250, income: 4, attack: { damage: 8, range: 10, cooldown: 0.75, projectile: 'arrow' } } },
      { id: 'court', cost: 10, stats: { hp: 900, income: 7, attack: { damage: 6, range: 9, cooldown: 1.1, projectile: 'arrow' } } },
    ],
    modCost: 18,
    mods: [{ id: 'bastions', hpMul: 1.5, multishotAdd: 1 }, { id: 'treasury', incomeAdd: 3 }],
  },
  wall: {
    base: { cost: 2, stats: { hp: 150 } },
    specs: [
      { id: 'stone', cost: 4, stats: { hp: 380 } },
      { id: 'spiked', cost: 4, stats: { hp: 220, thorns: 7 } },
    ],
    modCost: 7,
    mods: [{ id: 'reinforced', hpMul: 1.7 }, { id: 'tar', thornsAdd: 8, hpMul: 1.15 }],
  },
  tower: {
    base: { cost: 5, stats: { hp: 140, attack: { damage: 7, range: 9, cooldown: 1, projectile: 'arrow' } } },
    specs: [
      { id: 'archer', cost: 6, stats: { hp: 170, attack: { damage: 7, range: 10, cooldown: 0.5, projectile: 'arrow' } } },
      { id: 'ballista', cost: 6, stats: { hp: 190, attack: { damage: 30, range: 12, cooldown: 1.9, projectile: 'bolt', pierce: 3, armorPierce: true } } },
    ],
    modCost: 10,
    mods: [{ id: 'keen', dmgMul: 1.45, rangeAdd: 1.5 }, { id: 'volley', multishotAdd: 2, cdMul: 0.9 }],
  },
  magic: {
    base: { cost: 8, stats: { hp: 130, attack: { damage: 12, range: 9, cooldown: 1.6, projectile: 'orb', splash: 2.2 } } },
    specs: [
      { id: 'frost', cost: 10, stats: { hp: 150, attack: { damage: 10, range: 10, cooldown: 1.2, projectile: 'frost', splash: 2.6, slow: 0.45, armorPierce: true } } },
      { id: 'fire', cost: 10, stats: { hp: 150, attack: { damage: 18, range: 9.5, cooldown: 1.7, projectile: 'fire', splash: 3, burn: 5, armorPierce: true } } },
    ],
    modCost: 14,
    mods: [{ id: 'resonance', dmgMul: 1.55 }, { id: 'farsight', rangeAdd: 3, cdMul: 0.8 }],
  },
  barracks: {
    base: { cost: 6, stats: { hp: 180, troops: { unit: 'militia', count: 2 } } },
    specs: [
      { id: 'spear', cost: 8, stats: { hp: 220, troops: { unit: 'spearman', count: 3 } } },
      { id: 'sword', cost: 8, stats: { hp: 220, troops: { unit: 'swordsman', count: 3 } } },
    ],
    modCost: 12,
    mods: [{ id: 'veterans', troopsAdd: 1, hpTroopsAdd: 0.3 }, { id: 'warcry', dmgMul: 1.5 }],
  },
  range: {
    base: { cost: 7, stats: { hp: 150, troops: { unit: 'bowman', count: 2 } } },
    specs: [
      { id: 'bows', cost: 9, stats: { hp: 180, troops: { unit: 'bowman', count: 4 } } },
      { id: 'xbows', cost: 9, stats: { hp: 180, troops: { unit: 'crossbowman', count: 3 } } },
    ],
    modCost: 12,
    mods: [{ id: 'firearrows', burnAdd: 4 }, { id: 'squad', troopsAdd: 1, hpTroopsAdd: 0.3 }],
  },
  farm: {
    base: { cost: 3, stats: { hp: 90, income: 2 } },
    specs: [
      { id: 'mill', cost: 5, stats: { hp: 110, income: 3 } },
      { id: 'militia', cost: 5, stats: { hp: 130, income: 2, troops: { unit: 'militia', count: 2 } } },
    ],
    modCost: 8,
    mods: [{ id: 'harvest', incomeAdd: 1 }, { id: 'fence', hpMul: 2.5, troopsAdd: 1 }],
  },
  mine: {
    base: { cost: 7, stats: { hp: 140, income: 3 } },
    specs: [
      { id: 'deep', cost: 8, stats: { hp: 150, income: 5 } },
      { id: 'fort', cost: 8, stats: { hp: 320, income: 4, attack: { damage: 6, range: 8, cooldown: 1.1, projectile: 'arrow' } } },
    ],
    modCost: 12,
    mods: [{ id: 'vein', incomeAdd: 2 }, { id: 'vaults', hpMul: 2, incomeAdd: 1 }],
  },
  fish: {
    base: { cost: 4, stats: { hp: 80, income: 2 } },
    specs: [
      { id: 'pier', cost: 6, stats: { hp: 100, income: 4 } },
      { id: 'market', cost: 6, stats: { hp: 110, income: 3, cleanBonus: 2 } },
    ],
    modCost: 9,
    mods: [{ id: 'nets', incomeAdd: 1 }, { id: 'stilts', hpMul: 2.5, cleanAdd: 1 }],
  },
  forge: {
    base: { cost: 8, stats: { hp: 170, buffTroops: 0.1, buffTowers: 0.1, buffHero: 0.1 } },
    specs: [
      { id: 'armory', cost: 10, stats: { hp: 200, buffTroops: 0.3, buffTowers: 0.1, buffHero: 0.3 } },
      { id: 'workshop', cost: 10, stats: { hp: 200, buffTroops: 0.1, buffTowers: 0.3, buffHero: 0.1 } },
    ],
    modCost: 14,
    mods: [{ id: 'temper', buffAdd: 0.15 }, { id: 'mail', hpTroopsAdd: 0.3, hpMul: 1.5 }],
  },
};

function applyMod(s: BStats, m: Mod): BStats {
  const r: BStats = JSON.parse(JSON.stringify(s));
  if (m.hpMul) r.hp = Math.round(r.hp * m.hpMul);
  if (r.attack) {
    if (m.dmgMul) r.attack.damage = Math.round(r.attack.damage * m.dmgMul * 10) / 10;
    if (m.rangeAdd) r.attack.range += m.rangeAdd;
    if (m.cdMul) r.attack.cooldown = Math.round(r.attack.cooldown * m.cdMul * 100) / 100;
    if (m.multishotAdd) r.attack.multishot = (r.attack.multishot ?? 1) + m.multishotAdd;
    if (m.splashAdd) r.attack.splash = (r.attack.splash ?? 0) + m.splashAdd;
  }
  if (m.incomeAdd) r.income = (r.income ?? 0) + m.incomeAdd;
  if (m.troopsAdd && r.troops) r.troops.count += m.troopsAdd;
  if (m.thornsAdd) r.thorns = (r.thorns ?? 0) + m.thornsAdd;
  if (m.cleanAdd) r.cleanBonus = (r.cleanBonus ?? 0) + m.cleanAdd;
  if (m.buffAdd) {
    r.buffTroops = (r.buffTroops ?? 0) + m.buffAdd;
    r.buffTowers = (r.buffTowers ?? 0) + m.buffAdd;
    r.buffHero = (r.buffHero ?? 0) + m.buffAdd;
  }
  if (m.hpTroopsAdd) r.hpTroops = (r.hpTroops ?? 0) + m.hpTroopsAdd;
  // Troop-producing buildings: dmg / burn modifiers are stored as troop bonuses.
  if (r.troops) {
    if (m.dmgMul) r.buffTroops = (r.buffTroops ?? 0) + (m.dmgMul - 1);
    if (m.burnAdd) r.troopBurn = (r.troopBurn ?? 0) + m.burnAdd;
  }
  return r;
}

function buildTree(): Record<string, BNode> {
  const out: Record<string, BNode> = {};
  for (const kind of Object.keys(KINDS) as BKind[]) {
    const k = KINDS[kind];
    const baseId = kind;
    out[baseId] = { id: baseId, kind, tier: 0, cost: k.base.cost, stats: k.base.stats, next: k.specs.map((s) => `${kind}_${s.id}`), look: 'base' };
    for (const spec of k.specs) {
      const sid = `${kind}_${spec.id}`;
      out[sid] = { id: sid, kind, tier: 1, cost: spec.cost, stats: spec.stats, parent: baseId, next: k.mods.map((m) => `${sid}_${m.id}`), look: spec.id };
      for (const m of k.mods) {
        const mid = `${sid}_${m.id}`;
        out[mid] = { id: mid, kind, tier: 2, cost: k.modCost, stats: applyMod(spec.stats, m), parent: sid, next: [], look: spec.id };
      }
    }
  }
  return out;
}

export const BNODES: Record<string, BNode> = buildTree();
export const BKINDS = Object.keys(KINDS) as BKind[];

/** i18n key of the tier-2 mod (shared by both specs) or the node itself. */
export function nodeNameKey(id: string): string {
  const n = BNODES[id];
  if (n.tier === 2) return `mod.${n.kind}.${id.split('_').pop()}`;
  return `bld.${id}`;
}
