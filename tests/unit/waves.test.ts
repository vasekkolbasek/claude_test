import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { ENEMIES } from '../../src/data/enemies';
import { SECTORS, SECTOR_IDS } from '../../src/data/sectors';
import { WAVES, WAVE_EVENTS } from '../../src/data/waves';
import { eventsBetween, hpMultAt, waveStateAt } from '../../src/game/director';
import type { WaveEvent } from '../../src/data/types';

describe('wave director', () => {
  it('density and spawn rate grow through the normal run', () => {
    let prevMin = 0;
    let prevRate = 0;
    for (let t = 0; t < BALANCE.bossTime; t += 15) {
      const s = waveStateAt(t, 'normal', SECTORS.ram);
      expect(s.min).toBeGreaterThanOrEqual(prevMin - 1e-9);
      expect(s.rate).toBeGreaterThanOrEqual(prevRate - 1e-9);
      expect(s.roster.length).toBeGreaterThan(0);
      prevMin = s.min;
      prevRate = s.rate;
    }
  });

  it('enemy HP scales up with time and in endless mode keeps growing', () => {
    expect(hpMultAt(300, 'normal')).toBeGreaterThan(hpMultAt(60, 'normal'));
    expect(hpMultAt(1200, 'endless')).toBeGreaterThan(hpMultAt(1200, 'normal'));
    expect(waveStateAt(1500, 'endless', SECTORS.ram).min).toBeGreaterThan(waveStateAt(700, 'endless', SECTORS.ram).min);
  });

  it('harder sectors are harder and pay more', () => {
    for (let i = 1; i < SECTOR_IDS.length; i++) {
      const a = SECTORS[SECTOR_IDS[i - 1]];
      const b = SECTORS[SECTOR_IDS[i]];
      expect(b.hpMult).toBeGreaterThan(a.hpMult);
      expect(b.bitsMult).toBeGreaterThan(a.bitsMult);
    }
  });

  it('every roster entry and event references a real enemy', () => {
    for (const seg of WAVES) for (const [id] of seg.roster) expect(ENEMIES[id]).toBeDefined();
    for (const e of WAVE_EVENTS) expect(ENEMIES[e.enemy]).toBeDefined();
  });

  it('two mini-bosses (the sector pair, in order) and then the final boss', () => {
    const out: WaveEvent[] = [];
    const all: WaveEvent[] = [];
    for (let t = 0; t < BALANCE.bossTime + 10; t += 0.5) all.push(...eventsBetween(t, t + 0.5, 'normal', out).slice());
    const minis = all.filter((e) => e.type === 'miniboss');
    expect(minis.map((e) => e.slot)).toEqual([0, 1]);
    expect(minis[1].at).toBeLessThan(BALANCE.bossTime);
    for (const id of SECTOR_IDS) {
      const pair = SECTORS[id].minibosses;
      expect(pair).toHaveLength(2);
      for (const mb of pair) expect(ENEMIES[mb].boss).toBe('mini');
    }
    // every mini-boss appears somewhere
    const used = new Set(SECTOR_IDS.flatMap((id) => SECTORS[id].minibosses));
    for (const mb of Object.values(ENEMIES).filter((e) => e.boss === 'mini')) expect(used.has(mb.id)).toBe(true);
    expect(all.filter((e) => e.type === 'boss').map((e) => e.at)).toEqual([BALANCE.bossTime]);
  });

  it('endless brings the Chaos Core back every boss interval', () => {
    const out: WaveEvent[] = [];
    let bosses = 0;
    for (let t = 0; t < BALANCE.bossTime * 3 + 30; t += 1) bosses += eventsBetween(t, t + 1, 'endless', out).filter((e) => e.type === 'boss').length;
    expect(bosses).toBe(3);
  });
});
