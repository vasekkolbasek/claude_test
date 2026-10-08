import { describe, expect, it } from 'vitest';
import { PASSIVES, PASSIVE_IDS } from '../../src/data/passives';
import { EVOLUTIONS, WEAPON_IDS } from '../../src/data/weapons';
import { EV } from '../../src/game/events';
import { World } from '../../src/game/World';

describe('data container from a mini-boss', () => {
  it('opens a card choice with the ready evolution instead of evolving silently', () => {
    const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 5, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
    w.weapons.length = 0;
    w.addWeapon('pulse', 0).level = 5;
    const need = EVOLUTIONS.pulse_evo.passive;
    for (let i = 0; i < PASSIVES[need].maxLevel; i++) {
      const has = w.passives.some((p) => p.id === need);
      w.applyCard({ kind: has ? 'passive_up' : 'passive_new', id: need, rarity: 0, levelFrom: 0, levelTo: 1, value: 0 });
    }
    // no regular level-ups from the boss XP: only the container may open a choice
    w.player.xpNext = 1e9;
    const p = w.player;
    const boss = w.spawnEnemy('mb_trojan', p.x + 30, p.y);
    w.hurtEnemy(boss, boss.hp + 1, -1, 0, 0, false);
    for (let i = 0; i < 180 && w.state === 'playing'; i++) {
      p.hp = w.stats.maxHp;
      p.inv = 1;
      w.update(1 / 60);
    }
    expect(w.state).toBe('levelup');
    expect(w.chestChoice).toBe(true);
    expect(w.weapons[0].evo).toBe(false);
    const i = w.choices.findIndex((c) => c.kind === 'evolution' && c.id === 'pulse_evo');
    expect(i).toBeGreaterThanOrEqual(0);
    w.chooseCard(i);
    expect(w.weapons[0].evo).toBe(true);
    // the evolution's flash / banner event survives until the app reads it right after the choice
    const evs = Array.from({ length: w.events.count }, (_, k) => w.events.items[k].type);
    expect(evs).toContain(EV.EVOLVE);
    expect(w.state).toBe('playing');
  });
});
