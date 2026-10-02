/** Deployment configuration. See RELEASE.md for the console-side setup. */
export const CONFIG = {
  /** Technical name of the Yandex Games leaderboard (create it in the console, type "time"). */
  leaderboard: 'endlessTime',
  /** Our own floor for interstitial frequency (the platform also throttles). */
  interstitialMinGapMs: 65_000,
  /** No interstitials until the player has finished this many runs. */
  interstitialMinRuns: 2,
  /** Free menu chest cooldown. */
  chestCooldownMs: 10 * 60 * 1000,
} as const;
