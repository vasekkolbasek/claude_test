import { describe, expect, it } from 'vitest';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPONS, WEAPON_IDS } from '../../src/data/weapons';
import { World } from '../../src/game/World';

/** a world with only level-5 orbital blades and one sturdy trojan `d` away from the player's edge */
function setup(d: number): { w: World; hp: () => number } {
  const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 11, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
  w.weapons.length = 0;
  w.addWeapon('orbit', 0).level = 5;
  const p = w.player;
  const e = w.spawnEnemy('trojan', p.x + p.r + d, p.y);
  e.hp = e.maxHp = 1e6;
  return { w, hp: () => e.hp };
}

function run(w: World, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) {
    w.player.hp = w.stats.maxHp;
    w.player.inv = 1;
    w.update(1 / 60);
  }
}

describe('orbital blades', () => {
  it('do not hit an enemy pressed against the player, inside the blade circle', () => {
    const { w, hp } = setup(19);
    run(w, 1.5);
    expect(hp()).toBe(1e6);
  });

  it('hit an enemy on the blade circle', () => {
    const { w, hp } = setup(WEAPONS.orbit.levels[4].extra - 14);
    run(w, 0.5);
    expect(hp()).toBeLessThan(1e6);
  });
});

