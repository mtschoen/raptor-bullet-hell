import { describe, expect, it } from 'vitest';
import { buildWave } from '../src/game/waves';

describe('buildWave', () => {
  it('grows total pressure as waves advance', () => {
    const first = buildWave(1);
    const fourth = buildWave(4);
    const firstTotal = first.groups.reduce((sum, group) => sum + group.count, 0);
    const fourthTotal = fourth.groups.reduce((sum, group) => sum + group.count, 0);
    expect(fourthTotal).toBeGreaterThan(firstTotal);
  });

  it('marks every fifth wave as a boss wave with a boss group', () => {
    expect(buildWave(4).isBossWave).toBe(false);
    const bossWave = buildWave(5);
    expect(bossWave.isBossWave).toBe(true);
    expect(bossWave.groups.some((group) => group.kind === 'boss')).toBe(true);
  });

  it('keeps early waves free of bosses', () => {
    expect(buildWave(1).groups.every((group) => group.kind !== 'boss')).toBe(true);
  });

  it('adds ground groups from wave 2 onward but not in wave 1', () => {
    const groundKinds = ['tank', 'flak-site'];
    expect(buildWave(1).groups.every((group) => !groundKinds.includes(group.kind))).toBe(true);
    for (const waveNumber of [2, 3, 4]) {
      expect(buildWave(waveNumber).groups.some((group) => groundKinds.includes(group.kind))).toBe(true);
    }
  });
});
