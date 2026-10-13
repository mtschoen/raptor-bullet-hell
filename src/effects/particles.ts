export interface ParticleSpawnOptions {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifeSeconds: number;
  size: number;
  color?: string;
  gravity?: number;
  drag?: number;
}

export interface BurstOptions {
  count: number;
  speed: number;
  lifeSeconds?: number;
  size?: number;
  color?: string;
  gravity?: number;
  drag?: number;
  directionRadians?: number;
  spreadRadians?: number;
}

export interface ParticleView {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifeSeconds: number;
  remainingLifeSeconds: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
  drag: number;
}

interface ParticleSlot extends ParticleView {
  alive: boolean;
}

const defaultColor = '#ffd166';

function createSlot(): ParticleSlot {
  return {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    lifeSeconds: 0,
    remainingLifeSeconds: 0,
    size: 0,
    color: defaultColor,
    alpha: 0,
    gravity: 0,
    drag: 0,
    alive: false,
  };
}

export class ParticlePool {
  readonly capacity: number;
  private readonly slots: ParticleSlot[];
  private liveCount = 0;
  private burstSequence = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.slots = Array.from({ length: this.capacity }, () => createSlot());
  }

  get aliveCount(): number {
    return this.liveCount;
  }

  spawn(options: ParticleSpawnOptions): boolean {
    if (options.lifeSeconds <= 0 || options.size <= 0) {
      return false;
    }
    const slot = this.slots.find((candidate) => !candidate.alive);
    if (slot === undefined) {
      return false;
    }
    slot.x = options.x;
    slot.y = options.y;
    slot.velocityX = options.velocityX;
    slot.velocityY = options.velocityY;
    slot.lifeSeconds = options.lifeSeconds;
    slot.remainingLifeSeconds = options.lifeSeconds;
    slot.size = options.size;
    slot.color = options.color ?? defaultColor;
    slot.alpha = 1;
    slot.gravity = options.gravity ?? 0;
    slot.drag = options.drag ?? 0;
    slot.alive = true;
    this.liveCount += 1;
    return true;
  }

  burst(x: number, y: number, options: BurstOptions): number {
    const count = Math.max(0, Math.floor(options.count));
    const lifeSeconds = options.lifeSeconds ?? 0.6;
    const size = options.size ?? 3;
    const directionRadians = options.directionRadians ?? 0;
    const spreadRadians = options.spreadRadians ?? Math.PI * 2;
    let spawnedCount = 0;
    for (let index = 0; index < count; index += 1) {
      const fraction = count <= 1 ? 0.5 : index / count;
      const angle =
        directionRadians - spreadRadians / 2 + spreadRadians * fraction;
      const speedFraction = 0.55 + 0.45 * (((this.burstSequence + index) % 5) / 4);
      const spawned = this.spawn({
        x,
        y,
        velocityX: Math.cos(angle) * options.speed * speedFraction,
        velocityY: Math.sin(angle) * options.speed * speedFraction,
        lifeSeconds,
        size,
        color: options.color,
        gravity: options.gravity,
        drag: options.drag,
      });
      if (spawned) {
        spawnedCount += 1;
      }
    }
    this.burstSequence += count;
    return spawnedCount;
  }

  update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }
    for (const slot of this.slots) {
      if (!slot.alive) {
        continue;
      }
      slot.remainingLifeSeconds -= deltaSeconds;
      if (slot.remainingLifeSeconds <= 0) {
        slot.alive = false;
        slot.alpha = 0;
        this.liveCount -= 1;
        continue;
      }
      slot.velocityY += slot.gravity * deltaSeconds;
      if (slot.drag > 0) {
        const retainedVelocity = Math.exp(-slot.drag * deltaSeconds);
        slot.velocityX *= retainedVelocity;
        slot.velocityY *= retainedVelocity;
      }
      slot.x += slot.velocityX * deltaSeconds;
      slot.y += slot.velocityY * deltaSeconds;
      slot.alpha = Math.min(
        1,
        Math.max(0, slot.remainingLifeSeconds / slot.lifeSeconds),
      );
    }
  }

  forEachAlive(callback: (particle: Readonly<ParticleView>) => void): void {
    for (const slot of this.slots) {
      if (slot.alive) {
        callback(slot);
      }
    }
  }

  clear(): void {
    for (const slot of this.slots) {
      slot.alive = false;
      slot.alpha = 0;
    }
    this.liveCount = 0;
  }
}
