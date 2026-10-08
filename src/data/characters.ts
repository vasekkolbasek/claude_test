import type { CharacterDef, CharacterId } from './types';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  spark: { id: 'spark', weapon: 'pulse', color: 0x29f6ff, bonus: { speed: 0.08 }, unlock: { type: 'free' } },
  // Sentinel (orbital blades) is the rewarded-video character, available from the start
  sentinel: { id: 'sentinel', weapon: 'orbit', color: 0xff3df2, bonus: { maxHp: 30, armor: 1 }, unlock: { type: 'ads', count: 5 } },
  volt: { id: 'volt', weapon: 'chain', color: 0x8fd8ff, bonus: { haste: 0.1 }, unlock: { type: 'bits', cost: 500 } },
  sapper: { id: 'sapper', weapon: 'mines', color: 0xffd23d, bonus: { area: 0.15 }, unlock: { type: 'bits', cost: 900 } },
  hunter: { id: 'hunter', weapon: 'missiles', color: 0xff9a3d, bonus: { crit: 0.1 }, unlock: { type: 'bits', cost: 1400 } },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
