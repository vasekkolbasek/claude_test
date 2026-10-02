/** Per-frame simulation events consumed by the renderer, audio and UI. */
export const EV = {
  HIT: 1,
  KILL: 2,
  PLAYER_HIT: 3,
  GEM: 4,
  LEVELUP: 5,
  SHOOT: 6,
  EXPLODE: 7,
  BOLT: 8,
  HEAL: 9,
  BOSS: 10,
  TELEPORT: 11,
  SHIELD_HIT: 12,
  CHEST: 13,
  EVOLVE: 14,
  MAGNET: 15,
  HEAL_PULSE: 16,
  ENEMY_SHOOT: 17,
  WARN: 18,
  DASH: 19,
  BOSS_PHASE: 20,
  REVIVE: 21,
  PICKUP: 22,
  SPLIT: 23,
} as const;

export type EventType = (typeof EV)[keyof typeof EV];

export class GameEvent {
  type: EventType = EV.HIT;
  x = 0;
  y = 0;
  a = 0;
  b = 0;
  c = 0;
  ref: unknown = null;
}

export class EventQueue {
  readonly items: GameEvent[] = [];
  count = 0;
  /** hard cap protects against runaway frames */
  constructor(private readonly cap = 2048) {}

  push(type: EventType, x: number, y: number, a = 0, b = 0, c = 0, ref: unknown = null): void {
    if (this.count >= this.cap) return;
    let e = this.items[this.count];
    if (!e) {
      e = new GameEvent();
      this.items.push(e);
    }
    e.type = type;
    e.x = x;
    e.y = y;
    e.a = a;
    e.b = b;
    e.c = c;
    e.ref = ref;
    this.count++;
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) this.items[i].ref = null;
    this.count = 0;
  }
}
