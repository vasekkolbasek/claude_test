import { LocalPlatform } from './LocalPlatform';
import type { Platform } from './Platform';
import { YandexPlatform } from './YandexPlatform';

/** Picks the Yandex SDK when present, otherwise the local mock. Never throws. */
export async function createPlatform(): Promise<Platform> {
  const params = new URLSearchParams(location.search);
  const forceLocal = params.has('local');
  if (!forceLocal && window.YaGames) {
    try {
      const sdk = await Promise.race([
        window.YaGames.init(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('YaGames.init timeout')), 6000)),
      ]);
      const p = new YandexPlatform(sdk);
      await p.init();
      return p;
    } catch (e) {
      console.warn('[platform] Yandex SDK unavailable, using local platform', e);
    }
  }
  const mockAds = import.meta.env.DEV || params.get('mock') === '1';
  const p = new LocalPlatform(mockAds, params.get('lang'));
  await p.init();
  return p;
}
