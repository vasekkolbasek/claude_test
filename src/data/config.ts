/** Global tunables and platform configuration. */
export const CONFIG = {
  /** Leaderboard technical name — must be created in the Yandex Games console. */
  leaderboardName: 'endlessNights',
  saveVersion: 2,
  saveDebounceMs: 2500,
  /** Minimum time between interstitials (the platform also enforces its own limit). */
  interstitialCooldownMs: 65000,
  hero: { hp: 220, speed: 8.2, regen: 14, regenDelay: 3, respawn: 7, radius: 0.7, buildRadius: 2.6 },
  build: { secondsPerCoin: 0.09, minHold: 0.45, maxHold: 1.4 },
  economy: { castleIncome: 3, cleanBonus: 2, startCoins: 8 },
  dawnSeconds: 3.2,
  duskSeconds: 2.2,
  rewardCoins: 5,
  maxUnits: 260,
} as const;
