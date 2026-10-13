export interface Velocity {
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

function velocityAtAngle(angleRadians: number, speed: number): Velocity {
  return {
    x: Math.cos(angleRadians) * speed,
    y: Math.sin(angleRadians) * speed,
  };
}

export function ringVelocities(count: number, speed: number, offsetRadians: number): Velocity[] {
  const normalizedCount = Math.max(0, Math.floor(count));
  const velocities: Velocity[] = [];
  for (let index = 0; index < normalizedCount; index += 1) {
    const angleRadians = offsetRadians + (index * Math.PI * 2) / normalizedCount;
    velocities.push(velocityAtAngle(angleRadians, speed));
  }
  return velocities;
}

export function aimedVelocity(from: Point, to: Point, speed: number): Velocity {
  const differenceX = to.x - from.x;
  const differenceY = to.y - from.y;
  const distance = Math.hypot(differenceX, differenceY);
  if (distance === 0) {
    return { x: speed, y: 0 };
  }
  return {
    x: (differenceX / distance) * speed,
    y: (differenceY / distance) * speed,
  };
}

export function fanVelocities(
  centerAngleRadians: number,
  spreadRadians: number,
  count: number,
  speed: number,
): Velocity[] {
  const normalizedCount = Math.max(0, Math.floor(count));
  if (normalizedCount === 0) {
    return [];
  }
  if (normalizedCount === 1) {
    return [velocityAtAngle(centerAngleRadians, speed)];
  }
  const velocities: Velocity[] = [];
  const startingAngleRadians = centerAngleRadians - spreadRadians / 2;
  const stepRadians = spreadRadians / (normalizedCount - 1);
  for (let index = 0; index < normalizedCount; index += 1) {
    velocities.push(velocityAtAngle(startingAngleRadians + index * stepRadians, speed));
  }
  return velocities;
}

export function spiralVelocities(
  step: number,
  armCount: number,
  speed: number,
  turnRadians: number,
): Velocity[] {
  const normalizedArmCount = Math.max(0, Math.floor(armCount));
  const baseAngleRadians = Math.floor(step) * turnRadians;
  const velocities: Velocity[] = [];
  for (let armIndex = 0; armIndex < normalizedArmCount; armIndex += 1) {
    const angleRadians = baseAngleRadians + (armIndex * Math.PI * 2) / normalizedArmCount;
    velocities.push(velocityAtAngle(angleRadians, speed));
  }
  return velocities;
}

export class PatternClock {
  private readonly intervalSeconds: number;
  private accumulatedSeconds: number;

  public constructor(intervalSeconds: number) {
    this.intervalSeconds = Math.max(0.000001, intervalSeconds);
    this.accumulatedSeconds = 0;
  }

  public update(deltaSeconds: number): boolean {
    if (deltaSeconds <= 0) {
      return false;
    }
    this.accumulatedSeconds += deltaSeconds;
    if (this.accumulatedSeconds < this.intervalSeconds) {
      return false;
    }
    this.accumulatedSeconds %= this.intervalSeconds;
    return true;
  }

  public reset(): void {
    this.accumulatedSeconds = 0;
  }
}
