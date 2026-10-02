import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/save/save';
import { emptyStats } from '../../src/systems/Game';
import { applyRun, computeGlory, isMapUnlocked } from '../../src/systems/meta';
import { gloryForLevel, levelForGlory, mutatorMultiplier } from '../../src/data/perks';

describe('meta progression', () => {
  it('levels are monotonic', () => {
    for (let l = 1; l < 20; l++) expect(gloryForLevel(l + 1)).toBeGreaterThan(gloryForLevel(l));
    expect(levelForGlory(0)).toBe(1);
    expect(levelForGlory(gloryForLevel(5))).toBe(5);
  });

  it('even a lost run gives glory', () => {
    const g = computeGlory({ map: 'valley', endless: false, victory: false, nights: 2, stats: { ...emptyStats(), kills: 20 }, weapon: 'sword', mutators: [] });
    expect(g).toBeGreaterThan(0);
  });

  it('mutators multiply glory', () => {
    const base = { map: 'valley' as const, endless: false, victory: true, nights: 8, stats: emptyStats(), weapon: 'sword' as const };
    expect(computeGlory({ ...base, mutators: ['tough'] })).toBe(Math.round(computeGlory({ ...base, mutators: [] }) * 1.4));
    expect(mutatorMultiplier(['swift', 'tough'])).toBe(1.75);
  });

  it('victory unlocks the next map and records achievements', () => {
    const s = defaultSave();
    expect(isMapUnlocked(s, 'swamp')).toBe(false);
    const out = applyRun(s, { map: 'valley', endless: false, victory: true, nights: 8, stats: { ...emptyStats(), kills: 120, built: 9, bossKills: 1, castleMinHp: 0.9 }, weapon: 'sword', mutators: [] });
    expect(isMapUnlocked(s, 'swamp')).toBe(true);
    expect(out.mapUnlocked).toBe(true);
    expect(s.ach).toContain('win_valley');
    expect(s.ach).toContain('boss_slayer');
    expect(s.ach).toContain('flawless');
    expect(out.levelAfter).toBeGreaterThan(out.levelBefore);
  });

  it('endless updates the record', () => {
    const s = defaultSave();
    const out = applyRun(s, { map: 'valley', endless: true, victory: false, nights: 16, stats: emptyStats(), weapon: 'bow', mutators: [] });
    expect(out.record).toBe(true);
    expect(s.endlessBest).toBe(16);
    expect(s.ach).toContain('endless15');
  });
});
