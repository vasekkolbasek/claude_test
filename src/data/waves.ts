import type { WaveEvent, WaveSegment } from './types';

/**
 * Normal-mode director script. Segments are interpolated: `min`/`rate` blend linearly towards
 * the next segment, the roster switches at segment boundaries.
 */
export const WAVES: WaveSegment[] = [
  { at: 0, min: 10, rate: 1.0, elite: 0, roster: [['byte', 10]] },
  { at: 40, min: 18, rate: 1.6, elite: 0, roster: [['byte', 10], ['worm', 4]] },
  { at: 80, min: 26, rate: 2.2, elite: 0.004, roster: [['byte', 9], ['worm', 5], ['dasher', 1]] },
  { at: 120, min: 36, rate: 3.0, elite: 0.006, roster: [['byte', 7], ['worm', 4], ['dasher', 2], ['trojan', 2]] },
  { at: 170, min: 52, rate: 4.0, elite: 0.008, roster: [['byte', 6], ['trojan', 3], ['splitter', 3], ['dasher', 2]] },
  { at: 210, min: 64, rate: 5.0, elite: 0.01, roster: [['byte', 6], ['spammer', 2], ['splitter', 3], ['worm', 4], ['bomber', 2]] },
  { at: 260, min: 80, rate: 6.0, elite: 0.012, roster: [['byte', 5], ['shielded', 3], ['spammer', 2], ['bomber', 2], ['glitch', 2], ['worm', 3]] },
  { at: 310, min: 100, rate: 7.2, elite: 0.014, roster: [['byte', 4], ['trojan', 3], ['medic', 1], ['glitch', 3], ['rootkit', 2], ['dasher', 3]] },
  { at: 360, min: 120, rate: 8.4, elite: 0.016, roster: [['byte', 4], ['shielded', 3], ['spawner', 1], ['splitter', 3], ['bomber', 3], ['spammer', 2]] },
  { at: 420, min: 150, rate: 10, elite: 0.018, roster: [['trojan', 4], ['rootkit', 3], ['medic', 2], ['glitch', 3], ['worm', 4], ['dasher', 3]] },
  { at: 480, min: 190, rate: 12, elite: 0.02, roster: [['byte', 4], ['shielded', 4], ['spawner', 2], ['bomber', 3], ['splitter', 3], ['spammer', 3], ['rootkit', 2]] },
  { at: 540, min: 240, rate: 14, elite: 0.024, roster: [['trojan', 4], ['shielded', 3], ['medic', 2], ['glitch', 3], ['dasher', 4], ['rootkit', 3], ['bomber', 3]] },
  { at: 600, min: 90, rate: 6, elite: 0.02, roster: [['byte', 4], ['worm', 4], ['nano', 3], ['dasher', 2]] },
];

/** Endless mode keeps cycling the late-game rosters while density keeps growing. */
export const ENDLESS_LOOP_FROM = 7;
export const ENDLESS_DENSITY_PER_MIN = 9;
export const ENDLESS_RATE_PER_MIN = 0.6;

export const WAVE_EVENTS: WaveEvent[] = [
  { at: 60, type: 'swarm', enemy: 'nano', count: 14 },
  { at: 100, type: 'ring', enemy: 'byte', count: 18 },
  { at: 150, type: 'rush', enemy: 'worm', count: 22 },
  { at: 180, type: 'miniboss', enemy: 'mb_trojan', count: 1 },
  { at: 235, type: 'swarm', enemy: 'nano', count: 22 },
  { at: 280, type: 'ring', enemy: 'trojan', count: 14 },
  { at: 330, type: 'rush', enemy: 'dasher', count: 16 },
  { at: 360, type: 'miniboss', enemy: 'mb_crypto', count: 1 },
  { at: 400, type: 'swarm', enemy: 'nano', count: 30 },
  { at: 450, type: 'ring', enemy: 'shielded', count: 18 },
  { at: 500, type: 'rush', enemy: 'bomber', count: 18 },
  { at: 540, type: 'miniboss', enemy: 'mb_hydra', count: 1 },
  { at: 575, type: 'ring', enemy: 'byte', count: 30 },
  { at: 600, type: 'boss', enemy: 'boss_core', count: 1 },
];

/** Endless: events repeat on this cycle after the final-boss mark. */
export const ENDLESS_EVENT_CYCLE: WaveEvent[] = [
  { at: 30, type: 'swarm', enemy: 'nano', count: 34 },
  { at: 60, type: 'ring', enemy: 'shielded', count: 24 },
  { at: 90, type: 'rush', enemy: 'dasher', count: 24 },
  { at: 120, type: 'miniboss', enemy: 'mb_trojan', count: 1 },
  { at: 150, type: 'ring', enemy: 'trojan', count: 24 },
  { at: 180, type: 'miniboss', enemy: 'mb_crypto', count: 1 },
  { at: 210, type: 'rush', enemy: 'bomber', count: 24 },
  { at: 240, type: 'miniboss', enemy: 'mb_hydra', count: 1 },
];
export const ENDLESS_CYCLE_LENGTH = 240;
