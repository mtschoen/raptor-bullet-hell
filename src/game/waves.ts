export type Formation = 'vee' | 'line' | 'pincer' | 'ring' | 'dive';

export type EnemyKind = 'fighter' | 'weaver' | 'bomber' | 'interceptor' | 'boss' | 'tank' | 'flak-site';

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  formation: Formation;
  entryDelaySeconds: number;
}

export interface Wave {
  waveNumber: number;
  isBossWave: boolean;
  groups: WaveGroup[];
}

export const WAVE_DURATION_SECONDS = 45;

const formationCycle: Formation[] = ['vee', 'line', 'pincer', 'ring', 'dive'];
const kindCycle: EnemyKind[] = ['fighter', 'weaver', 'bomber', 'interceptor'];

function groundGroup(waveNumber: number, entryDelaySeconds: number): WaveGroup {
  const isTankWave = waveNumber % 2 === 0;
  return {
    kind: isTankWave ? 'tank' : 'flak-site',
    count: 2 + Math.floor((waveNumber - 2) / 2),
    formation: isTankWave ? 'line' : 'vee',
    entryDelaySeconds,
  };
}

export function buildWave(waveNumber: number): Wave {
  const normalizedWaveNumber = Math.max(1, Math.floor(waveNumber));
  const isBossWave = normalizedWaveNumber % 5 === 0;

  if (isBossWave) {
    const escortCount = 6 + normalizedWaveNumber * 2;
    const escortFormation = formationCycle[normalizedWaveNumber % formationCycle.length];
    return {
      waveNumber: normalizedWaveNumber,
      isBossWave: true,
      groups: [
        { kind: 'boss', count: 1, formation: 'line', entryDelaySeconds: 2 },
        {
          kind: 'fighter',
          count: Math.ceil(escortCount / 2),
          formation: escortFormation,
          entryDelaySeconds: 0,
        },
        {
          kind: 'interceptor',
          count: Math.floor(escortCount / 2),
          formation: 'pincer',
          entryDelaySeconds: 8,
        },
        groundGroup(normalizedWaveNumber, 12),
      ],
    };
  }

  const totalCount = 6 + (normalizedWaveNumber - 1) * 4;
  const groupCount = Math.min(2 + Math.floor((normalizedWaveNumber - 1) / 2), 4);
  const baseCount = Math.floor(totalCount / groupCount);
  const remainder = totalCount % groupCount;
  const groups: WaveGroup[] = [];

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    groups.push({
      kind: kindCycle[(normalizedWaveNumber + groupIndex) % kindCycle.length],
      count: baseCount + (groupIndex < remainder ? 1 : 0),
      formation: formationCycle[(normalizedWaveNumber + groupIndex) % formationCycle.length],
      entryDelaySeconds: groupIndex * 6,
    });
  }

  if (normalizedWaveNumber >= 2) {
    groups.push(groundGroup(normalizedWaveNumber, groupCount * 6));
  }

  return {
    waveNumber: normalizedWaveNumber,
    isBossWave: false,
    groups,
  };
}
