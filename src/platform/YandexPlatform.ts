import { CONFIG } from '../data/config';
import type { AdHooks, LeaderboardEntry, LeaderboardResult, Platform } from './Platform';

declare global {
  interface Window { YaGames?: { init(opts?: unknown): Promise<any> } }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

/** Yandex Games SDK v2 integration. */
export class YandexPlatform implements Platform {
  readonly id = 'yandex' as const;
  private ysdk: any = null;
  private player: any = null;
  private lastScoreAt = 0;

  async init(): Promise<void> {
    this.ysdk = await withTimeout(window.YaGames!.init(), 10000);
    await this.loadPlayer();
  }

  private async loadPlayer(): Promise<void> {
    try { this.player = await withTimeout(this.ysdk.getPlayer({ scopes: false }), 6000); } catch { this.player = null; }
  }

  langCode(): string {
    try { return String(this.ysdk?.environment?.i18n?.lang || 'ru'); } catch { return 'ru'; }
  }

  isMobile(): boolean {
    try { return !!(this.ysdk?.deviceInfo?.isMobile?.() || this.ysdk?.deviceInfo?.isTablet?.()); } catch { return false; }
  }

  loadingReady(): void { try { this.ysdk?.features?.LoadingAPI?.ready(); } catch { /* ignore */ } }
  gameplayStart(): void { try { this.ysdk?.features?.GameplayAPI?.start(); } catch { /* ignore */ } }
  gameplayStop(): void { try { this.ysdk?.features?.GameplayAPI?.stop(); } catch { /* ignore */ } }

  showInterstitial(h: AdHooks): Promise<void> {
    return new Promise((resolve) => {
      let ended = false;
      let started = false;
      const end = () => { if (ended) return; ended = true; if (started) h.onEnd(); resolve(); };
      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => { started = true; h.onStart(); },
            onClose: () => end(),
            onError: () => end(),
            onOffline: () => end(),
          },
        });
      } catch { end(); }
      // Safety net: never leave the game paused forever.
      setTimeout(end, 90000);
    });
  }

  showRewarded(h: AdHooks): Promise<boolean> {
    return new Promise((resolve) => {
      let ended = false;
      let rewarded = false;
      h.onStart();
      const end = () => { if (ended) return; ended = true; h.onEnd(); resolve(rewarded); };
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => { /* already paused */ },
            onRewarded: () => { rewarded = true; },
            onClose: () => end(),
            onError: () => end(),
          },
        });
      } catch { end(); }
      setTimeout(end, 180000);
    });
  }

  async loadCloud(): Promise<unknown | null> {
    if (!this.player) return null;
    try { return await withTimeout(this.player.getData(), 6000); } catch { return null; }
  }

  async saveCloud(data: unknown, flush: boolean): Promise<void> {
    if (!this.player) return;
    try { await this.player.setData(data, flush); } catch { /* local copy is kept anyway */ }
  }

  isAuthorized(): boolean {
    try {
      if (!this.player) return false;
      if (typeof this.player.isAuthorized === 'function') return !!this.player.isAuthorized();
      return this.player.getMode?.() !== 'lite';
    } catch { return false; }
  }

  async requestAuth(): Promise<boolean> {
    try {
      await this.ysdk.auth.openAuthDialog();
      await this.loadPlayer();
      return this.isAuthorized();
    } catch { return false; }
  }

  async submitScore(score: number): Promise<void> {
    if (!this.isAuthorized()) return;
    const now = Date.now();
    if (now - this.lastScoreAt < 1500) return;
    this.lastScoreAt = now;
    try {
      if (this.ysdk.isAvailableMethod && !(await this.ysdk.isAvailableMethod('leaderboards.setScore'))) return;
      await this.ysdk.leaderboards.setScore(CONFIG.leaderboardName, Math.floor(score));
    } catch { /* ignore */ }
  }

  async getLeaderboard(): Promise<LeaderboardResult | null> {
    try {
      const res = await withTimeout(
        this.ysdk.leaderboards.getEntries(CONFIG.leaderboardName, { quantityTop: 10, includeUser: this.isAuthorized(), quantityAround: 2 }),
        8000,
      ) as any;
      const myId = this.player?.getUniqueID?.();
      const entries: LeaderboardEntry[] = (res?.entries ?? []).map((e: any) => ({
        rank: e.rank,
        name: e.player?.publicName || '',
        score: e.score,
        me: !!myId && e.player?.uniqueID === myId,
      }));
      const userRank = res?.userRank;
      const player = entries.find((e) => e.me) ?? (userRank ? { rank: userRank, name: '', score: 0, me: true } : null);
      return { entries, player, authorized: this.isAuthorized() };
    } catch { return null; }
  }

  onPause(cb: () => void): void { try { this.ysdk.on('game_api_pause', cb); } catch { /* ignore */ } }
  onResume(cb: () => void): void { try { this.ysdk.on('game_api_resume', cb); } catch { /* ignore */ } }
}
