import type { SaveData } from '../meta/save';
import type { World } from '../game/World';
import { CHARACTER_IDS } from './characters';
import { CODEX_ENEMIES } from './enemies';
import { EVOLUTION_IDS } from './weapons';

export interface AchCtx {
  save: SaveData;
  /** present when evaluated at the end of a run */
  w: World | null;
  won: boolean;
  workshopLevels: number;
}

export interface AchievementDef {
  id: string;
  reward: number;
  icon: string;
  check: (c: AchCtx) => boolean;
  /** progress for the UI: [current, target] */
  progress?: (c: AchCtx) => [number, number];
}

const run = (fn: (w: World, won: boolean) => boolean) => (c: AchCtx) => (c.w ? fn(c.w, c.won) : false);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', reward: 20, icon: 'play', check: (c) => c.save.stats.runs >= 1 },
  { id: 'survive_3', reward: 30, icon: 'time', check: run((w) => w.t >= 120) },
  { id: 'survive_5', reward: 50, icon: 'time', check: run((w) => w.t >= 210) },
  { id: 'survive_8', reward: 80, icon: 'time', check: run((w) => w.t >= 300) },
  { id: 'win_ram', reward: 150, icon: 'star', check: (c) => c.save.sectorsCleared.includes('ram') },
  { id: 'win_cpu', reward: 200, icon: 'star', check: (c) => c.save.sectorsCleared.includes('cpu') },
  { id: 'win_gpu', reward: 250, icon: 'star', check: (c) => c.save.sectorsCleared.includes('gpu') },
  { id: 'win_bin', reward: 300, icon: 'star', check: (c) => c.save.sectorsCleared.includes('bin') },
  { id: 'kills_run_500', reward: 60, icon: 'kills', check: run((w) => w.run.kills >= 500) },
  { id: 'kills_run_2000', reward: 120, icon: 'kills', check: run((w) => w.run.kills >= 2000) },
  { id: 'kills_1000', reward: 50, icon: 'kills', check: (c) => c.save.stats.kills >= 1000, progress: (c) => [c.save.stats.kills, 1000] },
  { id: 'kills_10000', reward: 150, icon: 'kills', check: (c) => c.save.stats.kills >= 10000, progress: (c) => [c.save.stats.kills, 10000] },
  { id: 'kills_50000', reward: 300, icon: 'kills', check: (c) => c.save.stats.kills >= 50000, progress: (c) => [c.save.stats.kills, 50000] },
  { id: 'level_10', reward: 30, icon: 'growth', check: run((w) => w.player.level >= 10) },
  { id: 'level_25', reward: 80, icon: 'growth', check: run((w) => w.player.level >= 25) },
  { id: 'level_40', reward: 150, icon: 'growth', check: run((w) => w.player.level >= 40) },
  { id: 'evolve_1', reward: 80, icon: 'star', check: (c) => c.save.stats.evolutions >= 1 },
  { id: 'evolve_3', reward: 200, icon: 'star', check: run((w) => w.run.evolutions.length >= 3) },
  {
    id: 'evolve_all',
    reward: 400,
    icon: 'star',
    check: (c) => EVOLUTION_IDS.every((id) => c.save.codex.w.includes(id)),
    progress: (c) => [EVOLUTION_IDS.filter((id) => c.save.codex.w.includes(id)).length, EVOLUTION_IDS.length],
  },
  { id: 'mb_1', reward: 50, icon: 'achievements', check: (c) => c.save.stats.miniBosses >= 1 },
  { id: 'mb_all3', reward: 120, icon: 'achievements', check: run((w) => w.run.miniBosses >= 3) },
  { id: 'boss_1', reward: 100, icon: 'leaders', check: (c) => c.save.stats.bossKills >= 1 },
  { id: 'elites_50', reward: 80, icon: 'crit', check: (c) => c.save.stats.elites >= 50, progress: (c) => [c.save.stats.elites, 50] },
  { id: 'nohit_60', reward: 60, icon: 'armor', check: run((w) => w.run.maxNoHit >= 60) },
  { id: 'nohit_180', reward: 150, icon: 'armor', check: run((w) => w.run.maxNoHit >= 120) },
  { id: 'revive_1', reward: 30, icon: 'heal', check: (c) => c.save.stats.revives >= 1 },
  { id: 'chars_3', reward: 100, icon: 'characters', check: (c) => c.save.chars.length >= 3, progress: (c) => [c.save.chars.length, 3] },
  {
    id: 'chars_all',
    reward: 250,
    icon: 'characters',
    check: (c) => c.save.chars.length >= CHARACTER_IDS.length,
    progress: (c) => [c.save.chars.length, CHARACTER_IDS.length],
  },
  { id: 'workshop_10', reward: 100, icon: 'workshop', check: (c) => c.workshopLevels >= 10, progress: (c) => [c.workshopLevels, 10] },
  { id: 'workshop_30', reward: 300, icon: 'workshop', check: (c) => c.workshopLevels >= 30, progress: (c) => [c.workshopLevels, 30] },
  { id: 'bits_5000', reward: 150, icon: 'bits', check: (c) => c.save.stats.bitsEarned >= 5000, progress: (c) => [c.save.stats.bitsEarned, 5000] },
  { id: 'runs_10', reward: 80, icon: 'play', check: (c) => c.save.stats.runs >= 10, progress: (c) => [c.save.stats.runs, 10] },
  { id: 'runs_50', reward: 250, icon: 'play', check: (c) => c.save.stats.runs >= 50, progress: (c) => [c.save.stats.runs, 50] },
  { id: 'endless_15', reward: 200, icon: 'time', check: (c) => c.save.bestEndless >= 600 },
  { id: 'daily_3', reward: 100, icon: 'daily', check: (c) => c.save.stats.dailyQuests >= 3, progress: (c) => [c.save.stats.dailyQuests, 3] },
  { id: 'gems_5000', reward: 80, icon: 'growth', check: (c) => c.save.stats.gems >= 5000, progress: (c) => [c.save.stats.gems, 5000] },
  { id: 'full_build', reward: 100, icon: 'amount', check: run((w) => w.weapons.length >= 6) },
  {
    id: 'codex_enemies',
    reward: 200,
    icon: 'codex',
    check: (c) => CODEX_ENEMIES.every((id) => c.save.codex.e[id] !== undefined),
    progress: (c) => [CODEX_ENEMIES.filter((id) => c.save.codex.e[id] !== undefined).length, CODEX_ENEMIES.length],
  },
];
