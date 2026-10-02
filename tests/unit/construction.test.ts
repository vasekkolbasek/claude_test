import { describe, expect, it } from 'vitest';
import { BNODES, BKINDS } from '../../src/data/buildings';
import { CONFIG } from '../../src/data/config';
import { Game } from '../../src/systems/Game';

const mk = () => new Game({ map: 'valley', weapon: 'sword', perks: [], mutators: [], endless: false, seed: 2 });

function holdAt(g: Game, slotId: string, seconds: number): void {
  const b = g.bySlot.get(slotId)!;
  g.hero.x = b.x + b.radius + 0.5;
  g.hero.z = b.z;
  g.input.hold = true;
  for (let t = 0; t < seconds; t += 0.05) g.update(0.05);
  g.input.hold = false;
  g.update(0.05);
}

describe('upgrade tree', () => {
  it('every kind has a base, two specialisations and two tier-2 mods per spec', () => {
    for (const k of BKINDS) {
      const base = BNODES[k];
      expect(base.tier).toBe(0);
      expect(base.next).toHaveLength(2);
      for (const s of base.next) {
        expect(BNODES[s].tier).toBe(1);
        expect(BNODES[s].next).toHaveLength(2);
        for (const m of BNODES[s].next) {
          expect(BNODES[m].tier).toBe(2);
          expect(BNODES[m].next).toHaveLength(0);
          expect(BNODES[m].cost).toBeGreaterThan(BNODES[s].cost);
        }
      }
    }
  });

  it('tier-2 mods actually improve the specialisation', () => {
    expect(BNODES.tower_archer_keen.stats.attack!.damage).toBeGreaterThan(BNODES.tower_archer.stats.attack!.damage);
    expect(BNODES.tower_ballista_volley.stats.attack!.multishot).toBe(3);
    expect(BNODES.farm_mill_harvest.stats.income).toBe(BNODES.farm_mill.stats.income! + 1);
    expect(BNODES.barracks_spear_veterans.stats.troops!.count).toBe(4);
    expect(BNODES.wall_stone_reinforced.stats.hp).toBeGreaterThan(BNODES.wall_stone.stats.hp);
  });
});

describe('construction', () => {
  it('holding at an empty slot builds it and spends coins', () => {
    const g = mk();
    const coins = g.coins;
    holdAt(g, 'farm1', 1.5);
    const b = g.bySlot.get('farm1')!;
    expect(b.node?.id).toBe('farm');
    expect(g.coins).toBe(coins - BNODES.farm.cost);
  });

  it('releasing early cancels without spending', () => {
    const g = mk();
    const coins = g.coins;
    holdAt(g, 'tower1', CONFIG.build.minHold * 0.4);
    expect(g.bySlot.get('tower1')!.node).toBeNull();
    expect(g.coins).toBe(coins);
  });

  it('cannot build without enough coins', () => {
    const g = mk();
    g.coins = 1;
    holdAt(g, 'tower1', 2);
    expect(g.bySlot.get('tower1')!.node).toBeNull();
    expect(g.coins).toBe(1);
  });

  it('upgrading opens a two-way choice; the choice applies the branch', () => {
    const g = mk();
    g.coins = 50;
    holdAt(g, 'tower1', 2);
    expect(g.bySlot.get('tower1')!.node?.id).toBe('tower');
    holdAt(g, 'tower1', 2);
    expect(g.choice).not.toBeNull();
    expect(g.choice!.options.map((o) => o.id)).toEqual(['tower_archer', 'tower_ballista']);
    const before = g.coins;
    g.chooseUpgrade(1);
    expect(g.bySlot.get('tower1')!.node?.id).toBe('tower_ballista');
    expect(g.coins).toBe(before);
    expect(g.choice).toBeNull();
  });

  it('cancelling a choice refunds the coins', () => {
    const g = mk();
    g.coins = 50;
    holdAt(g, 'farm1', 2);
    const afterBuild = g.coins;
    holdAt(g, 'farm1', 2);
    expect(g.coins).toBe(afterBuild - BNODES.farm_mill.cost);
    g.cancelChoice();
    expect(g.coins).toBe(afterBuild);
    expect(g.bySlot.get('farm1')!.node?.id).toBe('farm');
  });

  it('barracks spawn troops and specialisation swaps their type', () => {
    const g = mk();
    const b = g.bySlot.get('barracks1')!;
    g.applyNode(b, BNODES.barracks);
    expect(b.troops.length).toBe(2);
    expect(b.troops[0].def.id).toBe('militia');
    g.applyNode(b, BNODES.barracks_spear);
    g.update(0.05);
    expect(b.troops.length).toBe(3);
    expect(b.troops.every((u) => u.def.id === 'spearman')).toBe(true);
  });

  it('no-walls mutator disables wall slots and masons perk discounts towers', () => {
    const g = new Game({ map: 'valley', weapon: 'sword', perks: ['masons'], mutators: ['nowalls'], endless: false, seed: 3 });
    expect(g.actionFor(g.bySlot.get('wall1')!)).toBeNull();
    expect(g.actionFor(g.bySlot.get('tower1')!)!.cost).toBe(4);
  });

  it('snapshot restores buildings, coins and night', () => {
    const g = mk();
    g.applyNode(g.bySlot.get('tower1')!, BNODES.tower_archer);
    g.coins = 17;
    g.night = 4;
    const snap = g.snapshot();
    const r = new Game({ map: 'valley', weapon: 'sword', perks: [], mutators: [], endless: false, seed: 2, snapshot: snap });
    expect(r.night).toBe(4);
    expect(r.coins).toBe(17);
    expect(r.bySlot.get('tower1')!.node?.id).toBe('tower_archer');
  });
});
