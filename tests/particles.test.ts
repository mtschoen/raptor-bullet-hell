import { describe, expect, it } from 'vitest';
import { ParticlePool } from '../src/effects/particles';

describe('ParticlePool', () => {
  it('moves live particles and retires them when life ends', () => {
    const pool = new ParticlePool(4);
    pool.spawn({ x: 10, y: 10, velocityX: 60, velocityY: -30, lifeSeconds: 0.5, size: 3 });
    expect(pool.aliveCount).toBe(1);
    pool.update(0.25);
    expect(pool.aliveCount).toBe(1);
    pool.update(0.3);
    expect(pool.aliveCount).toBe(0);
  });

  it('never exceeds capacity and reuses retired slots', () => {
    const pool = new ParticlePool(2);
    for (let index = 0; index < 5; index += 1) {
      pool.spawn({ x: 0, y: 0, velocityX: 0, velocityY: 0, lifeSeconds: 0.1, size: 2 });
    }
    expect(pool.aliveCount).toBe(2);
    pool.update(0.2);
    expect(pool.aliveCount).toBe(0);
    pool.spawn({ x: 5, y: 5, velocityX: 0, velocityY: 0, lifeSeconds: 1, size: 2 });
    expect(pool.aliveCount).toBe(1);
  });
});
