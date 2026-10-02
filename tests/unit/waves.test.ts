import { describe, expect, it } from 'vitest';
import { MAPS, MAP_IDS } from '../../src/data/maps';
import { UNITS } from '../../src/data/units';
import { generateWave, isBossNight, spawnSchedule, waveBudget } from '../../src/systems/waves';

describe('wave generator', () => {
  it('is deterministic for the same seed', () => {
    const a = generateWave(MAPS.valley, 5, 42);
    const b = generateWave(MAPS.valley, 5, 42);
    expect(JSON.stringify(a.groups)).toBe(JSON.stringify(b.groups));
  });

  it('budget grows night over night on every map', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      for (let n = 2; n <= m.nights + 5; n++) expect(waveBudget(m, n)).toBeGreaterThanOrEqual(waveBudget(m, n - 1));
    }
  });

  it('only uses unlocked units and active paths', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      for (let n = 1; n <= m.nights; n++) {
        const w = generateWave(m, n, 7);
        const allowed = new Set(m.roster.filter((r) => r.from <= n).map((r) => r.unit));
        for (const g of w.groups) {
          if (UNITS[g.unit].boss) continue;
          expect(allowed.has(g.unit)).toBe(true);
          expect(m.schedule[n - 1]).toContain(g.path);
        }
      }
    }
  });

  it('spends close to the budget', () => {
    const m = MAPS.swamp;
    for (let n = 1; n <= m.nights - 1; n++) {
      const w = generateWave(m, n, 3);
      const spent = w.groups.reduce((s, g) => s + UNITS[g.unit].threat * g.count, 0);
      expect(spent).toBeGreaterThanOrEqual(w.budget * 0.7);
      expect(spent).toBeLessThanOrEqual(w.budget * 1.15 + 1);
    }
  });

  it('final night has the boss, endless adds bosses every 5 nights', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      const w = generateWave(m, m.nights, 1);
      expect(w.boss).toBe(m.boss);
      expect(w.groups.some((g) => g.unit === m.boss)).toBe(true);
      expect(isBossNight(m, m.nights + 5, true)).toBe(true);
      expect(isBossNight(m, m.nights + 3, true)).toBe(false);
    }
  });

  it('endless nights keep scaling health', () => {
    const m = MAPS.valley;
    const w = generateWave(m, m.nights + 10, 1, true);
    expect(w.hpMul).toBeGreaterThan(1);
    expect(w.paths.length).toBe(m.paths.length);
  });

  it('schedule is sorted by time and preview counts match', () => {
    const w = generateWave(MAPS.pass, 9, 11);
    const s = spawnSchedule(w);
    for (let i = 1; i < s.length; i++) expect(s[i].t).toBeGreaterThanOrEqual(s[i - 1].t);
    let total = 0;
    for (const m of w.preview.values()) for (const c of m.values()) total += c;
    expect(total).toBe(s.length);
  });
});
