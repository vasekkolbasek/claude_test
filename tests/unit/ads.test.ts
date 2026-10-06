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
      platform: new YandexPlatform(sdk(sdkScript)),
      setPause: (_r: string, on: boolean) => state.paused.push(on),
      audio: { mute: (_r: string, on: boolean) => state.muted.push(on) },
      save: { data: { stats: { adsWatched: 0 } }, save: () => (state.watched = self.save.data.stats.adsWatched) },
      ui: { toast: (msg: string) => state.toasts.push(msg) },
    };
    const run = () => (App.prototype.rewarded as (this: unknown) => Promise<boolean>).call(self);
    return { state, run };
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
