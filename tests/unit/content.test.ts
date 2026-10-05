import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { xpForLevel } from '../../src/data/balance';
import { CHARACTERS, CHARACTER_IDS } from '../../src/data/characters';
import { ENEMIES, ENEMY_IDS } from '../../src/data/enemies';
import { PASSIVES, PASSIVE_IDS } from '../../src/data/passives';
import { SECTOR_IDS } from '../../src/data/sectors';
import { EVOLUTIONS, EVOLUTION_IDS, WEAPONS, WEAPON_IDS } from '../../src/data/weapons';
import { WORKSHOP, WORKSHOP_BY_ID } from '../../src/data/workshop';
import { ALL_DICTS, resolveLang } from '../../src/i18n';

describe('content requirements', () => {
  it('has the minimum content counts from the design brief', () => {
    expect(WEAPON_IDS.length).toBeGreaterThanOrEqual(8);
    expect(PASSIVE_IDS.length).toBeGreaterThanOrEqual(10);
    expect(EVOLUTION_IDS.length).toBeGreaterThanOrEqual(4);
    const regular = ENEMY_IDS.filter((id) => !ENEMIES[id].boss);
    expect(regular.length).toBeGreaterThanOrEqual(12);
    expect(ENEMY_IDS.filter((id) => ENEMIES[id].boss === 'mini')).toHaveLength(5);
    expect(ENEMY_IDS.filter((id) => ENEMIES[id].boss === 'final')).toHaveLength(1);
    expect(SECTOR_IDS).toHaveLength(4);
    expect(CHARACTER_IDS.length).toBeGreaterThanOrEqual(5);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(WORKSHOP.length).toBeGreaterThanOrEqual(15);
  });

  it('weapons have 5 non-decreasing damage levels and a valid evolution', () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.levels).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(w.levels[i].dmg).toBeGreaterThanOrEqual(w.levels[i - 1].dmg);
      const evo = EVOLUTIONS[w.evolution];
      expect(evo.from).toBe(id);
      expect(PASSIVES[evo.passive]).toBeDefined();
      expect(evo.stats.dmg).toBeGreaterThan(w.levels[4].dmg);
    }
  });

  it('evolution recipes use distinct passives', () => {
    const used = EVOLUTION_IDS.map((id) => EVOLUTIONS[id].passive);
    expect(new Set(used).size).toBe(used.length);
  });

  it('xp curve is strictly increasing', () => {
    for (let l = 1; l < 80; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });

  it('workshop prerequisites exist and costs grow', () => {
    for (const n of WORKSHOP) {
      if (n.requires) expect(WORKSHOP_BY_ID[n.requires]).toBeDefined();
      expect(n.costs).toHaveLength(n.max);
      for (let i = 1; i < n.costs.length; i++) expect(n.costs[i]).toBeGreaterThan(n.costs[i - 1]);
    }
  });

  it('characters: one free, one for rewarded ads, the rest for bits', () => {
    const types = CHARACTER_IDS.map((id) => CHARACTERS[id].unlock.type);
    expect(types.filter((x) => x === 'free')).toHaveLength(1);
    expect(types.filter((x) => x === 'ads')).toHaveLength(1);
    for (const id of CHARACTER_IDS) {
      const u = CHARACTERS[id].unlock;
      if (u.type === 'bits') expect(u.cost).toBeGreaterThan(0);
      if (u.type === 'ads') expect(u.count).toBeGreaterThan(0);
    }
  });
});

describe('localization', () => {
  const langs = Object.keys(ALL_DICTS) as (keyof typeof ALL_DICTS)[];

  it('all languages share exactly the same keys', () => {
    const base = Object.keys(ALL_DICTS.ru).sort();
    for (const l of langs) expect(Object.keys(ALL_DICTS[l]).sort()).toEqual(base);
  });

  it('placeholders match across languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(ALL_DICTS.ru)) {
      for (const l of langs) expect(vars(ALL_DICTS[l][k]), `${l}:${k}`).toBe(vars(ALL_DICTS.ru[k]));
    }
  });

  it('every content id has a name in every language', () => {
    const keys = [
      ...WEAPON_IDS.flatMap((id) => [`w.${id}`, `w.${id}.desc`]),
      ...EVOLUTION_IDS.flatMap((id) => [`w.${id}`, `w.${id}.desc`]),
      ...PASSIVE_IDS.flatMap((id) => [`p.${id}`, `p.${id}.desc`]),
      ...ENEMY_IDS.flatMap((id) => [`e.${id}`, `e.${id}.desc`]),
      ...SECTOR_IDS.flatMap((id) => [`s.${id}`, `s.${id}.mod`]),
      ...CHARACTER_IDS.flatMap((id) => [`c.${id}`, `c.${id}.desc`, `c.${id}.bonus`]),
      ...ACHIEVEMENTS.flatMap((a) => [`a.${a.id}`, `a.${a.id}.desc`]),
      ...WORKSHOP.flatMap((n) => [`ws.${n.id}`, `ws.${n.id}.desc`]),
    ];
    for (const l of langs) for (const k of keys) expect(ALL_DICTS[l][k], `${l}:${k}`).toBeTruthy();
  });

  it('maps platform languages with the documented fallbacks', () => {
    expect(resolveLang('ru')).toBe('ru');
    expect(resolveLang('uk')).toBe('ru');
    expect(resolveLang('kk')).toBe('ru');
    expect(resolveLang('be')).toBe('ru');
    expect(resolveLang('uz')).toBe('ru');
    expect(resolveLang('tr')).toBe('tr');
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('de')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
  });
});
