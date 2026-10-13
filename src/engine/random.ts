export interface SeededRandom {
  next(): number;
  range(minimum: number, maximum: number): number;
  integer(minimum: number, maximum: number): number;
  chance(probability: number): boolean;
  pick<T>(array: readonly T[]): T;
  readonly seed: number;
}

class Mulberry32Random implements SeededRandom {
  readonly seed: number;
  private state: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(minimum: number, maximum: number): number {
    if (maximum < minimum) {
      throw new RangeError('maximum must be greater than or equal to minimum');
    }
    return minimum + this.next() * (maximum - minimum);
  }

  integer(minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
      throw new RangeError('integer bounds must be whole numbers with maximum at least minimum');
    }
    return minimum + Math.floor(this.next() * (maximum - minimum + 1));
  }

  chance(probability: number): boolean {
    if (probability < 0 || probability > 1) {
      throw new RangeError('probability must be between 0 and 1');
    }
    return this.next() < probability;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new RangeError('cannot pick from an empty array');
    }
    const selected = array[Math.floor(this.next() * array.length)];
    if (selected === undefined) {
      throw new RangeError('cannot pick from an empty array');
    }
    return selected;
  }
}

export function createRandom(seed: number): SeededRandom {
  return new Mulberry32Random(seed);
}
