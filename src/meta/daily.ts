import type { World } from '../game/World';
import type { SaveData } from './save';

export const DAILY_REWARDS = [30, 40, 50, 60, 80, 100, 150];

export interface QuestDef {
  id: string;
  /** i18n key */
  key: string;
  target: (save: SaveData) => number;
  value: (w: World) => number;
  reward: number;
}

export const QUESTS: QuestDef[] = [
  { id: 'kills', key: 'quest.kills', target: (s) => (s.stats.runs < 5 ? 300 : s.sectorsCleared.length > 0 ? 1200 : 600), value: (w) => w.run.kills, reward: 80 },
  { id: 'survive', key: 'quest.survive', target: (s) => (s.stats.runs < 5 ? 4 : s.sectorsCleared.length > 0 ? 9 : 6), value: (w) => w.t / 60, reward: 90 },
  { id: 'level', key: 'quest.level', target: (s) => (s.stats.runs < 5 ? 12 : s.sectorsCleared.length > 0 ? 30 : 20), value: (w) => w.player.level, reward: 80 },
  { id: 'gems', key: 'quest.gems', target: (s) => (s.stats.runs < 5 ? 250 : 600), value: (w) => w.run.gems, reward: 70 },
  { id: 'miniboss', key: 'quest.miniboss', target: () => 1, value: (w) => w.run.miniBosses, reward: 120 },
  { id: 'elites', key: 'quest.elites', target: (s) => (s.stats.runs < 5 ? 3 : 8), value: (w) => w.run.elites, reward: 90 },
];

export function dayIndex(now: number): number {
  return Math.floor(now / 86_400_000);
}

/** Rolls today's quest if the day changed. */
export function ensureDaily(save: SaveData, day: number): void {
  const d = save.daily;
  if (d.questDay !== day) {
    d.questDay = day;
    d.questId = QUESTS[((day * 7919) >>> 0) % QUESTS.length].id;
    d.questDone = false;
  }
}

export function currentQuest(save: SaveData): QuestDef | null {
  return QUESTS.find((q) => q.id === save.daily.questId) ?? null;
}

/** Marks the quest done if this run satisfied it; returns the bits reward (0 if none). */
export function questProgress(save: SaveData, w: World): number {
  const q = currentQuest(save);
  if (!q || save.daily.questDone) return 0;
  if (q.value(w) >= q.target(save)) {
    save.daily.questDone = true;
    return q.reward;
  }
  return 0;
}

/** Whether the login reward can be claimed today, and which streak day it is (1..7). */
export function loginRewardState(save: SaveData, day: number): { can: boolean; streakDay: number } {
  const d = save.daily;
  if (d.lastClaim === day) return { can: false, streakDay: ((d.streak - 1) % 7) + 1 };
  const continues = d.lastClaim === day - 1;
  const streak = continues ? d.streak + 1 : 1;
  return { can: true, streakDay: ((streak - 1) % 7) + 1 };
}

export function claimLoginReward(save: SaveData, day: number): number {
  const st = loginRewardState(save, day);
  if (!st.can) return 0;
  const d = save.daily;
  d.streak = d.lastClaim === day - 1 ? d.streak + 1 : 1;
  d.lastClaim = day;
  const reward = DAILY_REWARDS[st.streakDay - 1];
  save.bits += reward;
  return reward;
}
