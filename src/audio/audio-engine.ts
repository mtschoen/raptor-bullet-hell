// Facade that owns the single shared AudioContext for music and effects.
// The context is created lazily and resumed on the first user gesture, which
// matches browser autoplay rules. Missing Web Audio support is a quiet no-op.

import { MusicEngine } from "./music";
import { SoundEffects } from "./sound-effects";

interface AudioContextConstructorHolder {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function resolveAudioContextConstructor(): typeof AudioContext | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const holder = globalThis as unknown as AudioContextConstructorHolder;
  return holder.AudioContext ?? holder.webkitAudioContext ?? null;
}

export class AudioEngine {
  public readonly music: MusicEngine;
  public readonly effects: SoundEffects;
  // Alias kept for callers that prefer the longer name; same instance as effects.
  public readonly soundEffects: SoundEffects;

  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private contextCreationFailed = false;
  private muted = false;
  private gestureListenerAttached = false;

  private readonly handleFirstGesture = (): void => {
    void this.resume();
  };

  public constructor() {
    this.music = new MusicEngine(null);
    this.effects = new SoundEffects(null);
    this.soundEffects = this.effects;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public get isAvailable(): boolean {
    return this.audioContext !== null || (!this.contextCreationFailed && resolveAudioContextConstructor() !== null);
  }

  public get hasContext(): boolean {
    return this.audioContext !== null;
  }

  // Call from any pointer or key handler; safe to call repeatedly.
  public unlock(): void {
    void this.resume();
  }

  public handleUserGesture(): void {
    void this.resume();
  }

  public async resume(): Promise<void> {
    const audioContext = this.ensureContext();
    if (audioContext === null) {
      return;
    }
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {
        // A resume can only succeed during a real gesture; the next one retries.
      }
    }
  }

  // Attach one-time gesture listeners when a document-like target is supplied.
  // Kept optional so the engine itself stays free of DOM assumptions.
  public attachGestureListeners(target: EventTarget): void {
    if (this.gestureListenerAttached) {
      return;
    }
    this.gestureListenerAttached = true;
    const options: AddEventListenerOptions = { once: true, passive: true };
    target.addEventListener("pointerdown", this.handleFirstGesture, options);
    target.addEventListener("keydown", this.handleFirstGesture, options);
    target.addEventListener("touchstart", this.handleFirstGesture, options);
  }

  public startMusic(): void {
    void this.resume().then(() => {
      this.music.start();
    });
  }

  public stopMusic(): void {
    this.music.stop();
  }

  public setIntensity(value: number): void {
    this.music.setIntensity(value);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.effects.setMuted(muted);
    if (this.masterGainNode !== null && this.audioContext !== null) {
      this.masterGainNode.gain.setTargetAtTime(muted ? 0 : 1, this.audioContext.currentTime, 0.01);
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public async dispose(): Promise<void> {
    this.music.stop();
    if (this.audioContext !== null) {
      try {
        await this.audioContext.close();
      } catch {
        // Closing an already closed context is harmless.
      }
      this.audioContext = null;
      this.masterGainNode = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext !== null) {
      return this.audioContext;
    }
    if (this.contextCreationFailed) {
      return null;
    }
    const constructorFunction = resolveAudioContextConstructor();
    if (constructorFunction === null) {
      this.contextCreationFailed = true;
      return null;
    }
    try {
      this.audioContext = new constructorFunction();
    } catch {
      this.contextCreationFailed = true;
      this.audioContext = null;
      return null;
    }
    try {
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.muted ? 0 : 1;
      this.masterGainNode.connect(this.audioContext.destination);
      this.music.attachAudioContext(this.audioContext, this.masterGainNode);
      this.effects.attachAudioContext(this.audioContext, this.masterGainNode);
      this.effects.setMuted(this.muted);
    } catch {
      // A half-built graph must not take down the game; audio stays silent.
      this.masterGainNode = null;
    }
    return this.audioContext;
  }
}
