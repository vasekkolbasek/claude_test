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

  it('the daily quest does not pay out before the player can see it', () => {
    const s = defaultSave();
    s.daily.questId = 'kills';
    const w = world();
    w.run.kills = 10_000;
    s.stats.runs = 2; // this run is the 3rd: the quest card was not in the menu before it
    expect(applyRunResult(s, w, false).questReward).toBe(0);
    expect(s.daily.questDone).toBe(false);
    expect(applyRunResult(s, w, false).questReward).toBeGreaterThan(0);
  });
});

describe('achievements and run results', () => {
  it('grants kills_1000 once (characters are no longer achievement rewards)', () => {
    const s = defaultSave();
    s.stats.kills = 20_000;
    const got = checkAchievements(s, null, false);
    expect(got).toContain('kills_1000');
    expect(s.chars).toEqual(['spark']);
    expect(checkAchievements(s, null, false)).toEqual([]);
  });

  it('a typical first run gives one or two achievements, the first win no more than five', () => {
    const s = defaultSave();
    const w = world();
    // a fair first run: 4:20, ~1800 kills, level 15, one mini-boss, a revive, 80 s without a hit
    w.t = 260;
    w.run.kills = 1800;
    w.player.level = 15;
    w.run.miniBosses = 1;
    w.run.revives = 1;
    w.run.maxNoHit = 80;
    const first = applyRunResult(s, w, false).achievements;
    expect(first).toEqual(['first_run', 'survive_3']);
    // the first win a few runs later: ~7:25, 11 000 kills, level 38, both mini-bosses
    s.stats.runs = 3;
    s.stats.kills = 4000;
    const win = world();
    win.t = 445;
    win.run.kills = 11_000;
    win.player.level = 38;
    win.run.miniBosses = 2;
    win.run.bossKills = 1;
    win.run.maxNoHit = 95;
    const got = applyRunResult(s, win, true).achievements;
    expect(got.length).toBeLessThanOrEqual(5);
    expect(got).toContain('win_ram');
  });

  it('achievements earned under the old, easier thresholds are kept', () => {
    const s = defaultSave();
    s.ach = { level_10: 1, mb_1: 2 };
    s.stats.kills = 0;
    checkAchievements(s, null, false);
    expect(s.ach.level_10).toBe(1);
    expect(s.ach.mb_1).toBe(2);
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
