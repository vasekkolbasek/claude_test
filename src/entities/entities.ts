import type { UnitDef } from '../data/units';
import type { BNode, BKind, ProjKind } from '../data/buildings';
import type { SlotDef } from '../data/maps';
import type { WeaponDef } from '../data/weapons';

let nextId = 1;

export type Ent = Unit | Building | Hero;

export class Unit {
  readonly ent = 'u' as const;
  id = nextId++;
  def!: UnitDef;
  team: 0 | 1 = 1;
  x = 0;
  z = 0;
  hp = 1;
  maxHp = 1;
  alive = false;
  radius = 0.5;
  facing = 0;
  moving = false;
  speed = 1;
  damage = 1;
  // Path following (enemies)
  path = 0;
  s = 0;
  lat = 0;
  // Targeting
  target: Ent | null = null;
  atkCd = 0;
  think = 0;
  // Status effects
  slowT = 0;
  slowAmt = 0;
  burnT = 0;
  burnDps = 0;
  burnSrc = 0;
  // Allies
  owner: Building | null = null;
  holdX = 0;
  holdZ = 0;
  slotIdx = 0;
  /** Burn applied on hit (troop upgrades). */
  onHitBurn = 0;
  // Animation hints for the view
  attackT = 9;
  hitT = 9;
  age = 0;
  summonT = 0;
  bumpX = 0;
  bumpZ = 0;
}

export class Building {
  readonly ent = 'b' as const;
  id = nextId++;
  x: number;
  z: number;
  kind: BKind;
  radius: number;
  node: BNode | null = null;
  hp = 0;
  maxHp = 0;
  ruined = false;
  atkCd = 0;
  troops: Unit[] = [];
  /** Wall segment endpoints (walls only). */
  wall: { ax: number; az: number; bx: number; bz: number; rot: number } | null = null;
  rallyX = 0;
  rallyZ = 0;
  /** Seconds since last (re)build — used by the view for grow animation. */
  builtT = 99;
  hitT = 9;
  attackT = 9;
  lostThisNight = false;
  respawnT = 0;
  constructor(readonly slot: SlotDef, x: number, z: number, radius: number) {
    this.kind = slot.kind;
    this.x = x;
    this.z = z;
    this.radius = radius;
  }
  get built(): boolean { return this.node !== null; }
  get alive(): boolean { return this.node !== null && !this.ruined; }
}

export class Hero {
  readonly ent = 'h' as const;
  x = 0;
  z = 0;
  facing = 0;
  hp = 1;
  maxHp = 1;
  alive = true;
  deadT = 0;
  atkCd = 0;
  abilityCd = 0;
  lastHurt = -99;
  radius = 0.7;
  moving = false;
  speed = 8;
  attackT = 9;
  hitT = 9;
  abilityT = 9;
  kills = 0;
  dashT = 0;
  dashX = 0;
  dashZ = 0;
  dashHit = new Set<number>();
  constructor(public weapon: WeaponDef) {}
}

export class Projectile {
  alive = false;
  kind: ProjKind = 'arrow';
  team: 0 | 1 = 0;
  x = 0;
  z = 0;
  sx = 0;
  sz = 0;
  tx = 0;
  tz = 0;
  /** Launch height and arc height hints for the view. */
  h0 = 1;
  arc = 1;
  target: Ent | null = null;
  speed = 20;
  damage = 0;
  splash = 0;
  pierce = 0;
  slow = 0;
  burn = 0;
  armorPierce = false;
  bonusVsBig = 1;
  bldMul = 1;
  traveled = 0;
  total = 1;
  /** Units already hit by a piercing projectile. */
  hits: number[] = [];
  dirX = 0;
  dirZ = 0;
  heal = 0;
  fromHero = false;
  delay = 0;
}
