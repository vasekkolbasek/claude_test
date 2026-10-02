import type { ProjKind } from './buildings';

export type WeaponId = 'sword' | 'bow' | 'spear' | 'staff';
export type AbilityId = 'whirl' | 'volley' | 'charge' | 'starfall';

export interface WeaponDef {
  id: WeaponId;
  damage: number;
  cooldown: number;
  range: number;
  projectile?: ProjKind;
  splash?: number;
  /** Extra targets hit by a melee swing (cleave). */
  cleave: number;
  ability: AbilityId;
  abilityCd: number;
  abilityDamage: number;
  abilityRadius: number;
  unlockLevel: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: { id: 'sword', damage: 17, cooldown: 0.55, range: 2.1, cleave: 2, ability: 'whirl', abilityCd: 10, abilityDamage: 55, abilityRadius: 4, unlockLevel: 1 },
  bow: { id: 'bow', damage: 11, cooldown: 0.55, range: 9.5, projectile: 'arrow', cleave: 0, ability: 'volley', abilityCd: 12, abilityDamage: 22, abilityRadius: 4.5, unlockLevel: 2 },
  spear: { id: 'spear', damage: 24, cooldown: 0.8, range: 3, cleave: 1, ability: 'charge', abilityCd: 8, abilityDamage: 70, abilityRadius: 2, unlockLevel: 3 },
  staff: { id: 'staff', damage: 14, cooldown: 0.9, range: 7.5, projectile: 'star', splash: 1.8, cleave: 0, ability: 'starfall', abilityCd: 14, abilityDamage: 40, abilityRadius: 6.5, unlockLevel: 5 },
};
export const WEAPON_IDS: WeaponId[] = ['sword', 'bow', 'spear', 'staff'];
