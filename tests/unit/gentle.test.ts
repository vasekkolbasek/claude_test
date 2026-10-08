import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPON_IDS } from '../../src/data/weapons';
import { World } from '../../src/game/World';

function world(gentleStart: boolean): World {
  const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 21, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS, gentleStart });
  w.weapons.length = 0;
  return w;
}

/** plays `seconds` with a player that cannot be hurt and has no weapons */
function play(w: World, seconds: number): void {
  for (let i = 0; i < seconds * 30; i++) {
    w.player.hp = w.stats.maxHp;
    w.player.inv = 1;
    w.update(1 / 30);
  }
}

describe('first-run gentle start', () => {
  it('eases the swarm in over the first minute, then plays as usual', () => {
    const first = world(true);
    const usual = world(false);
    expect(first.easeIn()).toBeCloseTo(BALANCE.gentleStart.from);
    expect(usual.easeIn()).toBe(1);
    // fewer and slower viruses at first, each worth more XP so levelling keeps its pace
    const a = first.spawnEnemy('byte', 300, 0);
    const b = usual.spawnEnemy('byte', 300, 0);
    expect(a.xp).toBeCloseTo(b.xp / BALANCE.gentleStart.from);
    expect(a.speed).toBeLessThan(b.speed * 0.9);
    play(first, 20);
    play(usual, 20);
    expect(first.enemies.length).toBeLessThan(usual.enemies.length * 0.8);
    play(first, BALANCE.gentleStart.until);
    expect(first.easeIn()).toBe(1);
  });
});
