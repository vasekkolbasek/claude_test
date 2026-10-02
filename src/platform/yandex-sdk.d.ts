/** Minimal typings for the parts of the Yandex Games SDK this game uses. */
export interface YCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (error: unknown) => void;
  onRewarded?: () => void;
  onOffline?: () => void;
}

export interface YPlayer {
  isAuthorized(): boolean;
  getUniqueID(): string;
  getName(): string;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface YLeaderboardEntry {
  rank: number;
  score: number;
  extraData?: string;
  player: { publicName: string; uniqueID: string };
}

export interface YSDK {
  environment: { i18n: { lang: string }; app?: { id: string }; payload?: string };
  deviceInfo?: { type: string };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(o: { callbacks: YCallbacks }): void;
    showRewardedVideo(o: { callbacks: YCallbacks }): void;
  };
  auth: { openAuthDialog(): Promise<void> };
  getPlayer(o?: { signed?: boolean }): Promise<YPlayer>;
  leaderboards?: {
    setScore(name: string, score: number, extraData?: string): Promise<void>;
    getEntries(
      name: string,
      opts?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
    ): Promise<{ entries: YLeaderboardEntry[]; userRank?: number }>;
    getPlayerEntry(name: string): Promise<YLeaderboardEntry>;
  };
  isAvailableMethod(name: string): Promise<boolean>;
  on(event: string, cb: () => void): void;
  serverTime?(): number;
}

declare global {
  interface Window {
    YaGames?: { init(opts?: { signed?: boolean }): Promise<YSDK> };
  }
}
