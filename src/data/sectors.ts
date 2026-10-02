import type { SectorDef, SectorId } from './types';

export const SECTORS: Record<SectorId, SectorDef> = {
  // Оперативная память — baseline
  ram: { id: 'ram', bg: 0x070418, grid: 0x2a1f6e, accent: 0x29f6ff, hpMult: 1, speedMult: 1, spawnMult: 1, xpMult: 1, bitsMult: 1, dmgMult: 1 },
  // Процессор — «Перегрев»: enemies are faster
  cpu: {
    id: 'cpu', bg: 0x140806, grid: 0x6e2a12, accent: 0xff9a3d, hpMult: 1.5, speedMult: 1.15, spawnMult: 1.05, xpMult: 1.1, bitsMult: 1.4, dmgMult: 1.15,
    weights: { dasher: 1.8, worm: 1.5, bomber: 1.5 },
  },
  // Видеокарта — «Артефакты»: more enemies, more XP
  gpu: {
    id: 'gpu', bg: 0x03120c, grid: 0x15603f, accent: 0x6dff8a, hpMult: 2.1, speedMult: 1.1, spawnMult: 1.3, xpMult: 1.25, bitsMult: 1.9, dmgMult: 1.3,
    weights: { glitch: 2, spawner: 1.6, nano: 1.5, splitter: 1.5 },
  },
  // Корзина — «Повреждённые данные»: tanky enemies, rich rewards
  bin: {
    id: 'bin', bg: 0x12040a, grid: 0x6a1230, accent: 0xff2a55, hpMult: 3, speedMult: 1.15, spawnMult: 1.25, xpMult: 1.3, bitsMult: 2.6, dmgMult: 1.45,
    weights: { shielded: 1.8, medic: 1.6, trojan: 1.5, rootkit: 1.8 },
  },
};

export const SECTOR_IDS: SectorId[] = ['ram', 'cpu', 'gpu', 'bin'];
