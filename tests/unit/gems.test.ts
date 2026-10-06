import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPON_IDS } from '../../src/data/weapons';
import { GEM_XP } from '../../src/game/entities';
import { World } from '../../src/game/World';

describe('xp crystals at the limit', () => {
  it('XP from a kill near the player does not fuse into a crystal far behind', () => {
    const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 5, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
    const p = w.player;
    // fill the limit with crystals left far behind the player (the farthest one is last)
    for (let i = 0; i < BALANCE.maxGems; i++) w.dropGem(p.x - 1500 - i, p.y, GEM_XP, 1);
    const g = w.dropGem(p.x + 60, p.y, GEM_XP, 5);
    expect(w.gems).toHaveLength(BALANCE.maxGems);
    // the farthest crystal is moved to the kill and carries both its own XP and the new one
    expect(g.x).toBe(p.x + 60);
    expect(g.y).toBe(p.y);
    expect(g.value).toBe(6);
    expect(Math.hypot(g.x - p.x, g.y - p.y)).toBeLessThan(100);
    expect(w.gems.reduce((s, o) => s + o.value, 0)).toBe(BALANCE.maxGems + 5);
  });

  it('still fuses into a nearby crystal when there is one', () => {
    const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 5, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
    const p = w.player;
    for (let i = 0; i < BALANCE.maxGems - 1; i++) w.dropGem(p.x - 1500 - i, p.y, GEM_XP, 1);
    const near = w.dropGem(p.x + 100, p.y, GEM_XP, 1);
    const g = w.dropGem(p.x + 60, p.y, GEM_XP, 5);
    expect(g).toBe(near);
    expect(g.x).toBe(p.x + 100);
    expect(g.value).toBe(6);
  });
});
