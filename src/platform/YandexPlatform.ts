import type { AdHooks, DeviceType, LeaderboardResult, Platform } from './Platform';
import type { YPlayer, YSDK } from './yandex-sdk';

const SAVE_KEY = 'save';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Real Yandex Games SDK integration. */
export class YandexPlatform implements Platform {
  readonly kind = 'yandex' as const;
  private player: YPlayer | null = null;
  private readonly pauseCbs: (() => void)[] = [];
  private readonly resumeCbs: (() => void)[] = [];
  private readyCalled = false;
  private gameplay = false;

  constructor(private readonly sdk: YSDK) {}

  async init(): Promise<void> {
    try {
      this.sdk.on('game_api_pause', () => this.pauseCbs.forEach((cb) => cb()));
      this.sdk.on('game_api_resume', () => this.resumeCbs.forEach((cb) => cb()));
    } catch (e) {
      console.warn('[ysdk] events unavailable', e);
    }
    await this.refreshPlayer();
  }

  private async refreshPlayer(): Promise<void> {
    try {
      this.player = await withTimeout(this.sdk.getPlayer(), 5000);
    } catch (e) {
      console.warn('[ysdk] getPlayer failed', e);
      this.player = null;
    }
  }

  lang(): string {
    return this.sdk.environment?.i18n?.lang ?? 'ru';
  }

  device(): DeviceType {
    const t = this.sdk.deviceInfo?.type;
    return t === 'mobile' || t === 'tablet' || t === 'tv' ? t : 'desktop';
  }

  ready(): void {
    if (this.readyCalled) return;
    this.readyCalled = true;
    try {
      this.sdk.features.LoadingAPI?.ready();
    } catch (e) {
      console.warn('[ysdk] ready failed', e);
    }
  }

  gameplayStart(): void {
    if (this.gameplay) return;
    this.gameplay = true;
    try {
      this.sdk.features.GameplayAPI?.start();
    } catch (e) {
      console.warn('[ysdk] gameplay start failed', e);
    }
  }

  gameplayStop(): void {
    if (!this.gameplay) return;
    this.gameplay = false;
    try {
      this.sdk.features.GameplayAPI?.stop();
    } catch (e) {
      console.warn('[ysdk] gameplay stop failed', e);
    }
  }

  showInterstitial(hooks: AdHooks): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        hooks.onClose?.();
        resolve();
      };
      try {
        hooks.onOpen?.();
        this.sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: () => finish(),
            onError: (e) => {
              console.warn('[ysdk] fullscreen ad error', e);
              finish();
            },
            onOffline: () => finish(),
          },
        });
      } catch (e) {
        console.warn('[ysdk] fullscreen ad failed', e);
        finish();
      }
    });
  }

  showRewarded(hooks: AdHooks): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        hooks.onClose?.();
        resolve(rewarded);
      };
      try {
        hooks.onOpen?.();
        this.sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(),
            onError: (e) => {
              console.warn('[ysdk] rewarded ad error', e);
              finish();
            },
          },
        });
      } catch (e) {
        console.warn('[ysdk] rewarded ad failed', e);
        finish();
      }
    });
  }

  async loadData(): Promise<Record<string, unknown> | null> {
    if (!this.player) return null;
    try {
      const data = await withTimeout(this.player.getData([SAVE_KEY]), 6000);
      const v = data?.[SAVE_KEY];
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch (e) {
      console.warn('[ysdk] getData failed', e);
      return null;
    }
  }

  async saveData(data: Record<string, unknown>, flush: boolean): Promise<boolean> {
    if (!this.player) return false;
    try {
      await this.player.setData({ [SAVE_KEY]: data }, flush);
      return true;
    } catch (e) {
      console.warn('[ysdk] setData failed', e);
      return false;
    }
  }

  isAuthorized(): boolean {
    try {
      return this.player?.isAuthorized() ?? false;
    } catch {
      return false;
    }
  }

  async openAuth(): Promise<boolean> {
    try {
      await this.sdk.auth.openAuthDialog();
      await this.refreshPlayer();
      return this.isAuthorized();
    } catch {
      return false;
    }
  }

  async setScore(leaderboard: string, score: number): Promise<boolean> {
    if (!this.isAuthorized() || !this.sdk.leaderboards) return false;
    try {
      const ok = await this.sdk.isAvailableMethod('leaderboards.setScore');
      if (!ok) return false;
      await this.sdk.leaderboards.setScore(leaderboard, Math.max(0, Math.round(score)));
      return true;
    } catch (e) {
      console.warn('[ysdk] setScore failed', e);
      return false;
    }
  }

  async getLeaderboard(leaderboard: string): Promise<LeaderboardResult> {
    if (!this.sdk.leaderboards) throw new Error('leaderboards unavailable');
    const res = await withTimeout(
      this.sdk.leaderboards.getEntries(leaderboard, { quantityTop: 10, includeUser: this.isAuthorized(), quantityAround: 2 }),
      8000,
    );
    let me = '';
    try {
      me = this.player?.getUniqueID() ?? '';
    } catch {
      me = '';
    }
    const entries = (res.entries ?? []).map((e) => ({
      rank: e.rank,
      name: e.player?.publicName ?? '',
      score: e.score,
      isPlayer: !!me && e.player?.uniqueID === me,
    }));
    return { entries, player: entries.find((e) => e.isPlayer) ?? null };
  }

  onPause(cb: () => void): void {
    this.pauseCbs.push(cb);
  }

  onResume(cb: () => void): void {
    this.resumeCbs.push(cb);
  }

  now(): number {
    try {
      const t = this.sdk.serverTime?.();
      if (typeof t === 'number' && t > 0) return t;
    } catch {
      /* fall through */
    }
    return Date.now();
  }
}
