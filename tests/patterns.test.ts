import { describe, expect, it } from 'vitest';
import { aimedVelocity, fanVelocities, ringVelocities } from '../src/game/patterns';

describe('bullet patterns', () => {
  it('ring spreads bullets evenly at the requested speed', () => {
    const velocities = ringVelocities(8, 120, 0);
    expect(velocities).toHaveLength(8);
    for (const velocity of velocities) {
      expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(120, 5);
    }
    expect(velocities[0].x).toBeCloseTo(120, 5);
    expect(velocities[0].y).toBeCloseTo(0, 5);
    expect(velocities[2].y).toBeCloseTo(120, 5);
  });

  it('aimed velocity points from shooter to target', () => {
    const velocity = aimedVelocity({ x: 0, y: 0 }, { x: 30, y: 40 }, 100);
    expect(velocity.x).toBeCloseTo(60, 5);
    expect(velocity.y).toBeCloseTo(80, 5);
  });

  it('fan stays symmetric around its center angle', () => {
    const velocities = fanVelocities(Math.PI / 2, Math.PI / 3, 3, 90);
    expect(velocities).toHaveLength(3);
    expect(velocities[1].x).toBeCloseTo(0, 5);
    expect(velocities[1].y).toBeCloseTo(90, 5);
    expect(velocities[0].x).toBeCloseTo(-velocities[2].x, 5);
  });
});
