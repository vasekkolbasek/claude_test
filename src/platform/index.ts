import { LocalPlatform } from './LocalPlatform';
import type { Platform } from './Platform';
import { YandexPlatform } from './YandexPlatform';

/** Picks the Yandex SDK when it is present, otherwise the local mock. */
export async function createPlatform(): Promise<Platform> {
  if (typeof window !== 'undefined' && window.YaGames && typeof window.YaGames.init === 'function') {
    const y = new YandexPlatform();
    try {
      await y.init();
      return y;
    } catch {
      // SDK present but failed to initialise — keep the game playable.
    }
  }
  const l = new LocalPlatform();
  await l.init();
  return l;
}
