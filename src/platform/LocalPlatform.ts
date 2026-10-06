import type { AdHooks, DeviceType, LeaderboardResult, Platform } from './Platform';

const CLOUD_KEY = 'neon-swarm:mock-cloud';
const LB_KEY = 'neon-swarm:mock-lb';
const AUTH_KEY = 'neon-swarm:mock-auth';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Development / test stand-in for the Yandex SDK.
 * Ads are only emulated when `mockAds` is on (dev server or `?mock=1`), so a production
 * build that somehow runs without the SDK never shows anything resembling an ad.
 */
export class LocalPlatform implements Platform {
  readonly kind = 'local' as const;
  private readonly pauseCbs: (() => void)[] = [];
  private readonly resumeCbs: (() => void)[] = [];
  private gameplay = false;
  /** call log for tests */
  readonly log: string[] = [];

  constructor(
    private readonly mockAds: boolean,
    private readonly langOverride: string | null,
  ) {}

  async init(): Promise<void> {
    (window as unknown as { __platformLog?: string[] }).__platformLog = this.log;
  }

  lang(): string {
    return this.langOverride ?? 'ru';
  }

  device(): DeviceType {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    if (!coarse) return 'desktop';
    return minSide >= 600 ? 'tablet' : 'mobile';
  }

  ready(): void {
    this.log.push('ready');
  }

  gameplayStart(): void {
    if (this.gameplay) return;
    this.gameplay = true;
    this.log.push('gameplay:start');
  }

  gameplayStop(): void {
    if (!this.gameplay) return;
    this.gameplay = false;
    this.log.push('gameplay:stop');
  }

  private fakeAd(label: string, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'mock-ad';
      el.textContent = `[DEV] ${label}`;
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
        resolve();
      }, ms);
    });
  }

  async showInterstitial(hooks: AdHooks): Promise<void> {
    this.log.push('ad:interstitial');
    if (!this.mockAds) return;
    hooks.onOpen?.();
    hooks.onShown?.();
    await this.fakeAd('interstitial', 700);
    hooks.onClose?.();
  }

  async showRewarded(hooks: AdHooks): Promise<boolean> {
    this.log.push('ad:rewarded');
    if (!this.mockAds) return false;
    hooks.onOpen?.();
    hooks.onShown?.();
    await this.fakeAd('rewarded video', 900);
    hooks.onClose?.();
    return true;
  }

  async loadData(): Promise<Record<string, unknown> | null> {
    const raw = safeGet(CLOUD_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async saveData(data: Record<string, unknown>): Promise<boolean> {
    safeSet(CLOUD_KEY, JSON.stringify(data));
    return true;
  }

  isAuthorized(): boolean {
    return safeGet(AUTH_KEY) === '1';
  }

  async openAuth(): Promise<boolean> {
    safeSet(AUTH_KEY, '1');
    return true;
  }

  async setScore(_lb: string, score: number): Promise<boolean> {
    const best = Number(safeGet(LB_KEY) ?? 0);
    if (score > best) safeSet(LB_KEY, String(Math.round(score)));
    return true;
  }

  async getLeaderboard(): Promise<LeaderboardResult> {
    const mine = Number(safeGet(LB_KEY) ?? 0);
    const bots = [
      ['NeoByte', 1_520_000],
      ['Firewall_88', 1_204_000],
      ['Kernel', 980_000],
      ['Packet', 705_000],
      ['Overclock', 512_000],
      ['Daemon', 344_000],
    ] as const;
    const list: { name: string; score: number; isPlayer: boolean }[] = bots.map(([name, score]) => ({ name, score, isPlayer: false }));
    if (mine > 0 && this.isAuthorized()) list.push({ name: 'You', score: mine, isPlayer: true });
    list.sort((a, b) => b.score - a.score);
    const entries = list.map((e, i) => ({ ...e, rank: i + 1 }));
    return { entries, player: entries.find((e) => e.isPlayer) ?? null };
  }

  onPause(cb: () => void): void {
    this.pauseCbs.push(cb);
  }

  onResume(cb: () => void): void {
    this.resumeCbs.push(cb);
  }

  /** test hook: emulate the SDK's game_api_pause / resume */
  emitPause(): void {
    this.pauseCbs.forEach((cb) => cb());
  }

  emitResume(): void {
    this.resumeCbs.forEach((cb) => cb());
  }

  now(): number {
    return Date.now();
  }
}
