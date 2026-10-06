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

/**
 * Thresholds are tuned with the simulator (`npm run sim -- --ach`): the first run unlocks one or two,
 * the first sector win no more than four or five, the rest are spread over a long game.
 * Ids are kept from earlier versions (saves store them), so a few no longer match their numbers.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', reward: 250, icon: 'play', check: (c) => c.save.stats.runs >= 1 },
  { id: 'survive_3', reward: 250, icon: 'time', check: run((w) => w.t >= 240) },
  { id: 'survive_5', reward: 200, icon: 'time', check: run((w) => w.t >= 480) },
  { id: 'survive_8', reward: 300, icon: 'time', check: run((w) => w.t >= 720) },
  { id: 'win_ram', reward: 220, icon: 'star', check: (c) => c.save.sectorsCleared.includes('ram') },
  { id: 'win_cpu', reward: 250, icon: 'star', check: (c) => c.save.sectorsCleared.includes('cpu') },
  { id: 'win_gpu', reward: 350, icon: 'star', check: (c) => c.save.sectorsCleared.includes('gpu') },
  { id: 'win_bin', reward: 400, icon: 'star', check: (c) => c.save.sectorsCleared.includes('bin') },
  { id: 'kills_run_500', reward: 200, icon: 'kills', check: run((w) => w.run.kills >= 2500) },
  { id: 'kills_run_2000', reward: 300, icon: 'kills', check: run((w) => w.run.kills >= 20000) },
  { id: 'kills_1000', reward: 150, icon: 'kills', check: (c) => c.save.stats.kills >= 20000, progress: (c) => [c.save.stats.kills, 20000] },
  { id: 'kills_10000', reward: 300, icon: 'kills', check: (c) => c.save.stats.kills >= 75000, progress: (c) => [c.save.stats.kills, 75000] },
  { id: 'kills_50000', reward: 500, icon: 'kills', check: (c) => c.save.stats.kills >= 200000, progress: (c) => [c.save.stats.kills, 200000] },
  { id: 'level_10', reward: 220, icon: 'growth', check: run((w) => w.player.level >= 20) },
  { id: 'level_25', reward: 200, icon: 'growth', check: run((w) => w.player.level >= 45) },
  { id: 'level_40', reward: 350, icon: 'growth', check: run((w) => w.player.level >= 50) },
  {
    id: 'evolve_1',
    reward: 200,
    icon: 'star',
    check: (c) => EVOLUTION_IDS.filter((id) => c.save.codex.w.includes(id)).length >= 3,
    progress: (c) => [EVOLUTION_IDS.filter((id) => c.save.codex.w.includes(id)).length, 3],
  },
  { id: 'evolve_3', reward: 350, icon: 'star', check: run((w) => w.run.evolutions.length >= 4) },
  {
    id: 'evolve_all',
    reward: 400,
    icon: 'star',
    check: (c) => EVOLUTION_IDS.every((id) => c.save.codex.w.includes(id)),
    progress: (c) => [EVOLUTION_IDS.filter((id) => c.save.codex.w.includes(id)).length, EVOLUTION_IDS.length],
  },
  { id: 'mb_1', reward: 150, icon: 'achievements', check: (c) => c.save.stats.miniBosses >= 8, progress: (c) => [c.save.stats.miniBosses, 8] },
  { id: 'mb_all3', reward: 250, icon: 'achievements', check: run((w) => w.run.miniBosses >= 4) },
  { id: 'boss_1', reward: 250, icon: 'leaders', check: (c) => c.save.stats.bossKills >= 5, progress: (c) => [c.save.stats.bossKills, 5] },
  { id: 'elites_50', reward: 150, icon: 'crit', check: (c) => c.save.stats.elites >= 300, progress: (c) => [c.save.stats.elites, 300] },
  { id: 'nohit_60', reward: 250, icon: 'armor', check: run((w) => w.run.maxNoHit >= 100) },
  { id: 'nohit_180', reward: 200, icon: 'armor', check: run((w) => w.run.maxNoHit >= 180) },
  { id: 'revive_1', reward: 100, icon: 'heal', check: (c) => c.save.stats.revives >= 3, progress: (c) => [c.save.stats.revives, 3] },
  { id: 'chars_3', reward: 100, icon: 'characters', check: (c) => c.save.chars.length >= 3, progress: (c) => [c.save.chars.length, 3] },
  {
    id: 'chars_all',
    reward: 250,
    icon: 'characters',
    check: (c) => c.save.chars.length >= CHARACTER_IDS.length,
    progress: (c) => [c.save.chars.length, CHARACTER_IDS.length],
  },
  { id: 'workshop_10', reward: 150, icon: 'workshop', check: (c) => c.workshopLevels >= 15, progress: (c) => [c.workshopLevels, 15] },
  { id: 'workshop_30', reward: 400, icon: 'workshop', check: (c) => c.workshopLevels >= 40, progress: (c) => [c.workshopLevels, 40] },
  { id: 'bits_5000', reward: 300, icon: 'bits', check: (c) => c.save.stats.bitsEarned >= 10000, progress: (c) => [c.save.stats.bitsEarned, 10000] },
  { id: 'runs_10', reward: 100, icon: 'play', check: (c) => c.save.stats.runs >= 10, progress: (c) => [c.save.stats.runs, 10] },
  { id: 'runs_50', reward: 300, icon: 'play', check: (c) => c.save.stats.runs >= 50, progress: (c) => [c.save.stats.runs, 50] },
  { id: 'endless_15', reward: 400, icon: 'time', check: (c) => c.save.bestEndless >= 900 },
  { id: 'daily_3', reward: 200, icon: 'daily', check: (c) => c.save.stats.dailyQuests >= 7, progress: (c) => [c.save.stats.dailyQuests, 7] },
  { id: 'gems_5000', reward: 200, icon: 'growth', check: (c) => c.save.stats.gems >= 20000, progress: (c) => [c.save.stats.gems, 20000] },
  { id: 'full_build', reward: 150, icon: 'amount', check: run((w) => w.weapons.length >= 6) },
  {
    id: 'codex_enemies',
    reward: 200,
    icon: 'codex',
    check: (c) => CODEX_ENEMIES.every((id) => c.save.codex.e[id] !== undefined),
    progress: (c) => [CODEX_ENEMIES.filter((id) => c.save.codex.e[id] !== undefined).length, CODEX_ENEMIES.length],
  },
];
