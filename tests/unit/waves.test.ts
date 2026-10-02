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

  it('mini-bosses every 3 minutes and the final boss at 10:00', () => {
    const out: WaveEvent[] = [];
    const all: WaveEvent[] = [];
    for (let t = 0; t < 610; t += 0.5) all.push(...eventsBetween(t, t + 0.5, 'normal', out).slice());
    const minis = all.filter((e) => e.type === 'miniboss').map((e) => e.at);
    expect(minis).toEqual(BALANCE.miniBossTimes);
    expect(all.filter((e) => e.type === 'boss').map((e) => e.at)).toEqual([BALANCE.bossTime]);
  });

  it('endless brings the Chaos Core back every 10 minutes', () => {
    const out: WaveEvent[] = [];
    let bosses = 0;
    for (let t = 0; t < 1830; t += 1) bosses += eventsBetween(t, t + 1, 'endless', out).filter((e) => e.type === 'boss').length;
    expect(bosses).toBe(3);
  });
});
