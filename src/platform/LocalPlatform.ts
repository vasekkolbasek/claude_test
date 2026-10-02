import { CONFIG } from '../data/config';
import type { AdHooks, LeaderboardResult, Platform } from './Platform';

const CLOUD_KEY = 'lastbastion.cloud';
const SCORE_KEY = 'lastbastion.localscore';

function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }

/**
 * Offline / development implementation: no real ads (rewards are granted after a short
 * delay so flows can be tested), "cloud" saves and leaderboard live in localStorage.
 */
export class LocalPlatform implements Platform {
  readonly id = 'local' as const;
  async init(): Promise<void> { /* nothing to do */ }
  langCode(): string { return (navigator.language || 'ru').slice(0, 2); }
  isMobile(): boolean { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1; }
  loadingReady(): void { /* no-op */ }
  gameplayStart(): void { /* no-op */ }
  gameplayStop(): void { /* no-op */ }
  async showInterstitial(h: AdHooks): Promise<void> {
    h.onStart();
    await new Promise((r) => setTimeout(r, 150));
    h.onEnd();
  }
  async showRewarded(h: AdHooks): Promise<boolean> {
    h.onStart();
    await new Promise((r) => setTimeout(r, 350));
    h.onEnd();
    return true;
  }
  async loadCloud(): Promise<unknown | null> {
    const s = lsGet(CLOUD_KEY);
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }
  async saveCloud(data: unknown): Promise<void> { lsSet(CLOUD_KEY, JSON.stringify(data)); }
  isAuthorized(): boolean { return false; }
  async requestAuth(): Promise<boolean> { return false; }
  async submitScore(score: number): Promise<void> {
    const prev = Number(lsGet(SCORE_KEY) || 0);
    if (score > prev) lsSet(SCORE_KEY, String(score));
  }
  async getLeaderboard(): Promise<LeaderboardResult | null> {
    const best = Number(lsGet(SCORE_KEY) || 0);
    void CONFIG;
    return { entries: [], player: best > 0 ? { rank: 1, name: '', score: best, me: true } : null, authorized: false };
  }
  onPause(): void { /* the browser visibility API covers local runs */ }
  onResume(): void { /* see onPause */ }
}
