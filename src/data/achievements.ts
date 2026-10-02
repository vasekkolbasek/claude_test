/** Achievement ids; conditions are evaluated in systems/achievements.ts. */
export const ACHIEVEMENTS = [
  'first_build', 'first_night', 'win_valley', 'win_swamp', 'win_pass',
  'boss_slayer', 'clean5', 'kills500', 'kills5000', 'builder100',
  'full_upgrade', 'rich50', 'hero50', 'army20', 'income15',
  'mutator_win', 'mutator3_win', 'endless15', 'endless25', 'level5',
  'level10', 'all_weapons', 'ability100', 'flawless',
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];
