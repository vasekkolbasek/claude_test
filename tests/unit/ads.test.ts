import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import type { AdHooks } from '../../src/platform/Platform';
import type { YCallbacks, YSDK } from '../../src/platform/yandex-sdk';
import { YandexPlatform } from '../../src/platform/YandexPlatform';

/** SDK stub whose ad calls run the given script against the callbacks */
function sdk(script: (cb: YCallbacks) => void): YSDK {
  const adv = { showRewardedVideo: (o: { callbacks: YCallbacks }) => script(o.callbacks), showFullscreenAdv: (o: { callbacks: YCallbacks }) => script(o.callbacks) };
  return { adv } as unknown as YSDK;
}

function hooks(): AdHooks & { log: string[] } {
  const log: string[] = [];
  return { log, onOpen: () => log.push('open'), onShown: () => log.push('shown'), onClose: () => log.push('close') };
}

describe('Yandex rewarded ads', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.spyOn(console, 'warn').mockRestore();
  });

  it('an SDK error right away: paused during the attempt, not shown, no reward', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = hooks();
    const ok = await new YandexPlatform(sdk((cb) => cb.onError?.(new Error('no fill')))).showRewarded(h);
    expect(ok).toBe(false);
    // the game is paused + muted before the request and resumed after; "shown" never fires,
    // so App.rewarded() shows the "ad unavailable" toast
    expect(h.log).toEqual(['open', 'close']);
  });

  it('no answer from the SDK: closes after the safety timeout, not shown', async () => {
    vi.useFakeTimers();
    const h = hooks();
    const p = new YandexPlatform(sdk(() => {})).showRewarded(h);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await p).toBe(false);
    expect(h.log).toEqual(['open', 'close']);
  });

  it('closed without being shown (wasShown = false): not shown', async () => {
    const h = hooks();
    const ok = await new YandexPlatform(sdk((cb) => cb.onClose?.(false))).showRewarded(h);
    expect(ok).toBe(false);
    expect(h.log).toEqual(['open', 'close']);
  });

  it('a watched video: shown, reward only via onRewarded', async () => {
    const h = hooks();
    const watched = await new YandexPlatform(
      sdk((cb) => {
        cb.onOpen?.();
        cb.onRewarded?.();
        cb.onClose?.(true);
      }),
    ).showRewarded(h);
    expect(watched).toBe(true);
    expect(h.log).toEqual(['open', 'shown', 'close']);

    const h2 = hooks();
    const skipped = await new YandexPlatform(
      sdk((cb) => {
        cb.onOpen?.();
        cb.onClose?.(true);
      }),
    ).showRewarded(h2);
    expect(skipped).toBe(false);
    expect(h2.log).toEqual(['open', 'shown', 'close']);
  });

  it('shown but the SDK never reports the close: resumes after the watchdog', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = hooks();
    let done = false;
    const p = new YandexPlatform(sdk((cb) => cb.onOpen?.())).showRewarded(h).then((ok) => {
      done = true;
      return ok;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toBe(false); // a long video is still allowed to play
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await p).toBe(false);
    expect(h.log).toEqual(['open', 'shown', 'close']);

    const h2 = hooks();
    const p2 = new YandexPlatform(sdk((cb) => cb.onOpen?.())).showInterstitial(h2);
    await vi.advanceTimersByTimeAsync(120_000);
    await p2;
    expect(h2.log).toEqual(['open', 'shown', 'close']);
  });

  it('fullscreen ad error: the game is resumed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = hooks();
    await new YandexPlatform(sdk((cb) => cb.onError?.('err'))).showInterstitial(h);
    expect(h.log).toEqual(['open', 'close']);
  });
});

describe('App.rewarded on Yandex', () => {
  /** just the parts of App that rewarded() touches */
  function fakeApp(sdkScript: (cb: YCallbacks) => void) {
    const state = { paused: [] as boolean[], muted: [] as boolean[], toasts: [] as string[], watched: 0 };
    const self = {
      adBusy: false,
      adHold: (App.prototype as unknown as { adHold: unknown }).adHold,
      platform: new YandexPlatform(sdk(sdkScript)),
      setPause: (_r: string, on: boolean) => state.paused.push(on),
      audio: { mute: (_r: string, on: boolean) => state.muted.push(on) },
      save: { data: { stats: { adsWatched: 0 } }, save: () => (state.watched = self.save.data.stats.adsWatched) },
      ui: { toast: (msg: string) => state.toasts.push(msg) },
    };
    const run = Object.assign(() => (App.prototype.rewarded as (this: unknown) => Promise<boolean>).call(self), { self });
    return { state, run };
  }

  /** like fakeApp, but with a hand-made platform.showRewarded */
  function fakeAppWith(make: () => (hooks: AdHooks) => Promise<boolean>) {
    const { state, run } = fakeApp(() => {});
    const self = (run as unknown as { self: Record<string, unknown> & { adBusy: boolean; platform: Record<string, unknown> } }).self;
    self.platform = { showRewarded: make(), showInterstitial: () => Promise.resolve() };
    return { state, run, self };
  }

  function platformInterstitial(self: { platform: Record<string, unknown> }, fn: (hooks: AdHooks) => Promise<void>): void {
    self.platform.showInterstitial = fn;
  }

  it('SDK error: "ad unavailable" toast, no reward, paused and muted only during the attempt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { state, run } = fakeApp((cb) => cb.onError?.(new Error('no fill')));
    expect(await run()).toBe(false);
    expect(state.toasts).toHaveLength(1);
    expect(state.paused).toEqual([true, false]);
    expect(state.muted).toEqual([true, false]);
    expect(state.watched).toBe(0);
  });

  it('the platform call itself fails: no reward, toast, nothing stays paused or busy', async () => {
    const { state, run, self } = fakeAppWith(() => (hooks: AdHooks) => {
      hooks.onOpen?.();
      return Promise.reject(new Error('sdk crashed'));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await run()).toBe(false);
    expect(state.toasts).toHaveLength(1);
    expect(state.paused).toEqual([true, false]);
    expect(state.muted).toEqual([true, false]);
    expect(self.adBusy).toBe(false);
    // and the next ad can still be requested
    expect(await run()).toBe(false);
    expect(state.toasts).toHaveLength(2);
  });

  it('a failing interstitial never blocks the way back to the menu', async () => {
    const { state, self } = fakeAppWith(() => () => Promise.reject(new Error('sdk crashed')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.assign(self, { mode: 'results', lastInterstitial: 0, save: { data: { stats: { runs: 10, adsWatched: 0 } }, save: () => {} } });
    platformInterstitial(self, (hooks: AdHooks) => {
      hooks.onOpen?.();
      return Promise.reject(new Error('sdk crashed'));
    });
    await (App.prototype.interstitial as (this: unknown) => Promise<void>).call(self);
    expect(self.adBusy).toBe(false);
    expect(state.paused).toEqual([true, false]);
  });

  it('a shown ad closed early: no toast, no reward', async () => {
    const { state, run } = fakeApp((cb) => {
      cb.onOpen?.();
      cb.onClose?.(true);
    });
    expect(await run()).toBe(false);
    expect(state.toasts).toHaveLength(0);
  });

  it('a watched ad: reward, no toast', async () => {
    const { state, run } = fakeApp((cb) => {
      cb.onOpen?.();
      cb.onRewarded?.();
      cb.onClose?.(true);
    });
    expect(await run()).toBe(true);
    expect(state.toasts).toHaveLength(0);
    expect(state.watched).toBe(1);
  });
});
