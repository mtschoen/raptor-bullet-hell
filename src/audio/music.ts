// Eighties hair metal loop, fully synthesized with Web Audio: distorted
// rhythm guitar chugs and stabs, picked bass, driving drums, and a lead
// guitar that joins at higher intensity.
// Scheduling is lookahead-based: a short interval wakes up and schedules
// every note whose start time falls inside the lookahead window, so
// stop() is clean.

const tempoBeatsPerMinute = 152;
const stepsPerBeat = 4;
const secondsPerStep = 60 / tempoBeatsPerMinute / stepsPerBeat;
const schedulerIntervalMilliseconds = 25;
const scheduleAheadSeconds = 0.12;
const stepsPerBar = 16;
const barCount = 4;
const totalStepCount = stepsPerBar * barCount;

// E minor power-chord riff across a four bar loop: E5, G5, A5, then C5
// for the first half of the last bar and D5 for the second half, which
// pushes back into the E5 downbeat. Values are MIDI note numbers for
// each chord root, played by the rhythm guitar around the second octave.
const barChordRootMidiNotes: readonly number[] = [40, 43, 45, 48];
const finalBarSecondHalfRootMidiNote = 50;
// Power chord shape: root, fifth, and octave.
const powerChordSemitoneOffsets: readonly number[] = [0, 7, 12];

// Lead licks in E minor pentatonic (E, G, A, B, D), one entry per
// sixteenth step across the four bar loop. Null entries are rests or
// the tail of a held note started on an earlier step.
const leadPatternMidiNotes: readonly (number | null)[] = [
  76,
  null,
  79,
  81,
  83,
  81,
  79,
  76,
  79,
  81,
  83,
  86,
  83,
  81,
  79,
  81,
  88,
  null,
  null,
  null,
  86,
  83,
  81,
  79,
  76,
  79,
  81,
  83,
  81,
  79,
  76,
  null,
  84,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  83,
  81,
  79,
  76,
  74,
  76,
  null,
  null,
  76,
  79,
  81,
  83,
  86,
  88,
  91,
  88,
  86,
  83,
  86,
  81,
  79,
  76,
  74,
  null,
];
// Steps where the lead note is held and bent up a whole step instead of
// played as part of a fast run. Indexes are into the four bar loop.
const leadBendStepIndexes: ReadonlySet<number> = new Set([16, 32]);

function midiNoteToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function buildDistortionCurve(driveAmount: number): Float32Array<ArrayBuffer> {
  const curveLength = 1024;
  const curve = new Float32Array(new ArrayBuffer(curveLength * Float32Array.BYTES_PER_ELEMENT));
  for (let index = 0; index < curveLength; index += 1) {
    const input = (index / (curveLength - 1)) * 2 - 1;
    curve[index] =
      ((3 + driveAmount) * input * 20 * (Math.PI / 180)) /
      (Math.PI + driveAmount * Math.abs(input));
  }
  return curve;
}

export class MusicEngine {
  private audioContext: AudioContext | null;
  private outputNode: AudioNode | null;
  private musicGainNode: GainNode | null = null;
  private rhythmDistortionNode: WaveShaperNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTimeSeconds = 0;
  private currentStep = 0;
  private intensity = 0.35;
  private playing = false;

  public constructor(audioContext: AudioContext | null, outputNode?: AudioNode) {
    this.audioContext = audioContext;
    this.outputNode = outputNode ?? null;
    this.rebuildGraph();
  }

  public attachAudioContext(audioContext: AudioContext, outputNode: AudioNode): void {
    const wasPlaying = this.playing;
    this.stopScheduler();
    this.audioContext = audioContext;
    this.outputNode = outputNode;
    this.rebuildGraph();
    if (wasPlaying) {
      this.beginScheduling();
    }
  }

  public get isPlaying(): boolean {
    return this.playing;
  }

  public get currentIntensity(): number {
    return this.intensity;
  }

  public setIntensity(value: number): void {
    this.intensity = clampIntensity(value);
    if (this.musicGainNode !== null && this.audioContext !== null) {
      const targetVolume = 0.26 + this.intensity * 0.08;
      this.musicGainNode.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.1);
    }
  }

  public start(): void {
    if (this.audioContext === null || this.playing) {
      return;
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }
    this.playing = true;
    this.beginScheduling();
  }

  public stop(): void {
    this.playing = false;
    this.stopScheduler();
    if (this.musicGainNode !== null && this.audioContext !== null) {
      // A short ramp avoids a click when the loop halts mid-note.
      this.musicGainNode.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.03);
    }
  }

  private rebuildGraph(): void {
    this.musicGainNode = null;
    this.rhythmDistortionNode = null;
    this.noiseBuffer = null;
    if (this.audioContext === null) {
      return;
    }
    const destination = this.outputNode ?? this.audioContext.destination;
    // A compressor after the master gain keeps the stacked guitars and
    // drums from clipping when every layer is running at full intensity.
    const compressorNode = this.audioContext.createDynamicsCompressor();
    compressorNode.threshold.value = -16;
    compressorNode.knee.value = 18;
    compressorNode.ratio.value = 8;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.18;
    compressorNode.connect(destination);
    this.musicGainNode = this.audioContext.createGain();
    this.musicGainNode.gain.value = 0.26 + this.intensity * 0.08;
    this.musicGainNode.connect(compressorNode);
    // Shared distortion bus for the rhythm guitar: every chug and stab
    // feeds this WaveShaper, then a lowpass that keeps the fizz in check.
    this.rhythmDistortionNode = this.audioContext.createWaveShaper();
    this.rhythmDistortionNode.curve = buildDistortionCurve(48);
    this.rhythmDistortionNode.oversample = '2x';
    const rhythmLowpassNode = this.audioContext.createBiquadFilter();
    rhythmLowpassNode.type = 'lowpass';
    rhythmLowpassNode.frequency.value = 3200;
    rhythmLowpassNode.Q.value = 0.4;
    this.rhythmDistortionNode.connect(rhythmLowpassNode);
    rhythmLowpassNode.connect(this.musicGainNode);
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

  private beginScheduling(): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      this.playing = false;
      return;
    }
    this.musicGainNode.gain.setTargetAtTime(
      0.26 + this.intensity * 0.08,
      this.audioContext.currentTime,
      0.05,
    );
    this.currentStep = 0;
    this.nextNoteTimeSeconds = this.audioContext.currentTime + 0.06;
    this.scheduleAhead();
    this.schedulerTimer = setInterval(() => {
      this.scheduleAhead();
    }, schedulerIntervalMilliseconds);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleAhead(): void {
    if (!this.playing || this.audioContext === null) {
      return;
    }
    while (this.nextNoteTimeSeconds < this.audioContext.currentTime + scheduleAheadSeconds) {
      this.scheduleStep(this.currentStep, this.nextNoteTimeSeconds);
      this.nextNoteTimeSeconds += secondsPerStep;
      this.currentStep = (this.currentStep + 1) % totalStepCount;
    }
  }

  private chordRootForStep(step: number): number {
    const barIndex = Math.floor(step / stepsPerBar) % barCount;
    const stepWithinBar = step % stepsPerBar;
    if (barIndex === barCount - 1 && stepWithinBar >= stepsPerBar / 2) {
      return finalBarSecondHalfRootMidiNote;
    }
    return barChordRootMidiNotes[barIndex] ?? 40;
  }

  private scheduleStep(step: number, startTimeSeconds: number): void {
    const stepWithinBar = step % stepsPerBar;
    const chordRootMidiNote = this.chordRootForStep(step);
    const isEighthNoteStep = stepWithinBar % 2 === 0;
    const isQuarterNoteStep = stepWithinBar % 4 === 0;

    // Drums and bass form the low intensity layer and are always present.
    if (isQuarterNoteStep) {
      this.playKick(startTimeSeconds, 0.5);
    }
    // Gallop kicks fill the sixteenth just before a beat at high
    // intensity, with an extra double kick pickup at the very top.
    if (this.intensity >= 0.65 && stepWithinBar % 4 === 3) {
      this.playKick(startTimeSeconds, 0.34);
    }
    if (this.intensity >= 0.85 && stepWithinBar % 8 === 6) {
      this.playKick(startTimeSeconds, 0.3);
    }
    if (stepWithinBar === 4 || stepWithinBar === 12) {
      this.playSnare(startTimeSeconds);
    }
    if (isEighthNoteStep) {
      this.playBass(chordRootMidiNote - 12, startTimeSeconds);
    }

    // Palm-muted rhythm chugs ride every eighth note at all intensities.
    if (isEighthNoteStep) {
      this.playRhythmChord({
        chordRootMidiNote,
        startTimeSeconds,
        durationSeconds: secondsPerStep * 0.85,
        volume: 0.11,
        lowpassFrequency: 1400,
      });
    }
    // Open power-chord stabs ring out on bar starts once intensity
    // reaches the middle band.
    if (this.intensity >= 0.3 && stepWithinBar === 0) {
      this.playRhythmChord({
        chordRootMidiNote,
        startTimeSeconds,
        durationSeconds: secondsPerStep * stepsPerBar * 0.55,
        volume: 0.13,
        lowpassFrequency: 3400,
      });
    }
    // Hats tick eighth notes in the middle band and sixteenths up high,
    // with an open hat splash on the off beat at the top band.
    if (this.intensity >= 0.3 && isEighthNoteStep) {
      this.playHat(startTimeSeconds, 0.035, 0.07);
    }
    if (this.intensity >= 0.65) {
      this.playHat(startTimeSeconds, 0.025, 0.05);
    }
    if (this.intensity >= 0.85 && stepWithinBar % 8 === 4) {
      this.playHat(startTimeSeconds, 0.22, 0.06);
    }

    // Lead guitar shreds above roughly half intensity, parked lower in
    // the mix than the rhythm guitar so the chugs stay in front.
    if (this.intensity > 0.45) {
      const leadMidiNote = leadPatternMidiNotes[step % totalStepCount] ?? null;
      if (leadMidiNote !== null) {
        const isBendStep = leadBendStepIndexes.has(step % totalStepCount);
        this.playLeadNote({
          midiNote: leadMidiNote,
          startTimeSeconds,
          durationSeconds: isBendStep ? secondsPerStep * 7 : secondsPerStep * 0.92,
          bendSemitones: isBendStep ? 2 : 0,
        });
      }
    }
  }

  private playKick(startTimeSeconds: number, volume: number): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(160, startTimeSeconds);
    oscillator.frequency.exponentialRampToValueAtTime(44, startTimeSeconds + 0.09);
    gainNode.gain.setValueAtTime(volume, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTimeSeconds + 0.13);
    oscillator.connect(gainNode);
    gainNode.connect(this.musicGainNode);
    oscillator.start(startTimeSeconds);
    oscillator.stop(startTimeSeconds + 0.14);
  }

  private playSnare(startTimeSeconds: number): void {
    // Filtered noise burst for the crack plus a short body tone.
    this.playNoise({
      startTimeSeconds,
      durationSeconds: 0.13,
      filterType: 'bandpass',
      filterFrequency: 1900,
      filterQuality: 0.7,
      volume: 0.3,
    });
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(195, startTimeSeconds);
    gainNode.gain.setValueAtTime(0.16, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTimeSeconds + 0.08);
    oscillator.connect(gainNode);
    gainNode.connect(this.musicGainNode);
    oscillator.start(startTimeSeconds);
    oscillator.stop(startTimeSeconds + 0.09);
  }

  private playHat(startTimeSeconds: number, durationSeconds: number, volume: number): void {
    this.playNoise({
      startTimeSeconds,
      durationSeconds,
      filterType: 'highpass',
      filterFrequency: 7500,
      filterQuality: 0.7,
      volume,
    });
  }

  private playNoise(parameters: {
    startTimeSeconds: number;
    durationSeconds: number;
    filterType: BiquadFilterType;
    filterFrequency: number;
    filterQuality: number;
    volume: number;
  }): void {
    if (this.audioContext === null || this.musicGainNode === null || this.noiseBuffer === null) {
      return;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = parameters.filterType;
    filterNode.frequency.value = parameters.filterFrequency;
    filterNode.Q.value = parameters.filterQuality;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(parameters.volume, parameters.startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      parameters.startTimeSeconds + parameters.durationSeconds,
    );
    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);
    source.start(parameters.startTimeSeconds, Math.random() * 0.5);
    source.stop(parameters.startTimeSeconds + parameters.durationSeconds + 0.02);
  }

  private playBass(rootMidiNote: number, startTimeSeconds: number): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    // Picked bass: a sawtooth through a low lowpass, with a fast attack
    // and a short pluck decay on every eighth note root.
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(midiNoteToFrequency(rootMidiNote), startTimeSeconds);
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(900, startTimeSeconds);
    filterNode.frequency.exponentialRampToValueAtTime(320, startTimeSeconds + 0.14);
    const gainNode = this.audioContext.createGain();
    const endTimeSeconds = startTimeSeconds + secondsPerStep * 1.7;
    gainNode.gain.setValueAtTime(0.2, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);
    oscillator.start(startTimeSeconds);
    oscillator.stop(endTimeSeconds + 0.02);
  }

  private playRhythmChord(parameters: {
    chordRootMidiNote: number;
    startTimeSeconds: number;
    durationSeconds: number;
    volume: number;
    lowpassFrequency: number;
  }): void {
    if (this.audioContext === null || this.rhythmDistortionNode === null) {
      return;
    }
    // Each power chord tone is a small stack of detuned sawtooth
    // oscillators. Palm-muted chugs pass a darker lowpass and die fast;
    // open stabs pass a brighter one and ring.
    const endTimeSeconds = parameters.startTimeSeconds + parameters.durationSeconds;
    for (const semitoneOffset of powerChordSemitoneOffsets) {
      const frequency = midiNoteToFrequency(parameters.chordRootMidiNote + semitoneOffset);
      const filterNode = this.audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = parameters.lowpassFrequency;
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(parameters.volume, parameters.startTimeSeconds);
      gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);
      filterNode.connect(gainNode);
      gainNode.connect(this.rhythmDistortionNode);
      for (const detuneCents of [-9, 0, 9]) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, parameters.startTimeSeconds);
        oscillator.detune.value = detuneCents;
        oscillator.connect(filterNode);
        oscillator.start(parameters.startTimeSeconds);
        oscillator.stop(endTimeSeconds + 0.02);
      }
    }
  }

  private playLeadNote(parameters: {
    midiNote: number;
    startTimeSeconds: number;
    durationSeconds: number;
    bendSemitones: number;
  }): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    // Trebly lead: a square and saw pair through a bright lowpass, kept
    // quieter than the rhythm stack. Bend notes ramp frequency up over
    // the first half of the hold.
    const frequency = midiNoteToFrequency(parameters.midiNote);
    const endTimeSeconds = parameters.startTimeSeconds + parameters.durationSeconds;
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 5200;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.055, parameters.startTimeSeconds);
    gainNode.gain.setValueAtTime(
      0.05,
      endTimeSeconds - Math.min(0.05, parameters.durationSeconds / 3),
    );
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);
    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);
    for (const waveform of ['square', 'sawtooth'] as const) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, parameters.startTimeSeconds);
      if (parameters.bendSemitones > 0) {
        const bentFrequency = frequency * Math.pow(2, parameters.bendSemitones / 12);
        oscillator.frequency.linearRampToValueAtTime(
          bentFrequency,
          parameters.startTimeSeconds + parameters.durationSeconds * 0.5,
        );
        oscillator.frequency.setValueAtTime(
          bentFrequency,
          parameters.startTimeSeconds + parameters.durationSeconds * 0.75,
        );
      }
      oscillator.connect(filterNode);
      oscillator.start(parameters.startTimeSeconds);
      oscillator.stop(endTimeSeconds + 0.02);
    }
  }
}
