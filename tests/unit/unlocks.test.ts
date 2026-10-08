import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, CHARACTERS } from '../../src/data/characters';
import { PASSIVE_IDS } from '../../src/data/passives';
import { EVOLUTIONS, WEAPON_IDS, WEAPONS } from '../../src/data/weapons';
import { checkAchievements } from '../../src/meta/achievements';
import { defaultSave } from '../../src/meta/save';
import {
  UNLOCK_STAGES,
  charAvailable,
  charStage,
  passivePoolFor,
  passiveStage,
  unlockStage,
  unlocksBetween,
  weaponPoolFor,
  weaponStage,
} from '../../src/meta/unlocks';

describe('progressive unlocks', () => {
  it('covers every weapon, module and character exactly once', () => {
    const w = UNLOCK_STAGES.flatMap((s) => s.weapons);
    const p = UNLOCK_STAGES.flatMap((s) => s.passives);
    const c = UNLOCK_STAGES.flatMap((s) => s.chars);
    expect([...w].sort()).toEqual([...WEAPON_IDS].sort());
    expect([...p].sort()).toEqual([...PASSIVE_IDS].sort());
    expect([...c].sort()).toEqual([...CHARACTER_IDS].sort());
  });

  it('a character is never available before its weapon, except the ad character who brings it along', () => {
    for (const id of CHARACTER_IDS) {
      const cs = UNLOCK_STAGES.indexOf(charStage(id));
      if (CHARACTERS[id].unlock.type === 'ads') continue;
      expect(UNLOCK_STAGES.indexOf(weaponStage(CHARACTERS[id].weapon))).toBeLessThanOrEqual(cs);
    }
    // Volt (rewarded videos, available from the start) adds chain lightning to the run's pool
    const s = defaultSave();
    s.chars.push('volt');
    s.char = 'volt';
    expect(weaponPoolFor(s)).toContain('chain');
  });

  it('allows at least one evolution from the start', () => {
    const s = defaultSave();
    const w = weaponPoolFor(s);
    const p = passivePoolFor(s);
    expect(w.some((id) => p.includes(EVOLUTIONS[WEAPONS[id].evolution].passive))).toBe(true);
  });

  it('opens content stage by stage and everything by the fourth sector', () => {
    const s = defaultSave();
    expect(unlockStage(s)).toBe(1);
    expect(weaponPoolFor(s)).toEqual(['pulse', 'orbit', 'laser']);
    expect(passivePoolFor(s)).toHaveLength(6);
    expect(charAvailable(s, 'sentinel')).toBe(true); // for rewarded ads from the start
    expect(charAvailable(s, 'volt')).toBe(false);
    s.stats.miniBosses = 1;
    expect(unlockStage(s)).toBe(2);
    s.sectorsCleared.push('ram', 'cpu', 'gpu');
    expect(unlockStage(s)).toBe(UNLOCK_STAGES.length);
    expect(weaponPoolFor(s).sort()).toEqual([...WEAPON_IDS].sort());
    expect(passivePoolFor(s).sort()).toEqual([...PASSIVE_IDS].sort());
    expect(unlocksBetween(1, 2).weapons).toEqual(['chain', 'shockwave']);
  });

  it('keeps the selected character weapon in the pool', () => {
    const s = defaultSave();
    s.chars.push('hunter');
    s.char = 'hunter';
    expect(weaponPoolFor(s)).toContain('missiles');
    expect(passiveStage('amount').req).toBe('gpu');
  });

  it('sector characters become purchasable when their sector is cleared', () => {
    const s = defaultSave();
    expect(charAvailable(s, 'volt')).toBe(false);
    s.sectorsCleared.push('ram');
    expect(charAvailable(s, 'volt')).toBe(true);
    expect(charAvailable(s, 'sapper')).toBe(false);
    checkAchievements(s, null, false);
    expect(s.chars).toEqual(['spark']); // never granted for free
  });
});
