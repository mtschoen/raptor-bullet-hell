// Short synthesized effects: shaped oscillator and noise bursts, no audio assets.

interface ToneParameters {
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  waveform: OscillatorType;
  volume: number;
  delaySeconds?: number;
}

export class SoundEffects {
  private audioContext: AudioContext | null;
  private outputNode: AudioNode | null;
  private masterGainNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastShootTimeSeconds = -1;

  public constructor(audioContext: AudioContext | null, outputNode?: AudioNode) {
    this.audioContext = audioContext;
    this.outputNode = outputNode ?? null;
    this.rebuildGraph();
  }

  public attachAudioContext(audioContext: AudioContext, outputNode: AudioNode): void {
    this.audioContext = audioContext;
    this.outputNode = outputNode;
    this.rebuildGraph();
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGainNode !== null && this.audioContext !== null) {
      this.masterGainNode.gain.setTargetAtTime(
        muted ? 0 : 0.85,
        this.audioContext.currentTime,
        0.01,
      );
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setMasterVolume(volume: number): void {
    if (this.masterGainNode === null || this.audioContext === null || this.muted) {
      return;
    }
    const clampedVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
    this.masterGainNode.gain.setTargetAtTime(clampedVolume, this.audioContext.currentTime, 0.01);
  }

  public shoot(): void {
    // Player fire is rapid, so repeats inside one frame window are dropped.
    if (this.audioContext !== null) {
      const currentTime = this.audioContext.currentTime;
      if (currentTime - this.lastShootTimeSeconds < 0.03) {
        return;
      }
      this.lastShootTimeSeconds = currentTime;
    }
    this.playTone({
      startFrequency: 880,
      endFrequency: 320,
      durationSeconds: 0.08,
      waveform: 'square',
      volume: 0.12,
    });
  }

  public enemyShoot(): void {
    this.playTone({
      startFrequency: 340,
      endFrequency: 180,
      durationSeconds: 0.1,
      waveform: 'sawtooth',
      volume: 0.08,
    });
  }

  public explosion(size: number): void {
    const clampedSize = Math.min(3, Math.max(0.25, Number.isFinite(size) ? size : 1));
    this.playNoiseBurst(0.25 + clampedSize * 0.18, 400 + clampedSize * 120, 0.32);
    this.playTone({
      startFrequency: 160,
      endFrequency: 40,
      durationSeconds: 0.25 + clampedSize * 0.15,
      waveform: 'sine',
      volume: 0.35,
    });
  }

  public hit(): void {
    this.playTone({
      startFrequency: 220,
      endFrequency: 90,
      durationSeconds: 0.07,
      waveform: 'square',
      volume: 0.16,
    });
    this.playNoiseBurst(0.06, 2500, 0.1);
  }

  public powerUp(): void {
    const baseFrequency = 523.25;
    this.playTone({
      startFrequency: baseFrequency,
      endFrequency: baseFrequency,
      durationSeconds: 0.09,
      waveform: 'square',
      volume: 0.14,
    });
    this.playTone({
      startFrequency: baseFrequency * 1.25,
      endFrequency: baseFrequency * 1.25,
      durationSeconds: 0.09,
      waveform: 'square',
      volume: 0.14,
      delaySeconds: 0.08,
    });
    this.playTone({
      startFrequency: baseFrequency * 1.5,
      endFrequency: baseFrequency * 2,
      durationSeconds: 0.16,
      waveform: 'square',
      volume: 0.14,
      delaySeconds: 0.16,
    });
  }

  public bomb(): void {
    this.playNoiseBurst(0.7, 300, 0.45);
    this.playTone({
      startFrequency: 120,
      endFrequency: 30,
      durationSeconds: 0.7,
      waveform: 'sine',
      volume: 0.45,
    });
    this.playTone({
      startFrequency: 800,
      endFrequency: 60,
      durationSeconds: 0.4,
      waveform: 'sawtooth',
      volume: 0.12,
    });
  }

  public playerDown(): void {
    this.playNoiseBurst(0.6, 500, 0.35);
    this.playTone({
      startFrequency: 440,
      endFrequency: 55,
      durationSeconds: 0.65,
      waveform: 'sawtooth',
      volume: 0.25,
    });
    this.playTone({
      startFrequency: 220,
      endFrequency: 40,
      durationSeconds: 0.8,
      waveform: 'triangle',
      volume: 0.25,
      delaySeconds: 0.08,
    });
  }

  public uiClick(): void {
    this.playTone({
      startFrequency: 660,
      endFrequency: 660,
      durationSeconds: 0.045,
      waveform: 'square',
      volume: 0.1,
    });
  }

  private rebuildGraph(): void {
    this.masterGainNode = null;
    this.noiseBuffer = null;
    if (this.audioContext === null) {
      return;
    }
    const destination = this.outputNode ?? this.audioContext.destination;
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = this.muted ? 0 : 0.85;
    this.masterGainNode.connect(destination);
    const bufferLength = Math.max(1, Math.floor(this.audioContext.sampleRate * 1));
    this.noiseBuffer = this.audioContext.createBuffer(
      1,
      bufferLength,
      this.audioContext.sampleRate,
    );
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < channelData.length; index += 1) {
      channelData[index] = Math.random() * 2 - 1;
    }
  }

  private isReady(): boolean {
    return this.audioContext !== null && this.masterGainNode !== null && !this.muted;
  }

  private playTone(parameters: ToneParameters): void {
    if (!this.isReady() || this.audioContext === null || this.masterGainNode === null) {
      return;
    }
    const startTimeSeconds = this.audioContext.currentTime + (parameters.delaySeconds ?? 0);
    const endTimeSeconds = startTimeSeconds + parameters.durationSeconds;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = parameters.waveform;
    oscillator.frequency.setValueAtTime(Math.max(1, parameters.startFrequency), startTimeSeconds);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, parameters.endFrequency),
      endTimeSeconds,
    );
    gainNode.gain.setValueAtTime(parameters.volume, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGainNode);
    oscillator.start(startTimeSeconds);
    oscillator.stop(endTimeSeconds + 0.02);
  }

  private playNoiseBurst(durationSeconds: number, filterFrequency: number, volume: number): void {
    if (
      !this.isReady() ||
      this.audioContext === null ||
      this.masterGainNode === null ||
      this.noiseBuffer === null
    ) {
      return;
    }
    const startTimeSeconds = this.audioContext.currentTime;
    const source = this.audioContext.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrequency, startTimeSeconds);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, filterFrequency * 0.3),
      startTimeSeconds + durationSeconds,
    );
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTimeSeconds + durationSeconds);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGainNode);
    source.start(startTimeSeconds, Math.random() * 0.5);
    source.stop(startTimeSeconds + durationSeconds + 0.02);
  }
}
