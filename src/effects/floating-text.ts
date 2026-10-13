export interface FloatingTextView {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  lifeSeconds: number;
  remainingLifeSeconds: number;
  riseSpeed: number;
}

export interface FloatingTextSpawnOptions {
  lifeSeconds?: number;
  riseSpeed?: number;
}

interface FloatingTextSlot extends FloatingTextView {
  alive: boolean;
}

function createSlot(): FloatingTextSlot {
  return {
    x: 0,
    y: 0,
    text: '',
    color: '#ffffff',
    alpha: 0,
    lifeSeconds: 0,
    remainingLifeSeconds: 0,
    riseSpeed: 0,
    alive: false,
  };
}

export class FloatingTextPool {
  readonly capacity: number;
  private readonly slots: FloatingTextSlot[];
  private liveCount = 0;

  constructor(capacity = 32) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.slots = Array.from({ length: this.capacity }, () => createSlot());
  }

  get aliveCount(): number {
    return this.liveCount;
  }

  spawn(
    x: number,
    y: number,
    text: string,
    color = '#ffffff',
    options: FloatingTextSpawnOptions = {},
  ): boolean {
    if (text.length === 0) {
      return false;
    }
    const slot = this.slots.find((candidate) => !candidate.alive);
    if (slot === undefined) {
      return false;
    }
    slot.x = x;
    slot.y = y;
    slot.text = text;
    slot.color = color;
    slot.lifeSeconds = options.lifeSeconds ?? 1;
    slot.remainingLifeSeconds = slot.lifeSeconds;
    slot.riseSpeed = options.riseSpeed ?? 48;
    slot.alpha = 1;
    slot.alive = true;
    this.liveCount += 1;
    return true;
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
      slot.y -= slot.riseSpeed * deltaSeconds;
      slot.alpha = Math.min(
        1,
        Math.max(0, slot.remainingLifeSeconds / slot.lifeSeconds),
      );
    }
  }

  forEachAlive(callback: (entry: Readonly<FloatingTextView>) => void): void {
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
