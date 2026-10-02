import { WORKSHOP, WORKSHOP_BY_ID } from '../data/workshop';
import type { StatBonus } from '../game/stats';
import type { SaveData } from './save';

export function nodeLevel(save: SaveData, id: string): number {
  return save.workshop[id] ?? 0;
}

export function workshopBonuses(save: SaveData): StatBonus {
  const out: StatBonus = {};
  for (const n of WORKSHOP) {
    const lv = nodeLevel(save, n.id);
    if (lv > 0) out[n.stat] = (out[n.stat] ?? 0) + n.per * lv;
  }
  return out;
}

export function nodeAvailable(save: SaveData, id: string): boolean {
  const n = WORKSHOP_BY_ID[id];
  return !!n && (!n.requires || nodeLevel(save, n.requires) > 0);
}

export function nodeCost(save: SaveData, id: string): number | null {
  const n = WORKSHOP_BY_ID[id];
  const lv = nodeLevel(save, id);
  if (!n || lv >= n.max) return null;
  return n.costs[lv];
}

export function buyNode(save: SaveData, id: string): boolean {
  const cost = nodeCost(save, id);
  if (cost === null || !nodeAvailable(save, id) || save.bits < cost) return false;
  save.bits -= cost;
  save.workshop[id] = nodeLevel(save, id) + 1;
  return true;
}

export function totalWorkshopLevels(save: SaveData): number {
  let n = 0;
  for (const k in save.workshop) n += save.workshop[k];
  return n;
}
