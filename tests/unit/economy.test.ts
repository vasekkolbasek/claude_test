import { describe, expect, it } from 'vitest';
import { BNODES } from '../../src/data/buildings';
import { CONFIG } from '../../src/data/config';
import { Game } from '../../src/systems/Game';

const mk = (over: Partial<ConstructorParameters<typeof Game>[0]> = {}) =>
  new Game({ map: 'valley', weapon: 'sword', perks: [], mutators: [], endless: false, seed: 1, ...over });

/** Runs the night instantly by removing enemies. */
function clearNight(g: Game): void {
  g.startNight();
  for (let i = 0; i < 4000 && g.phase === 'night'; i++) {
    for (const u of g.units) if (u.team === 1) u.alive = false;
    g.update(0.05);
  }
}

describe('economy', () => {
  it('starts with map coins and perk bonus', () => {
    expect(mk().coins).toBe(10);
    expect(mk({ perks: ['purse'] }).coins).toBe(14);
  });

  it('pays castle income + clean bonus at dawn', () => {
    const g = mk();
    const before = g.coins;
    clearNight(g);
    expect(g.phase).toBe('dawn');
    expect(g.coins - before).toBe(CONFIG.economy.castleIncome + CONFIG.economy.cleanBonus);
    expect(g.lastIncome?.clean).toBe(true);
  });

  it('economic buildings add income; destroyed ones do not', () => {
    const g = mk();
    const farm = g.bySlot.get('farm1')!;
    g.applyNode(farm, BNODES.farm);
    const mine = g.bySlot.get('mine1')!;
    g.applyNode(mine, BNODES.mine);
    g.startNight();
    mine.ruined = true;
    mine.lostThisNight = true;
    const before = g.coins;
    for (let i = 0; i < 4000 && g.phase === 'night'; i++) {
      for (const u of g.units) if (u.team === 1) u.alive = false;
      g.update(0.05);
    }
    // castle + farm, no clean bonus because the mine fell
    expect(g.coins - before).toBe(BNODES.castle.stats.income! + BNODES.farm.stats.income!);
    expect(mine.ruined).toBe(false); // repaired at dawn
  });

  it('poverty mutator reduces income and tithe perk adds a coin', () => {
    const g = mk({ mutators: ['poverty'], perks: ['tithe'] });
    const before = g.coins;
    clearNight(g);
    // floor(castle*0.7) + clean bonus + tithe 1
    expect(g.coins - before).toBe(Math.floor(BNODES.castle.stats.income! * 0.7) + CONFIG.economy.cleanBonus + 1);
  });

  it('advances to the next day after dawn and to victory after the last night', () => {
    const g = mk();
    clearNight(g);
    for (let i = 0; i < 200 && g.phase === 'dawn'; i++) g.update(0.05);
    expect(g.phase).toBe('day');
    expect(g.night).toBe(2);
    g.night = g.map.nights;
    clearNight(g);
    for (let i = 0; i < 200 && g.phase === 'dawn'; i++) g.update(0.05);
    expect(g.phase).toBe('victory');
  });
});
