import type { WaveEvent, WaveSegment } from './types';

/**
 * Normal-mode director script. Segments are interpolated: `min`/`rate` blend linearly towards
 * the next segment, the roster switches at segment boundaries.
 */
export const WAVES: WaveSegment[] = [
  { at: 0, min: 10, rate: 1.0, elite: 0, roster: [['byte', 10]] },
  { at: 25, min: 18, rate: 1.6, elite: 0, roster: [['byte', 10], ['worm', 4]] },
  { at: 50, min: 23, rate: 2.0, elite: 0.004, roster: [['byte', 9], ['worm', 5], ['dasher', 1]] },
  { at: 75, min: 30, rate: 2.5, elite: 0.006, roster: [['byte', 7], ['worm', 4], ['dasher', 2], ['trojan', 2]] },
  { at: 105, min: 41, rate: 3.3, elite: 0.008, roster: [['byte', 6], ['trojan', 3], ['splitter', 3], ['dasher', 2]] },
  { at: 130, min: 54, rate: 4.3, elite: 0.01, roster: [['byte', 6], ['spammer', 2], ['splitter', 3], ['worm', 4], ['bomber', 2]] },
  { at: 155, min: 76, rate: 5.7, elite: 0.012, roster: [['byte', 5], ['shielded', 3], ['spammer', 2], ['bomber', 2], ['glitch', 2], ['worm', 3]] },
  { at: 185, min: 100, rate: 7.2, elite: 0.014, roster: [['byte', 4], ['trojan', 3], ['medic', 1], ['glitch', 3], ['rootkit', 2], ['dasher', 3]] },
  { at: 215, min: 120, rate: 8.4, elite: 0.016, roster: [['byte', 4], ['shielded', 3], ['spawner', 1], ['splitter', 3], ['bomber', 3], ['spammer', 2]] },
  { at: 250, min: 150, rate: 10, elite: 0.018, roster: [['trojan', 4], ['rootkit', 3], ['medic', 2], ['glitch', 3], ['worm', 4], ['dasher', 3]] },
  { at: 290, min: 190, rate: 12, elite: 0.02, roster: [['byte', 4], ['shielded', 4], ['spawner', 2], ['bomber', 3], ['splitter', 3], ['spammer', 3], ['rootkit', 2]] },
  { at: 325, min: 240, rate: 14, elite: 0.024, roster: [['trojan', 4], ['shielded', 3], ['medic', 2], ['glitch', 3], ['dasher', 4], ['rootkit', 3], ['bomber', 3]] },
  { at: 360, min: 90, rate: 6, elite: 0.02, roster: [['byte', 4], ['worm', 4], ['nano', 3], ['dasher', 2]] },
];

/** Endless mode keeps cycling the late-game rosters while density keeps growing. */
export const ENDLESS_LOOP_FROM = 7;
export const ENDLESS_DENSITY_PER_MIN = 9;
export const ENDLESS_RATE_PER_MIN = 0.6;

export const WAVE_EVENTS: WaveEvent[] = [
  { at: 35, type: 'swarm', enemy: 'nano', count: 14 },
  { at: 60, type: 'ring', enemy: 'byte', count: 18 },
  { at: 90, type: 'rush', enemy: 'worm', count: 22 },
  { at: 110, type: 'miniboss', enemy: 'mb_trojan', count: 1 },
  { at: 140, type: 'swarm', enemy: 'nano', count: 22 },
  { at: 170, type: 'ring', enemy: 'trojan', count: 14 },
  { at: 200, type: 'rush', enemy: 'dasher', count: 16 },
  { at: 215, type: 'miniboss', enemy: 'mb_crypto', count: 1 },
  { at: 240, type: 'swarm', enemy: 'nano', count: 30 },
  { at: 270, type: 'ring', enemy: 'shielded', count: 18 },
  { at: 300, type: 'rush', enemy: 'bomber', count: 18 },
  { at: 325, type: 'miniboss', enemy: 'mb_hydra', count: 1 },
  { at: 345, type: 'ring', enemy: 'byte', count: 30 },
  { at: 360, type: 'boss', enemy: 'boss_core', count: 1 },
];

/** Endless: events repeat on this cycle after the final-boss mark. */
export const ENDLESS_EVENT_CYCLE: WaveEvent[] = [
  { at: 20, type: 'swarm', enemy: 'nano', count: 34 },
  { at: 35, type: 'ring', enemy: 'shielded', count: 24 },
  { at: 55, type: 'rush', enemy: 'dasher', count: 24 },
  { at: 70, type: 'miniboss', enemy: 'mb_trojan', count: 1 },
  { at: 90, type: 'ring', enemy: 'trojan', count: 24 },
  { at: 110, type: 'miniboss', enemy: 'mb_crypto', count: 1 },
  { at: 125, type: 'rush', enemy: 'bomber', count: 24 },
  { at: 145, type: 'miniboss', enemy: 'mb_hydra', count: 1 },
];
export const ENDLESS_CYCLE_LENGTH = 150;
