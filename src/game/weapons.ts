export interface WeaponDefinition {
  level: number;
  name: string;
  fireIntervalSeconds: number;
  bulletSpeed: number;
  spreadCount: number;
  damage: number;
}

export const WEAPON_DEFINITIONS: WeaponDefinition[] = [
  { level: 1, name: 'Pulse Cannon', fireIntervalSeconds: 0.15, bulletSpeed: 680, spreadCount: 1, damage: 1 },
  { level: 2, name: 'Twin Cannon', fireIntervalSeconds: 0.14, bulletSpeed: 700, spreadCount: 2, damage: 1 },
  { level: 3, name: 'Tri Blaster', fireIntervalSeconds: 0.12, bulletSpeed: 730, spreadCount: 3, damage: 1 },
  { level: 4, name: 'Raptor Barrage', fireIntervalSeconds: 0.11, bulletSpeed: 780, spreadCount: 5, damage: 2 },
];

export const MAXIMUM_WEAPON_LEVEL = 4;
export const MINIMUM_WEAPON_LEVEL = 1;

export function getWeaponDefinition(level: number): WeaponDefinition {
  const normalizedLevel = Math.min(
    MAXIMUM_WEAPON_LEVEL,
    Math.max(MINIMUM_WEAPON_LEVEL, Math.floor(level)),
  );
  return WEAPON_DEFINITIONS[normalizedLevel - 1];
}

export function nextWeaponLevel(current: number, pickedKind: string): number {
  const normalizedCurrent = Math.min(
    MAXIMUM_WEAPON_LEVEL,
    Math.max(MINIMUM_WEAPON_LEVEL, Math.floor(current)),
  );
  const upgradeKinds = new Set(['weapon', 'weaponUpgrade', 'power', 'powerup', 'upgrade', 'gun']);
  if (!upgradeKinds.has(pickedKind)) {
    return normalizedCurrent;
  }
  return Math.min(MAXIMUM_WEAPON_LEVEL, normalizedCurrent + 1);
}
