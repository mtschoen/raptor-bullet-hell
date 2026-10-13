export interface ScreenShakeOptions {
  maximumOffsetPixels?: number;
  decayPerSecond?: number;
  reducedMotion?: boolean;
}

export class ScreenShake {
  private readonly maximumOffsetPixels: number;
  private readonly decayPerSecond: number;
  private traumaValue = 0;
  private elapsedSeconds = 0;
  private currentOffsetX = 0;
  private currentOffsetY = 0;
  reducedMotion: boolean;

  constructor(options: ScreenShakeOptions = {}) {
    this.maximumOffsetPixels = options.maximumOffsetPixels ?? 14;
    this.decayPerSecond = options.decayPerSecond ?? 1.4;
    this.reducedMotion = options.reducedMotion ?? false;
  }

  get trauma(): number {
    return this.traumaValue;
  }

  get offsetX(): number {
    return this.currentOffsetX;
  }

  get offsetY(): number {
    return this.currentOffsetY;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) {
      this.traumaValue = 0;
      this.currentOffsetX = 0;
      this.currentOffsetY = 0;
    }
  }

  addTrauma(amount: number): void {
    if (this.reducedMotion || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.traumaValue = Math.min(1, Math.max(0, this.traumaValue + amount));
    this.refreshOffsets();
  }

  update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }
    this.elapsedSeconds += deltaSeconds;
    if (this.reducedMotion || this.traumaValue <= 0) {
      this.traumaValue = 0;
      this.currentOffsetX = 0;
      this.currentOffsetY = 0;
      return;
    }
    this.traumaValue = Math.max(0, this.traumaValue - this.decayPerSecond * deltaSeconds);
    this.refreshOffsets();
  }

  clear(): void {
    this.traumaValue = 0;
    this.currentOffsetX = 0;
    this.currentOffsetY = 0;
  }

  private refreshOffsets(): void {
    if (this.reducedMotion || this.traumaValue <= 0) {
      this.currentOffsetX = 0;
      this.currentOffsetY = 0;
      return;
    }
    const quadraticMagnitude = this.traumaValue * this.traumaValue * this.maximumOffsetPixels;
    const time = this.elapsedSeconds;
    this.currentOffsetX =
      quadraticMagnitude * (Math.sin(time * 47.3) * 0.7 + Math.sin(time * 89.1) * 0.3);
    this.currentOffsetY =
      quadraticMagnitude * (Math.cos(time * 53.7) * 0.7 + Math.sin(time * 97.9) * 0.3);
  }
}
