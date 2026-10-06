import { describe, expect, it } from 'vitest';
import { ENEMY_IDS, ENEMY_SECTOR, enemyFor, enemyInSector } from '../../src/data/enemies';
import { SECTORS, SECTOR_IDS } from '../../src/data/sectors';
import { WAVES, WAVE_EVENTS } from '../../src/data/waves';
import { waveStateAt } from '../../src/game/director';
import { FEATURES, featureNew, featureOpen, freshFeatures, markSeen } from '../../src/meta/features';
import { defaultSave, migrate } from '../../src/meta/save';

describe('enemies by sector', () => {
  it('RAM only has the basic viruses; Корзина has every one', () => {
    const seen = (sector: (typeof SECTOR_IDS)[number]) => {
      const set = new Set<string>();
      for (let t = 0; t <= 360; t += 5) for (const [id] of waveStateAt(t, 'normal', SECTORS[sector]).roster) set.add(id);
      return set;
    };
    const ram = seen('ram');
    for (const id of ram) expect(enemyInSector(id as never, 'ram')).toBe(true);
    expect(ram.has('sniper')).toBe(false);
    const bin = seen('bin');
    for (const id of Object.keys(ENEMY_SECTOR).filter((x) => !x.startsWith('mb_'))) expect(bin.has(id)).toBe(true);
    // each later sector brings something new
    for (let i = 1; i < SECTOR_IDS.length; i++) expect(seen(SECTOR_IDS[i]).size).toBeGreaterThan(seen(SECTOR_IDS[i - 1]).size);
  });

  it('scripted events always resolve to a virus the sector has', () => {
    for (const sector of SECTOR_IDS) for (const e of WAVE_EVENTS) expect(enemyInSector(enemyFor(e.enemy, sector), sector)).toBe(true);
    for (const id of ENEMY_IDS) expect(ENEMY_IDS).toContain(enemyFor(id, 'ram'));
  });

  it('every new virus is used by the wave script', () => {
    const used = new Set(WAVES.flatMap((w) => w.roster.map(([id]) => id)));
    for (const id of Object.keys(ENEMY_SECTOR).filter((x) => !x.startsWith('mb_'))) expect(used.has(id as never)).toBe(true);
  });
});

describe('progressive menu', () => {
  it('a new player sees only «Играть», features open one by one', () => {
    const s = defaultSave();
    expect(FEATURES.filter((f) => featureOpen(s, f.id))).toHaveLength(0);
    s.stats.runs = 1;
    expect(featureOpen(s, 'workshop')).toBe(true);
    expect(featureOpen(s, 'characters')).toBe(false);
    expect(featureNew(s, 'workshop')).toBe(true);
    expect(markSeen(s, 'workshop')).toBe(true);
    expect(featureNew(s, 'workshop')).toBe(false);
    s.stats.runs = 10;
    expect(featureOpen(s, 'leaders')).toBe(false);
    s.endlessUnlocked = true;
    expect(featureOpen(s, 'leaders')).toBe(true);
  });

  it('achievements open with the workshop after run 1, codex with characters after run 2, daily after run 3', () => {
    const s = defaultSave();
    const open = () => FEATURES.filter((f) => featureOpen(s, f.id)).map((f) => f.id);
    s.stats.runs = 1;
    expect(open()).toEqual(['workshop', 'achievements']);
    s.stats.runs = 2;
    expect(open()).toEqual(['workshop', 'achievements', 'characters', 'codex']);
    s.stats.runs = 3;
    expect(open()).toEqual(['workshop', 'achievements', 'characters', 'codex', 'daily', 'chest']);
    s.stats.runs = 10;
    expect(open()).not.toContain('leaders');
  });

  it('the menu hint lists every new feature at once', () => {
    const s = defaultSave();
    s.stats.runs = 1;
    expect(freshFeatures(s)).toEqual(['workshop', 'achievements']);
    markSeen(s, 'achievements');
    expect(freshFeatures(s)).toEqual(['workshop']);
    s.stats.runs = 2;
    markSeen(s, 'workshop');
    expect(freshFeatures(s)).toEqual(['characters', 'codex']);
  });

  it('a feature the player already visited never disappears when the schedule moves it', () => {
    const s = defaultSave();
    s.stats.runs = 3;
    s.seen = ['achievements'];
    expect(featureOpen(s, 'achievements')).toBe(true);
    expect(featureNew(s, 'achievements')).toBe(false);
  });

  it('existing players do not get a wall of «NEW» badges after the update', () => {
    const m = migrate({ v: 2, stats: { runs: 20 }, endlessUnlocked: true });
    for (const f of FEATURES) expect(featureNew(m, f.id)).toBe(false);
    expect(migrate({ v: 3, stats: { runs: 20 }, seen: [] }).seen).toEqual([]);
  });
});
