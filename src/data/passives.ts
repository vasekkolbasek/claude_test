import type { PassiveDef, PassiveId } from './types';

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  might: { id: 'might', stat: 'might', per: 0.1, maxLevel: 5, color: 0xff4d6d },
  haste: { id: 'haste', stat: 'haste', per: 0.08, maxLevel: 5, color: 0xffd23d },
  speed: { id: 'speed', stat: 'speed', per: 0.08, maxLevel: 5, color: 0x6dffd9 },
  magnet: { id: 'magnet', stat: 'magnet', per: 0.3, maxLevel: 5, color: 0x29a8ff },
  armor: { id: 'armor', stat: 'armor', per: 1, maxLevel: 5, color: 0x9fb4d8 },
  regen: { id: 'regen', stat: 'regen', per: 0.3, maxLevel: 5, color: 0x6dff8a },
  crit: { id: 'crit', stat: 'crit', per: 0.05, maxLevel: 5, color: 0xff9a3d },
  area: { id: 'area', stat: 'area', per: 0.1, maxLevel: 5, color: 0xff3df2 },
  duration: { id: 'duration', stat: 'duration', per: 0.12, maxLevel: 5, color: 0xa35bff },
  luck: { id: 'luck', stat: 'luck', per: 0.12, maxLevel: 5, color: 0x3dffb0 },
  maxhp: { id: 'maxhp', stat: 'maxHp', per: 20, maxLevel: 5, color: 0xff6b9a },
  amount: { id: 'amount', stat: 'amount', per: 1, maxLevel: 2, integer: true, color: 0xffffff },
  growth: { id: 'growth', stat: 'growth', per: 0.08, maxLevel: 5, color: 0x8fd8ff },
};

export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
