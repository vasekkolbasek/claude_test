import { ACHIEVEMENTS } from '../data/achievements';
import type { World } from '../game/World';
import type { SaveData } from './save';
import { totalWorkshopLevels } from './workshop';

/**
 * Evaluates every locked achievement and grants its reward. Returns the ids unlocked by this call (in definition order).
 */
export function checkAchievements(save: SaveData, w: World | null, won: boolean): string[] {
  const out: string[] = [];
  // a second pass catches meta achievements unlocked by the first (e.g. chars_3)
  for (let pass = 0; pass < 2; pass++) {
    const ctx = { save, w, won, workshopLevels: totalWorkshopLevels(save) };
    for (const a of ACHIEVEMENTS) {
      if (save.ach[a.id]) continue;
      let ok: boolean;
      try {
        ok = a.check(ctx);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      save.ach[a.id] = Date.now();
      save.bits += a.reward;
      out.push(a.id);
    }
  }
  return out;
}
