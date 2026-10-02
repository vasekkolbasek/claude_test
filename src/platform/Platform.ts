export interface LeaderboardEntry { rank: number; name: string; score: number; me: boolean }
export interface LeaderboardResult { entries: LeaderboardEntry[]; player: LeaderboardEntry | null; authorized: boolean }

/** Everything the game needs from the hosting platform. */
export interface Platform {
  readonly id: 'yandex' | 'local';
  init(): Promise<void>;
  /** Raw language code reported by the platform (e.g. "ru", "en", "tr"). */
  langCode(): string;
  isMobile(): boolean;
  loadingReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Resolves when the ad is closed (or failed). Never rejects. */
  showInterstitial(hooks: AdHooks): Promise<void>;
  /** Resolves true only if onRewarded fired. Never rejects. */
  showRewarded(hooks: AdHooks): Promise<boolean>;
  loadCloud(): Promise<unknown | null>;
  saveCloud(data: unknown, flush: boolean): Promise<void>;
  isAuthorized(): boolean;
  requestAuth(): Promise<boolean>;
  submitScore(score: number): Promise<void>;
  getLeaderboard(): Promise<LeaderboardResult | null>;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
}

export interface AdHooks {
  /** Called right before the ad is opened: pause the game and silence audio. */
  onStart(): void;
  /** Called after the ad is closed or failed: restore state. */
  onEnd(): void;
}
