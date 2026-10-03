import { describe, expect, it } from 'vitest';
import { PASSIVE_IDS } from '../../src/data/passives';
import { WEAPON_IDS } from '../../src/data/weapons';
import { WORKSHOP_BY_ID } from '../../src/data/workshop';
import { World } from '../../src/game/World';
import { checkAchievements } from '../../src/meta/achievements';
import { claimLoginReward, DAILY_REWARDS, ensureDaily, loginRewardState, questProgress } from '../../src/meta/daily';
import { applyRunResult } from '../../src/meta/progress';
import { defaultSave } from '../../src/meta/save';
import { buyNode, nodeAvailable, workshopBonuses } from '../../src/meta/workshop';

function world(): World {
  return new World({ mode: 'normal', sector: 'ram', character: 'spark', seed: 7, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
}

describe('workshop', () => {
  it('respects prerequisites and bits', () => {
    const s = defaultSave();
    expect(nodeAvailable(s, 'haste')).toBe(false);
    expect(buyNode(s, 'core_dmg')).toBe(false);
    s.bits = 10_000;
    expect(buyNode(s, 'core_dmg')).toBe(true);
    expect(s.bits).toBe(10_000 - WORKSHOP_BY_ID.core_dmg.costs[0]);
    expect(nodeAvailable(s, 'haste')).toBe(true);
    expect(workshopBonuses(s).might).toBeCloseTo(WORKSHOP_BY_ID.core_dmg.per);
  });

  it('caps at max level', () => {
    const s = defaultSave();
    s.bits = 1e9;
    buyNode(s, 'core_dmg');
    buyNode(s, 'area');
    for (let i = 0; i < 10; i++) buyNode(s, 'amount');
    expect(s.workshop.amount).toBe(1);
  });
});

describe('daily', () => {
  it('login streak grows and resets after a missed day', () => {
    const s = defaultSave();
    expect(claimLoginReward(s, 100)).toBe(DAILY_REWARDS[0]);
    expect(claimLoginReward(s, 100)).toBe(0);
    expect(claimLoginReward(s, 101)).toBe(DAILY_REWARDS[1]);
    expect(loginRewardState(s, 103).streakDay).toBe(1);
    expect(claimLoginReward(s, 103)).toBe(DAILY_REWARDS[0]);
  });

  it('cycles through 7 days', () => {
    const s = defaultSave();
    for (let d = 0; d < 7; d++) claimLoginReward(s, 200 + d);
    expect(claimLoginReward(s, 207)).toBe(DAILY_REWARDS[0]);
  });

  it('quests are deterministic per day and pay once', () => {
    const a = defaultSave();
    const b = defaultSave();
    ensureDaily(a, 555);
    ensureDaily(b, 555);
    expect(a.daily.questId).toBe(b.daily.questId);
    a.daily.questId = 'kills';
    const w = world();
    w.run.kills = 10_000;
    expect(questProgress(a, w)).toBeGreaterThan(0);
    expect(questProgress(a, w)).toBe(0);
  });
});

describe('achievements and run results', () => {
  it('unlocks the Volt character through kills_1000 once its stage is reached', () => {
    const s = defaultSave();
    s.sectorsCleared.push('ram');
    s.stats.kills = 1000;
    const got = checkAchievements(s, null, false);
    expect(got).toContain('kills_1000');
    expect(s.chars).toContain('volt');
    expect(checkAchievements(s, null, false)).toEqual([]);
  });

  it('applies a winning run: bits, sector unlock, endless unlock, codex', () => {
    const s = defaultSave();
    const w = world();
    w.t = 610;
    w.run.kills = 3000;
    w.run.bossKills = 1;
    w.seen.add('byte');
    const r = applyRunResult(s, w, true);
    expect(r.bits).toBeGreaterThan(0);
    expect(s.bits).toBeGreaterThanOrEqual(r.bits);
    expect(r.sectorUnlocked).toBe('cpu');
    expect(r.endlessUnlocked).toBe(true);
    expect(s.sectorsCleared).toContain('ram');
    expect(s.codex.e.byte).toBeDefined();
    expect(s.codex.w).toContain('pulse');
    expect(r.achievements).toContain('win_ram');
    expect(s.stats.runs).toBe(1);
  });

  it('a simulated run never throws and is deterministic', () => {
    const run = () => {
      const w = world();
      let guard = 0;
      while (w.t < 90 && guard++ < 10_000) {
        if (w.state === 'levelup') w.chooseCard(0);
        else if (w.state !== 'playing') break;
        w.input.x = Math.cos(w.t);
        w.input.y = Math.sin(w.t * 0.7);
        w.update(1 / 30);
      }
      return [w.run.kills, w.player.level, Math.round(w.player.hp)];
    };
    expect(run()).toEqual(run());
  });
});
