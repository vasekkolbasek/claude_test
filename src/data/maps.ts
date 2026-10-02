import type { BKind } from './buildings';
import type { EnemyId } from './units';

export type MapId = 'valley' | 'swamp' | 'pass';
export type TreeKind = 'round' | 'pine' | 'birch' | 'willow' | 'dead' | 'snowpine';

export interface SlotDef {
  id: string;
  kind: BKind;
  x?: number;
  z?: number;
  /** Walls are snapped onto a path at a fraction of its length. */
  path?: number;
  at?: number;
}

export interface Palette {
  grass: number;
  grass2: number;
  meadow: number;
  path: number;
  sand: number;
  rock: number;
  cliff: number;
  snow: number;
  water: number;
  fogDay: number;
  fogNight: number;
  skyDay: number;
  skyNight: number;
  leaves: number[];
}

export interface TerrainDef {
  /** Gaussian bumps: x, z, radius, height. */
  hills: [number, number, number, number][];
  /** Circular ponds: x, z, radius. */
  ponds: [number, number, number][];
  rivers: { pts: [number, number][]; w: number }[];
  /** Rock clusters: x, z, radius. */
  rocks: [number, number, number][];
  /** Height of the rim outside the playable area. */
  edge: number;
  noise: number;
  treeDensity: number;
  trees: TreeKind[];
  /** Areas kept clear of trees: x, z, radius. */
  clearings?: [number, number, number][];
}

export interface MapDef {
  id: MapId;
  nights: number;
  seed: number;
  half: number;
  startCoins: number;
  palette: Palette;
  terrain: TerrainDef;
  slots: SlotDef[];
  paths: [number, number][][];
  /** Active path indices for each campaign night. */
  schedule: number[][];
  roster: { unit: EnemyId; from: number; weight: number }[];
  budget: { base: number; growth: number; pow: number };
  boss: EnemyId;
  bridges: { x: number; z: number; rot: number; len: number }[];
}

const S = (id: string, kind: BKind, x: number, z: number): SlotDef => ({ id, kind, x, z });
const W = (id: string, path: number, at: number): SlotDef => ({ id, kind: 'wall', path, at });

export const MAPS: Record<MapId, MapDef> = {
  valley: {
    id: 'valley',
    nights: 8,
    seed: 1337,
    half: 36,
    startCoins: 8,
    palette: {
      grass: 0x9fd07a, grass2: 0x86c06a, meadow: 0xc4e08a, path: 0xe0c48e, sand: 0xeedfa8, rock: 0xb3aeb8, cliff: 0x9a93a3,
      snow: 0xf4f4fa, water: 0x7cc6e0, fogDay: 0xcfe6ee, fogNight: 0x1e2440, skyDay: 0xbfe2f2, skyNight: 0x141a33,
      leaves: [0x6fbf73, 0x8acb6a, 0x5aa86a, 0xa7d26b],
    },
    terrain: {
      hills: [[-24, 4, 7, 2.2], [20, 18, 6, 1.6], [-4, -24, 7, 2.4], [26, -6, 5, 1.2], [-20, 20, 5, 1.2], [8, 26, 6, 1.8]],
      ponds: [[16, -30, 4]],
      rivers: [{ pts: [[-46, -4], [-31, -12], [-22, -22], [-13, -46]], w: 5 }],
      rocks: [[25, -7, 3], [-30, 8, 2], [6, -30, 2]],
      edge: 6,
      noise: 0.5,
      treeDensity: 0.9,
      trees: ['round', 'round', 'pine', 'birch'],
    },
    slots: [
      S('castle', 'castle', 0, 0),
      S('farm1', 'farm', -4, -8), S('farm2', 'farm', -1.5, -12.5), S('farm3', 'farm', -12, -4), S('farm4', 'farm', -10.5, -12),
      S('fish1', 'fish', -21, -15),
      S('mine1', 'mine', 23, -3),
      S('tower1', 'tower', 14, -6), S('tower2', 'tower', -15, 6), S('tower3', 'tower', 5, 14), S('tower4', 'tower', 23, -13),
      S('magic1', 'magic', -4, 9),
      S('barracks1', 'barracks', 8, -1), S('barracks2', 'barracks', -10, 2),
      S('range1', 'range', 12, 6),
      S('forge1', 'forge', -6.5, -2.5),
      W('wall1', 0, 0.45), W('wall2', 1, 0.5), W('wall3', 2, 0.48),
    ],
    paths: [
      [[40, -34], [28, -24], [18, -15], [9, -8], [3, -2.5]],
      [[-40, 32], [-28, 24], [-17, 14], [-8, 6], [-2.8, 2.2]],
      [[34, 40], [24, 28], [14, 17], [6, 7], [2.2, 2.6]],
    ],
    schedule: [[0], [1], [0, 1], [2], [0, 2], [1, 2], [0, 1, 2], [0, 1, 2]],
    roster: [
      { unit: 'grunt', from: 1, weight: 10 },
      { unit: 'runner', from: 2, weight: 5 },
      { unit: 'skirmisher', from: 3, weight: 4 },
      { unit: 'shieldbearer', from: 4, weight: 3 },
      { unit: 'raider', from: 5, weight: 3 },
      { unit: 'wisp', from: 5, weight: 3 },
      { unit: 'ram', from: 6, weight: 2 },
      { unit: 'giant', from: 7, weight: 1 },
    ],
    budget: { base: 5, growth: 0.6, pow: 1.35 },
    boss: 'boss_warlord',
    bridges: [],
  },
  swamp: {
    id: 'swamp',
    nights: 10,
    seed: 4242,
    half: 37,
    startCoins: 9,
    palette: {
      grass: 0x8fbf8a, grass2: 0x7aae80, meadow: 0xa9c98b, path: 0xc9b48a, sand: 0xd6cfa0, rock: 0x9fa6a8, cliff: 0x86908f,
      snow: 0xeef2f0, water: 0x6fb3a8, fogDay: 0xc4ddd3, fogNight: 0x18282c, skyDay: 0xb7d8cc, skyNight: 0x10201f,
      leaves: [0x6d9e6a, 0x7fae6e, 0x8fae5e, 0x5c8f66],
    },
    terrain: {
      hills: [[18, 20, 6, 1.4], [-8, -22, 6, 1.2], [26, -16, 5, 1.4]],
      ponds: [[13, 23, 5], [-11, -21, 4.5], [24, 2, 3.5], [-12, 22, 4], [29, -18, 3], [10, -27, 3]],
      rivers: [{ pts: [[-30, -46], [-25, -24], [-21, -6], [-25, 14], [-36, 44]], w: 6 }],
      rocks: [[14, -9, 2.5], [-14, 10, 2]],
      edge: 4,
      noise: 0.35,
      treeDensity: 0.75,
      trees: ['willow', 'willow', 'round', 'dead', 'pine'],
    },
    slots: [
      S('castle', 'castle', 0, 0),
      S('farm1', 'farm', 9, 11), S('farm2', 'farm', 13, 15.5), S('farm3', 'farm', -8, 9),
      S('fish1', 'fish', -17, -12), S('fish2', 'fish', 6.5, 19.8), S('fish3', 'fish', 18, 0),
      S('mine1', 'mine', 14, -11),
      S('tower1', 'tower', -12, -9.5), S('tower2', 'tower', 13, -2), S('tower3', 'tower', -6, 16), S('tower4', 'tower', 4, -18),
      S('magic1', 'magic', -6, -7), S('magic2', 'magic', 6, 4.5),
      S('barracks1', 'barracks', -8, 3.5), S('barracks2', 'barracks', 2, -10),
      S('range1', 'range', 3.5, 10),
      S('forge1', 'forge', -4, -11.5),
      W('wall1', 0, 0.62), W('wall2', 1, 0.52), W('wall3', 2, 0.55), W('wall4', 3, 0.5),
    ],
    paths: [
      [[-42, -9], [-30, -8], [-18, -6], [-9, -3], [-3.2, -1]],
      [[36, -38], [24, -27], [14, -19.5], [6, -6], [2.5, -2.5]],
      [[-3, 42], [-1, 30], [-2, 22], [-1, 12], [-0.3, 3.4]],
      [[42, 12], [30, 9], [20, 7], [9, 1.5], [3.4, 0.5]],
    ],
    schedule: [[0], [1], [0, 2], [1, 3], [0, 1], [2, 3], [0, 1, 2], [1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
    roster: [
      { unit: 'grunt', from: 1, weight: 9 },
      { unit: 'runner', from: 1, weight: 5 },
      { unit: 'wisp', from: 2, weight: 5 },
      { unit: 'skirmisher', from: 3, weight: 4 },
      { unit: 'shieldbearer', from: 4, weight: 3 },
      { unit: 'raider', from: 4, weight: 3 },
      { unit: 'ram', from: 6, weight: 2 },
      { unit: 'giant', from: 7, weight: 1.2 },
    ],
    budget: { base: 6, growth: 0.62, pow: 1.4 },
    boss: 'boss_hag',
    bridges: [{ x: -21.6, z: -6.2, rot: 0, len: 9 }],
  },
  pass: {
    id: 'pass',
    nights: 12,
    seed: 9001,
    half: 35,
    startCoins: 10,
    palette: {
      grass: 0xa8c98c, grass2: 0x95b884, meadow: 0xc2d69a, path: 0xd8c3a0, sand: 0xd9d0b4, rock: 0xaaa5b6, cliff: 0x8e889c,
      snow: 0xf6f7fc, water: 0x86c3dc, fogDay: 0xd5e0ea, fogNight: 0x161c33, skyDay: 0xc7dcee, skyNight: 0x11162e,
      leaves: [0x6e9f78, 0x5d8e70, 0x7fae7e, 0x8fb880],
    },
    terrain: {
      hills: [
        [-22, -22, 11, 9], [22, -22, 11, 10], [22, 22, 11, 9], [-22, 22, 11, 10],
        [-34, -12, 7, 7], [-12, -34, 7, 8], [34, -12, 7, 7], [12, -34, 7, 8],
        [34, 14, 7, 8], [14, 34, 7, 7], [-34, 14, 7, 7], [-14, 34, 7, 8],
      ],
      ponds: [[-9, -11, 2.6]],
      rivers: [],
      rocks: [[-14.5, 12.5, 2.5], [17.5, -11.5, 2.5], [14.5, 13.5, 2.5], [-15, -17, 2]],
      edge: 12,
      noise: 0.6,
      treeDensity: 0.6,
      trees: ['pine', 'snowpine', 'pine', 'birch'],
    },
    slots: [
      S('castle', 'castle', 0, 0),
      S('farm1', 'farm', -6, -6), S('farm2', 'farm', 6, 6.5),
      S('fish1', 'fish', -13, -14),
      S('mine1', 'mine', -12, 10.5), S('mine2', 'mine', 15, -9.5), S('mine3', 'mine', 12, 11),
      S('tower1', 'tower', 6, -6.5), S('tower2', 'tower', -6.5, 6), S('tower3', 'tower', 6.5, -17), S('tower4', 'tower', -17, -6.5), S('tower5', 'tower', 17.5, 7.5),
      S('magic1', 'magic', -5, -16.5), S('magic2', 'magic', 6.5, 17),
      S('barracks1', 'barracks', 12, -4.5), S('barracks2', 'barracks', -12.5, 4.5),
      S('range1', 'range', -7.5, 13), S('range2', 'range', 9.5, -12.5),
      S('forge1', 'forge', -12, -7),
      W('wall1', 0, 0.58), W('wall2', 1, 0.6), W('wall3', 2, 0.6), W('wall4', 3, 0.58),
    ],
    paths: [
      [[2, -42], [0, -30], [3, -19], [2, -8], [0.5, -3.4]],
      [[-42, -2], [-30, 2], [-19, -1], [-8, 0], [-3.4, 0]],
      [[42, 4], [30, 0], [19, 2], [8, 1], [3.4, 0.5]],
      [[-4, 42], [-2, 30], [-3, 19], [-2, 8], [-0.5, 3.4]],
    ],
    schedule: [[0], [1], [0, 2], [3], [1, 2], [0, 3], [0, 1, 2], [1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
    roster: [
      { unit: 'grunt', from: 1, weight: 8 },
      { unit: 'runner', from: 1, weight: 5 },
      { unit: 'shieldbearer', from: 2, weight: 4 },
      { unit: 'skirmisher', from: 2, weight: 4 },
      { unit: 'wisp', from: 3, weight: 4 },
      { unit: 'raider', from: 3, weight: 3 },
      { unit: 'ram', from: 4, weight: 2.5 },
      { unit: 'giant', from: 5, weight: 1.5 },
    ],
    budget: { base: 7, growth: 0.62, pow: 1.45 },
    boss: 'boss_colossus',
    bridges: [],
  },
};

export const MAP_IDS: MapId[] = ['valley', 'swamp', 'pass'];
