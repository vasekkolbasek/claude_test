import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/math';
import { BALANCE } from '../../src/data/balance';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPON_IDS } from '../../src/data/weapons';
import type { WeaponId } from '../../src/data/types';
import { availableEvolutions, rollCards, type LoadoutView, type WeaponSlot } from '../../src/game/cards';
import { World } from '../../src/game/World';

function loadout(p: Partial<LoadoutView> = {}): LoadoutView {
  return { weapons: [], passives: [], luck: 1, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS, ...p };
}

describe('upgrade cards', () => {
  it('rolls the requested number of distinct cards', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 200; i++) {
      const cards = rollCards(loadout({ weapons: [{ id: 'pulse', level: 2, evo: false, bonus: 0 }] }), rng, 3);
      expect(cards).toHaveLength(3);
      const keys = cards.map((c) => `${c.kind}:${c.id}`);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('never offers new weapons when slots are full', () => {
    const weapons: WeaponSlot[] = WEAPON_IDS.slice(0, BALANCE.slots.weapons).map((id) => ({ id, level: 1, evo: false, bonus: 0 }));
    const rng = new Rng(2);
    for (let i = 0; i < 100; i++) {
      for (const c of rollCards(loadout({ weapons }), rng, 3)) expect(c.kind).not.toBe('weapon_new');
    }
  });

  it('guarantees an available evolution', () => {
    const l = loadout({ weapons: [{ id: 'pulse', level: 5, evo: false, bonus: 0 }], passives: [{ id: 'might', level: 1, value: 0.1 }] });
    expect(availableEvolutions(l)).toEqual(['pulse_evo']);
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      const cards = rollCards(l, rng, 3);
      expect(cards.some((c) => c.kind === 'evolution' && c.id === 'pulse_evo' && c.rarity === 3)).toBe(true);
    }
  });

  it('does not offer evolution without the matching passive or below level 5', () => {
    expect(availableEvolutions(loadout({ weapons: [{ id: 'pulse', level: 5, evo: false, bonus: 0 }], passives: [{ id: 'area', level: 1, value: 0.1 }] }))).toEqual([]);
    expect(availableEvolutions(loadout({ weapons: [{ id: 'pulse', level: 4, evo: false, bonus: 0 }], passives: [{ id: 'might', level: 1, value: 0.1 }] }))).toEqual([]);
  });

  it('falls back to heal/bits when everything is maxed', () => {
    const weapons: WeaponSlot[] = WEAPON_IDS.slice(0, 6).map((id) => ({ id: id as WeaponId, level: 5, evo: true, bonus: 0 }));
    const passives = PASSIVE_IDS.slice(0, 6).map((id) => ({ id, level: 5, value: 1 }));
    const cards = rollCards(loadout({ weapons, passives }), new Rng(4), 3);
    expect(cards.map((c) => c.kind).sort()).toEqual(['bits', 'heal']);
  });

  it('luck shifts rarity upward', () => {
    const count = (luck: number) => {
      const rng = new Rng(5);
      let rare = 0;
      for (let i = 0; i < 2000; i++) for (const c of rollCards(loadout({ luck }), rng, 3)) if (c.rarity >= 1) rare++;
      return rare;
    };
    expect(count(2)).toBeGreaterThan(count(1));
  });

  it('applying cards changes the world loadout', () => {
    const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 1, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
    expect(w.weapons.map((x) => x.id)).toEqual(['pulse']);
    w.applyCard({ kind: 'weapon_up', id: 'pulse', rarity: 0, levelFrom: 1, levelTo: 2, value: 0 });
    expect(w.weapons[0].level).toBe(2);
    w.applyCard({ kind: 'weapon_new', id: 'orbit', rarity: 1, levelFrom: 0, levelTo: 1, value: 0.12 });
    expect(w.weapons[1].id).toBe('orbit');
    expect(w.weapons[1].bonus).toBeCloseTo(0.12);
    const hp = w.stats.maxHp;
    w.applyCard({ kind: 'passive_new', id: 'maxhp', rarity: 0, levelFrom: 0, levelTo: 1, value: 20 });
    expect(w.stats.maxHp).toBe(hp + 20);
    expect(w.player.hp).toBe(w.stats.maxHp);
  });
});
