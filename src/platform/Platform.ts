export interface LeaderEntry {
  rank: number;
  name: string;
  score: number;
  isPlayer: boolean;
}

export interface LeaderboardResult {
  entries: LeaderEntry[];
  player: LeaderEntry | null;
}

export interface AdHooks {
  /** called right before the ad covers the game (pause + mute here) */
  onOpen?: () => void;
  /** called once when the ad is gone for any reason */
  onClose?: () => void;
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tv';

/** Everything the game needs from the hosting platform. */
export interface Platform {
  readonly kind: 'yandex' | 'local';
  init(): Promise<void>;
  /** interface language reported by the platform (ISO 639-1) */
  lang(): string;
  device(): DeviceType;
  /** game is loaded and interactive (LoadingAPI.ready) */
  ready(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(hooks: AdHooks): Promise<void>;
  /** resolves true only if the platform confirmed the reward (onRewarded) */
  showRewarded(hooks: AdHooks): Promise<boolean>;
  loadData(): Promise<Record<string, unknown> | null>;
  saveData(data: Record<string, unknown>, flush: boolean): Promise<boolean>;
  isAuthorized(): boolean;
  openAuth(): Promise<boolean>;
  setScore(leaderboard: string, score: number): Promise<boolean>;
  getLeaderboard(leaderboard: string): Promise<LeaderboardResult>;
  /** platform-driven pause/resume (game_api_pause / game_api_resume) */
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  /** server time in ms if available, else Date.now() */
  now(): number;
}
