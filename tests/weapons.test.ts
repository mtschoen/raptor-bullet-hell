import { describe, expect, it } from 'vitest';
import { getWeaponDefinition, MAXIMUM_WEAPON_LEVEL } from '../src/game/weapons';

describe('weapon progression', () => {
  it('level 1 gun can kill a 3-health fighter in well under a second of perfect fire', () => {
    const definition = getWeaponDefinition(1);
    const damagePerSecond =
      (definition.spreadCount * definition.damage) / definition.fireIntervalSeconds;
    expect(damagePerSecond).toBeGreaterThanOrEqual(6);
  });

  it('damage per second grows at every level', () => {
    let previous = 0;
    for (let level = 1; level <= MAXIMUM_WEAPON_LEVEL; level += 1) {
      const definition = getWeaponDefinition(level);
      const damagePerSecond =
        (definition.spreadCount * definition.damage) / definition.fireIntervalSeconds;
      expect(damagePerSecond).toBeGreaterThan(previous);
      previous = damagePerSecond;
    }
  });
});
