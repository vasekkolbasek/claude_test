/**
 * Procedural synthwave loop on raw WebAudio: kick, snare, hats, saw bass, arpeggio with
 * feedback delay and a detuned pad. Look-ahead scheduler (Chris Wilson's pattern).
 */

export type MusicMode = 'off' | 'menu' | 'run' | 'boss';

const PROGRESSIONS: Record<'menu' | 'run' | 'boss', number[][]> = {
  // semitone offsets from A (A minor): Am - F - C - G
  menu: [
    [0, 3, 7],
    [-4, 0, 3],
    [3, 7, 10],
    [-2, 2, 5],
  ],
  // Am - F - G - Em
  run: [
    [0, 3, 7],
    [-4, 0, 3],
    [-2, 2, 5],
    [-5, -2, 2],
  ],
  // Dm - Bb - C - A (darker, driving)
  boss: [
    [5, 8, 12],
    [1, 5, 8],
    [3, 7, 10],
    [0, 4, 7],
  ],
};

const A2 = 110;

function freq(semi: number, octave = 0): number {
  return A2 * Math.pow(2, semi / 12 + octave);
}

export class Music {
  private mode: MusicMode = 'off';
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private bpm = 100;
  private targetBpm = 100;
  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly delay: DelayNode;
  private readonly delayFb: GainNode;
  private readonly delayIn: GainNode;
  private readonly noise: AudioBuffer;
  /** 0..1 extra energy (wave intensity) */
  intensity = 0;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 0.7;
    this.bus.connect(this.filter);
    this.filter.connect(out);
    this.delay = ctx.createDelay(1);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.32;
    this.delayIn = ctx.createGain();
    this.delayIn.gain.value = 0.35;
    this.delayIn.connect(this.delay);
    this.delay.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.bus);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    this.targetBpm = mode === 'menu' ? 96 : mode === 'boss' ? 136 : 112;
    if (mode === 'off') {
      this.stop();
      return;
    }
    if (prev === 'off' || !this.timer) {
      this.bpm = this.targetBpm;
      this.step = 0;
      this.bar = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    }
  }

  /** Muffles the music (pause menus, level-up). */
  setMuffled(on: boolean): void {
    const t = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(on ? 700 : 18000, t, 0.12);
  }

  /** Tempo ramps up with run time: call with 0..1. */
  setProgress(p: number): void {
    if (this.mode === 'run') this.targetBpm = 112 + Math.min(1, Math.max(0, p)) * 18;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (this.mode === 'off') return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    // recover from long stalls (tab throttling)
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.bpm += (this.targetBpm - this.bpm) * 0.02;
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private playStep(step: number, t: number): void {
    const mode = this.mode === 'off' ? 'menu' : this.mode;
    const prog = PROGRESSIONS[mode];
    const chord = prog[this.bar % prog.length];
    const section = Math.floor(this.bar / 8) % 4;
    const s16 = 60 / this.bpm / 4;
    if (mode === 'menu') {
      if (step === 0) this.pad(chord, t, s16 * 16, 0.05);
      if (step % 2 === 0) this.arp(chord, step / 2, t, s16 * 1.6, 0.045, 1);
      if (step % 4 === 2) this.hat(t, 0.025);
      if (section >= 1 && step === 0) this.bass(chord[0], t, s16 * 8, 0.09);
      if (section >= 2 && (step === 0 || step === 8)) this.kick(t, 0.32);
      return;
    }
    const boss = mode === 'boss';
    const drive = boss ? 1 : 0.6 + this.intensity * 0.4;
    // drums
    if (step % 4 === 0) this.kick(t, 0.62);
    if (step === 4 || step === 12) this.snare(t, 0.3 * drive);
    if (step % 2 === 1 || boss) this.hat(t, step % 2 === 1 ? 0.05 : 0.025);
    if (section === 3 && step === 14) this.snare(t, 0.18);
    // bass: eighth-note octave pumping
    if (step % 2 === 0) {
      const oct = step % 4 === 2 ? 1 : 0;
      this.bass(chord[0] + 12 * oct, t, s16 * 1.7, 0.16);
    }
    if (boss && step % 2 === 1) this.bass(chord[0], t, s16 * 0.9, 0.08);
    // arpeggio
    const arpVol = 0.05 + (section >= 1 ? 0.015 : 0);
    if (boss || section >= 1 || step % 2 === 0) this.arp(chord, step, t, s16 * 0.9, arpVol, boss ? 2 : 1);
    if (step === 0) this.pad(chord, t, s16 * 16, 0.035);
    // little lead motif in later sections
    if (section === 2 && (step === 0 || step === 6 || step === 10)) {
      this.lead(chord[step === 0 ? 2 : step === 6 ? 1 : 0] + 24, t, s16 * 3, 0.04);
    }
  }

  // ---------------------------------------------------------------- instruments

  private env(g: GainNode, t: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private kick(t: number, v: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    this.env(g, t, 0.003, v, 0.22);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  private snare(t: number, v: number): void {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    this.env(g, t, 0.002, v, 0.16);
    n.connect(f).connect(g).connect(this.bus);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.2);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g2 = ctx.createGain();
    this.env(g2, t, 0.002, v * 0.6, 0.08);
    o.connect(g2).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, v: number): void {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    this.env(g, t, 0.001, v, 0.04);
    n.connect(f).connect(g).connect(this.bus);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.06);
  }

  private bass(semi: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq(semi, -1);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(260, t);
    f.frequency.exponentialRampToValueAtTime(900 + this.intensity * 600, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, v, dur);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private arp(chord: number[], step: number, t: number, dur: number, v: number, octaves: number): void {
    const ctx = this.ctx;
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const idx = pattern[step % pattern.length];
    const oct = 1 + ((Math.floor(step / 8) % octaves) as number);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq(chord[idx], oct);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    this.env(g, t, 0.004, v, dur);
    o.connect(f).connect(g);
    g.connect(this.bus);
    g.connect(this.delayIn);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(chord: number[], t: number, dur: number, v: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(v * 0.8, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.bus);
    for (const semi of chord) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq(semi, 1);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private lead(semi: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq(semi, 0);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = 6;
    vib.connect(vg).connect(o.detune);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    const g = ctx.createGain();
    this.env(g, t, 0.02, v, dur);
    o.connect(f).connect(g);
    g.connect(this.bus);
    g.connect(this.delayIn);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }
}
