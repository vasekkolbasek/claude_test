import { SFX, type SfxName } from './sfx';
import { zzfxGenerate } from './zzfx';

export type Mood = 'menu' | 'day' | 'night' | 'silent';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * WebAudio mixer: synthesized SFX + procedural music with day/night crossfade.
 * The AudioContext is created only after the first user gesture.
 */
export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private buffers = new Map<SfxName, AudioBuffer[]>();
  private lastPlay = new Map<SfxName, number>();
  private playing = 0;
  private muteReasons = new Set<string>();
  musicVol = 0.6;
  sfxVol = 0.8;
  private music: Music | null = null;
  private mood: Mood = 'menu';

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.muteReasons.size) void this.ctx.resume().catch(() => undefined);
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { this.ctx = null; return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.sfxBus.connect(comp).connect(this.master);
    this.musicBus.connect(this.master);
    this.applyVolumes();
    // Generate SFX lazily in small batches to avoid a long stall.
    const names = Object.keys(SFX) as SfxName[];
    let i = 0;
    const gen = () => {
      for (let k = 0; k < 4 && i < names.length; k++, i++) this.makeBuffers(names[i]);
      if (i < names.length) setTimeout(gen, 0);
    };
    gen();
    this.music = new Music(ctx, this.musicBus);
    this.music.setMood(this.mood);
    if (this.muteReasons.size) this.applyMute();
  }

  private makeBuffers(name: SfxName): void {
    if (!this.ctx) return;
    const variants: AudioBuffer[] = [];
    const n = name === 'hit' || name === 'arrow' || name === 'poof' || name === 'coin' ? 3 : 1;
    for (let v = 0; v < n; v++) {
      const data = zzfxGenerate(this.ctx.sampleRate, SFX[name]);
      const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      buf.getChannelData(0).set(data);
      variants.push(buf);
    }
    this.buffers.set(name, variants);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.05);
  }

  /** Mute for a reason (ad, pause, hidden tab). Audio resumes when no reasons remain. */
  setMuted(reason: string, on: boolean): void {
    if (on) this.muteReasons.add(reason);
    else this.muteReasons.delete(reason);
    this.applyMute();
  }

  private applyMute(): void {
    if (!this.ctx) return;
    const muted = this.muteReasons.size > 0;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(muted ? 0 : this.master.gain.value, t);
    if (muted) {
      this.master.gain.value = 0;
      void this.ctx.suspend().catch(() => undefined);
    } else {
      void this.ctx.resume().catch(() => undefined);
      this.master.gain.setTargetAtTime(1, t, 0.08);
    }
  }

  get isMuted(): boolean { return this.muteReasons.size > 0; }

  setMood(m: Mood): void {
    this.mood = m;
    this.music?.setMood(m);
  }

  play(name: SfxName, vol = 1, rate = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.muteReasons.size || this.sfxVol <= 0 || vol <= 0.02) return;
    const bufs = this.buffers.get(name);
    if (!bufs) return;
    const now = ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.035) return;
    if (this.playing > 24) return;
    this.lastPlay.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const g = ctx.createGain();
    g.gain.value = Math.min(1, vol);
    src.connect(g).connect(this.sfxBus);
    this.playing++;
    src.onended = () => { this.playing--; src.disconnect(); g.disconnect(); };
    src.start();
  }

  update(): void { this.music?.tick(); }
}

// ---------------------------------------------------------------- procedural music

interface Theme {
  bpm: number;
  root: number;
  scale: number[];
  chords: number[][];
  bus: GainNode;
  next: number;
  step: number;
  motif: number[];
  kind: 'day' | 'night' | 'menu';
}

class Music {
  private themes: Record<'day' | 'night' | 'menu', Theme>;
  private noise: AudioBuffer;
  private delay: DelayNode;
  private mood: Mood = 'menu';
  private seed = 12345;

  constructor(private ctx: AudioContext, out: GainNode) {
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Gentle echo for plucks.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(out);
    const mk = (kind: Theme['kind'], bpm: number, root: number, scale: number[], chords: number[][]): Theme => {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(out);
      return { kind, bpm, root, scale, chords, bus, next: 0, step: 0, motif: [], };
    };
    // Degrees are semitone offsets from the root.
    this.themes = {
      menu: mk('menu', 72, 60, [0, 2, 4, 7, 9], [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]),
      day: mk('day', 88, 62, [0, 2, 4, 7, 9], [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]]),
      night: mk('night', 112, 57, [0, 3, 5, 7, 10], [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]]),
    };
    for (const th of Object.values(this.themes)) th.motif = this.makeMotif(th);
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private makeMotif(th: Theme): number[] {
    // 16 eighth-note slots; -1 = rest. Index into scale (+ octave).
    const m: number[] = [];
    for (let i = 0; i < 16; i++) {
      const rest = th.kind === 'night' ? this.rnd() < 0.55 : this.rnd() < 0.35;
      m.push(rest ? -1 : Math.floor(this.rnd() * (th.scale.length + 3)));
    }
    m[0] = 0;
    return m;
  }

  setMood(m: Mood): void {
    this.mood = m;
    const t = this.ctx.currentTime;
    for (const th of Object.values(this.themes)) {
      const on = th.kind === m;
      th.bus.gain.cancelScheduledValues(t);
      th.bus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 1.2 : 0.9);
      if (on && th.next < t) { th.next = t + 0.1; }
    }
  }

  tick(): void {
    const t = this.ctx.currentTime;
    if (this.ctx.state !== 'running') return;
    for (const th of Object.values(this.themes)) {
      const active = th.kind === this.mood || th.bus.gain.value > 0.02;
      if (!active) continue;
      if (th.next < t) th.next = t + 0.05;
      const stepDur = 60 / th.bpm / 2; // eighth notes
      while (th.next < t + 0.2) {
        this.schedule(th, th.step, th.next, stepDur);
        th.step++;
        th.next += stepDur;
        if (th.step % 64 === 0 && this.rnd() < 0.5) th.motif = this.makeMotif(th);
      }
    }
  }

  private schedule(th: Theme, step: number, time: number, dur: number): void {
    const bar = Math.floor(step / 8) % th.chords.length;
    const inBar = step % 8;
    const chord = th.chords[bar];
    const root = th.root;
    if (inBar === 0) {
      // Pad chord
      for (const n of chord) this.pad(th, midi(root + n), time, dur * 8, th.kind === 'night' ? 'sawtooth' : 'triangle', th.kind === 'night' ? 0.025 : 0.035);
    }
    // Bass
    if (th.kind === 'night') {
      this.bass(th, midi(root - 12 + chord[0]), time, dur * 0.9, 0.11);
    } else if (inBar === 0 || inBar === 4) {
      this.bass(th, midi(root - 12 + chord[0] + (inBar === 4 ? 7 : 0)), time, dur * 3, 0.08);
    }
    // Melody
    const mi = th.motif[step % 16];
    const playMel = th.kind === 'night' ? Math.floor(step / 16) % 2 === 1 : true;
    if (mi >= 0 && playMel) {
      const oct = Math.floor(mi / th.scale.length);
      const deg = th.scale[mi % th.scale.length];
      const note = root + 12 + deg + oct * 12 - (th.kind === 'menu' ? 0 : 0);
      this.pluck(th, midi(note), time, th.kind === 'night' ? 0.045 : 0.06, th.kind === 'night' ? 'square' : 'triangle');
    }
    // Percussion
    if (th.kind === 'night') {
      if (inBar === 0 || inBar === 4) this.kick(th, time, 0.5);
      if (inBar === 2 || inBar === 6) this.snare(th, time, 0.12);
      if (inBar === 7 && bar === 3) this.snare(th, time + dur / 2, 0.1);
      this.hat(th, time, inBar % 2 === 0 ? 0.035 : 0.02);
    } else if (th.kind === 'day') {
      if (inBar % 2 === 1) this.hat(th, time, 0.018);
      if (inBar === 0) this.kick(th, time, 0.12);
    }
  }

  private env(g: GainNode, time: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + a);
    g.gain.exponentialRampToValueAtTime(0.0001, time + a + d);
  }

  private osc(th: Theme, type: OscillatorType, f: number, time: number, len: number, g: GainNode, filter?: number): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    let node: AudioNode = o;
    if (filter) {
      const bq = this.ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = filter;
      o.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(th.bus);
    o.start(time);
    o.stop(time + len + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  private pad(th: Theme, f: number, time: number, len: number, type: OscillatorType, vol: number): void {
    for (const det of [-5, 5]) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(vol, time + len * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, time + len);
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      const bq = this.ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = th.kind === 'night' ? 900 : 1600;
      o.connect(bq).connect(g).connect(th.bus);
      o.start(time);
      o.stop(time + len + 0.05);
      o.onended = () => { o.disconnect(); bq.disconnect(); g.disconnect(); };
    }
  }

  private pluck(th: Theme, f: number, time: number, vol: number, type: OscillatorType): void {
    const g = this.ctx.createGain();
    this.env(g, time, 0.005, vol, 0.45);
    this.osc(th, type, f, time, 0.5, g, type === 'square' ? 1800 : undefined);
    g.connect(this.delay);
  }

  private bass(th: Theme, f: number, time: number, len: number, vol: number): void {
    const g = this.ctx.createGain();
    this.env(g, time, 0.01, vol, len);
    this.osc(th, th.kind === 'night' ? 'sawtooth' : 'sine', f, time, len + 0.05, g, th.kind === 'night' ? 380 : 600);
  }

  private kick(th: Theme, time: number, vol: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(130, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.18);
    this.env(g, time, 0.003, vol, 0.25);
    o.connect(g).connect(th.bus);
    o.start(time);
    o.stop(time + 0.3);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  private noiseHit(th: Theme, time: number, vol: number, freq: number, q: number, len: number, type: BiquadFilterType): void {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const bq = this.ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.value = freq;
    bq.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, time, 0.002, vol, len);
    s.connect(bq).connect(g).connect(th.bus);
    s.start(time, Math.random() * 0.5);
    s.stop(time + len + 0.05);
    s.onended = () => { s.disconnect(); bq.disconnect(); g.disconnect(); };
  }

  private snare(th: Theme, time: number, vol: number): void { this.noiseHit(th, time, vol, 1400, 0.8, 0.16, 'bandpass'); }
  private hat(th: Theme, time: number, vol: number): void { this.noiseHit(th, time, vol, 7000, 1, 0.05, 'highpass'); }
}
