import type { SaveData } from './save';

/**
 * Menu features are revealed one by one so a new player is not greeted by a wall of buttons:
 * at first there is only «Играть», then the Workshop (something to spend bits on), characters
 * and daily rewards, the chest, the Codex and achievements, and finally the leaderboard together
 * with Endless mode. A freshly revealed feature carries a «NEW» badge until it is opened.
 */
export type FeatureId = 'workshop' | 'characters' | 'daily' | 'chest' | 'codex' | 'achievements' | 'leaders';

export const FEATURES: { id: FeatureId; open: (s: SaveData) => boolean }[] = [
  { id: 'workshop', open: (s) => s.stats.runs >= 1 },
  { id: 'characters', open: (s) => s.stats.runs >= 2 },
  { id: 'daily', open: (s) => s.stats.runs >= 2 },
  { id: 'chest', open: (s) => s.stats.runs >= 3 },
  { id: 'achievements', open: (s) => s.stats.runs >= 3 },
  { id: 'codex', open: (s) => s.stats.runs >= 4 },
  { id: 'leaders', open: (s) => s.endlessUnlocked },
];

export function featureOpen(s: SaveData, id: FeatureId): boolean {
  return FEATURES.find((f) => f.id === id)?.open(s) ?? true;
}

/** Open but never visited: shows the «NEW» badge and the hint line under «Играть». */
export function featureNew(s: SaveData, id: FeatureId): boolean {
  return featureOpen(s, id) && !s.seen.includes(id);
}

export function markSeen(s: SaveData, id: FeatureId): boolean {
  if (s.seen.includes(id)) return false;
  s.seen.push(id);
  return true;
}

/** For saves made before features were gated: everything already open counts as seen. */
export function seenForExisting(s: SaveData): string[] {
  return FEATURES.filter((f) => f.open(s)).map((f) => f.id);
}
