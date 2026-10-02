import type { StatKey } from './types';

export interface WorkshopNode {
  id: string;
  stat: StatKey;
  /** stat value per level */
  per: number;
  max: number;
  /** cost of each level */
  costs: number[];
  requires: string | null;
  branch: 'core' | 'offense' | 'defense' | 'utility';
  icon: string;
}

function costs(base: number, n: number, growth = 1.75): number[] {
  return Array.from({ length: n }, (_, i) => Math.round((base * Math.pow(growth, i)) / 10) * 10);
}

export const WORKSHOP: WorkshopNode[] = [
  { id: 'core_dmg', stat: 'might', per: 0.06, max: 5, costs: costs(60, 5), requires: null, branch: 'core', icon: 'might' },
  { id: 'hp', stat: 'maxHp', per: 12, max: 5, costs: costs(50, 5), requires: null, branch: 'defense', icon: 'maxhp' },
  { id: 'speed', stat: 'speed', per: 0.04, max: 3, costs: costs(70, 3), requires: null, branch: 'utility', icon: 'speed' },
  { id: 'haste', stat: 'haste', per: 0.05, max: 4, costs: costs(120, 4), requires: 'core_dmg', branch: 'offense', icon: 'haste' },
  { id: 'area', stat: 'area', per: 0.06, max: 3, costs: costs(140, 3), requires: 'core_dmg', branch: 'offense', icon: 'area' },
  { id: 'crit', stat: 'crit', per: 0.03, max: 3, costs: costs(180, 3), requires: 'haste', branch: 'offense', icon: 'crit' },
  { id: 'amount', stat: 'amount', per: 1, max: 1, costs: [1800], requires: 'area', branch: 'offense', icon: 'amount' },
  { id: 'armor', stat: 'armor', per: 1, max: 3, costs: costs(150, 3), requires: 'hp', branch: 'defense', icon: 'armor' },
  { id: 'regen', stat: 'regen', per: 0.2, max: 3, costs: costs(130, 3), requires: 'hp', branch: 'defense', icon: 'regen' },
  { id: 'revive', stat: 'revives', per: 1, max: 2, costs: [700, 1600], requires: 'armor', branch: 'defense', icon: 'heal' },
  { id: 'magnet', stat: 'magnet', per: 0.12, max: 3, costs: costs(80, 3), requires: 'speed', branch: 'utility', icon: 'magnet' },
  { id: 'growth', stat: 'growth', per: 0.05, max: 4, costs: costs(140, 4), requires: 'magnet', branch: 'utility', icon: 'growth' },
  { id: 'greed', stat: 'greed', per: 0.08, max: 5, costs: costs(100, 5), requires: 'speed', branch: 'utility', icon: 'bits' },
  { id: 'luck', stat: 'luck', per: 0.08, max: 3, costs: costs(160, 3), requires: 'greed', branch: 'utility', icon: 'luck' },
  { id: 'reroll', stat: 'rerolls', per: 1, max: 3, costs: costs(200, 3, 1.8), requires: 'luck', branch: 'utility', icon: 'reroll' },
  { id: 'choice', stat: 'choices', per: 1, max: 1, costs: [2200], requires: 'reroll', branch: 'utility', icon: 'star' },
];

export const WORKSHOP_BY_ID: Record<string, WorkshopNode> = Object.fromEntries(WORKSHOP.map((n) => [n.id, n]));
