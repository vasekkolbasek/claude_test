import { describe, expect, it } from 'vitest';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPON_IDS } from '../../src/data/weapons';
import { EV } from '../../src/game/events';
import { World } from '../../src/game/World';

describe('enemy bullets', () => {
  it('a bullet reaching an invulnerable player breaks on the shield instead of flying through', () => {
    const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 3, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
    w.weapons.length = 0;
    const p = w.player;
    const hp = p.hp;
    // first bullet hits, the second one arrives during the post-hit invulnerability
    w.fireEnemyBullet(p.x - 30, p.y, 0, 300, 10, 0xff0000);
    w.fireEnemyBullet(p.x - 60, p.y, 0, 300, 10, 0xff0000);
    p.inv = 0;
    let blocked = 0;
    for (let i = 0; i < 30; i++) {
      w.update(1 / 60);
      for (let k = 0; k < w.events.count; k++) if (w.events.items[k].type === EV.BLOCK) blocked++;
    }
    expect(p.hp).toBeLessThan(hp);
    expect(blocked).toBe(1);
    expect(w.ebullets.filter((b) => b.alive)).toHaveLength(0);
  });
});
