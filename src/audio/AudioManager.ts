import { Music, type MusicMode } from './music';
import { SFX, SFX_GAP, type SfxId } from './sfx';
import { zzfxSamples } from './zzfx';

export type MuteReason = 'hidden' | 'ad' | 'platform';

/**
 * «Swarm» sounds: the ones a big fight fires dozens of times per second. They share a bus that
 * mixes them as one texture instead of a hiss: the busier it gets, the longer the gap between
 * repeats of the same sound, the quieter each voice (total loudness grows like √N, not N) and
 * the lower a low-pass cutoff (a crowd turns into a soft patter). Important sounds (taking a hit,
 * a boss, a level-up…) briefly duck the swarm so they are always heard.
 */
const SWARM: Partial<Record<SfxId, true>> = { hit: true, kill: true, gem: true, enemyShot: true, pulse: true, drone: true, mine: true, shield: true };
const PRIORITY: Partial<Record<SfxId, true>> = { hurt: true, boss: true, bossPhase: true, levelup: true, evolve: true, chest: true, warn: true, revive: true, heal: true, magnet: true, victory: true, defeat: true };
const SWARM_VOICES = 10;
/** user gestures that browsers accept for starting / resuming audio */
const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const;
/** averaging window of the swarm density, s */
const RATE_TAU = 0.6;

/**
 * Owns the AudioContext. Nothing is created before the first user gesture.
 * Any mute reason (tab hidden, ad, platform pause) silences everything and suspends the context.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private swarmBus!: GainNode;
  private swarmLp!: BiquadFilterNode;
  /** exponentially averaged swarm plays (≈ plays per second × RATE_TAU) */
  private swarmRate = 0;
  private swarmRateT = 0;
  private swarmVoices = 0;
  private music: Music | null = null;
  private readonly buffers = new Map<SfxId, AudioBuffer>();
  private readonly lastPlay = new Map<SfxId, number>();
  private readonly reasons = new Set<MuteReason>();
  private voices = 0;
  private musicMode: MusicMode = 'off';
  private sfxVol = 0.8;
  private musicVol = 0.7;
  private unlocked = false;
  private muffled = false;
  /** bumped with every new context: sources of a replaced one must not touch the counters */
  private gen = 0;
  /** back from the background: run one suspend → resume cycle (what a tab switch does) */
  private kick = false;
  /** the context did not come back by itself: replace it on the next touch */
  private stuck = false;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const unlock = () => {
      this.unlock();
      if (this.unlocked) {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchend', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchend', unlock, true);
  }

  get ready(): boolean {
    return this.unlocked;
  }

  private unlock(): void {
    if (this.unlocked) return;
    if (!this.build()) return;
    this.unlocked = true;
    this.applyMute();
  }

  /** Creates the context and the whole graph (inside a gesture). False without Web Audio. */
  private build(): boolean {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.gen++;
      this.voices = 0;
      this.swarmVoices = 0;
      this.swarmRate = 0;
      this.lastPlay.clear();
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.swarmLp = ctx.createBiquadFilter();
      this.swarmLp.type = 'lowpass';
      this.swarmLp.frequency.value = 12000;
      this.swarmLp.Q.value = 0.5;
      this.swarmBus = ctx.createGain();
      this.swarmBus.connect(this.swarmLp).connect(this.sfxBus);
      this.musicBus.connect(this.master);
      this.applyVolumes();
      this.music = new Music(ctx, this.musicBus);
      this.buffers.clear();
      for (const id of Object.keys(SFX) as SfxId[]) {
        const data = zzfxSamples(ctx.sampleRate, SFX[id]);
        const buf = ctx.createBuffer(1, Math.max(1, data.length), ctx.sampleRate);
        buf.getChannelData(0).set(data);
        this.buffers.set(id, buf);
      }
      // the system may stop the context by itself (iOS: a call, another app's audio, the
      // background): when that happens while we want sound, get it back on the next touch
      ctx.onstatechange = () => {
        if (ctx !== this.ctx) return;
        if (ctx.state === 'running') this.fadeIn();
        else if (this.reasons.size === 0) this.resumeAudio();
      };
      void ctx.resume().catch(() => undefined);
      this.music.setMode(this.musicMode);
      if (this.muffled) this.music.setMuffled(true);
      return true;
    } catch (e) {
      console.warn('[audio] unavailable', e);
      return false;
    }
  }

  /**
   * iOS Safari can leave a context dead after the app was in the background: `resume()` never
   * settles, or the context reports «running» while its clock stands still. A fresh context
   * created inside a touch always plays, so the old one is replaced (the music restarts).
   */
  private rebuild(): void {
    const old = this.ctx;
    this.music?.stop();
    this.music = null;
    this.ctx = null;
    if (old) {
      old.onstatechange = null;
      void old.close().catch(() => undefined);
    }
    this.stuck = false;
    this.kick = false;
    if (this.build()) this.applyMute();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVol * this.sfxVol, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVol * this.musicVol * 0.9, t, 0.05);
  }

  mute(reason: MuteReason, on: boolean): void {
    if (reason === 'hidden' && !on && this.reasons.has('hidden')) this.kick = true;
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    this.applyMute();
  }

  get muted(): boolean {
    return this.reasons.size > 0;
  }

  private applyMute(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const muted = this.reasons.size > 0;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    if (muted) {
      this.master.gain.setValueAtTime(0, t);
      void ctx.suspend().catch(() => undefined);
    } else {
      this.resumeAudio();
    }
  }

  /**
   * Brings the sound back after a mute. Phones often refuse `resume()` without a touch once the
   * page was in the background (iOS even marks the context «interrupted»), so a refused or
   * pending resume is retried on the next touch / key, and the volume fades in only once the
   * context really runs.
   */
  private resumeAudio(): void {
    const ctx = this.ctx;
    if (!ctx || this.reasons.size > 0) return;
    this.watch();
    if (ctx.state === 'running') {
      if (this.kick) {
        // «running» right after the background may still be silent on iOS: cycle it like a tab switch
        this.kick = false;
        void ctx
          .suspend()
          .then(() => ctx.resume())
          .then(() => this.fadeIn())
          .catch(() => undefined);
        return;
      }
      this.fadeIn();
      return;
    }
    this.kick = false;
    this.armGestureResume();
    void ctx
      .resume()
      .then(() => this.fadeIn())
      .catch(() => undefined);
  }

  /** Shortly after the sound should be back, checks that the context really plays (its clock moves). */
  private watch(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.checkTimer) clearTimeout(this.checkTimer);
    const t0 = ctx.currentTime;
    this.checkTimer = setTimeout(() => {
      this.checkTimer = null;
      if (ctx !== this.ctx || this.reasons.size > 0) return;
      if (ctx.state !== 'running' || ctx.currentTime <= t0) {
        this.stuck = true;
        this.armGestureResume();
      }
    }, 700);
  }

  private fadeIn(): void {
    const ctx = this.ctx;
    if (!ctx || this.reasons.size > 0 || ctx.state !== 'running') return;
    const g = this.master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(Math.min(g.value, 1), ctx.currentTime);
    g.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
    this.disarmGestureResume();
  }

  private gestureArmed = false;
  private readonly onGesture = () => {
    const ctx = this.ctx;
    if (!ctx || this.reasons.size > 0) return;
    // inside the gesture: the one moment a phone always lets audio run again
    const state: string = ctx.state;
    if (this.stuck || state === 'interrupted' || state === 'closed') {
      this.rebuild();
      return;
    }
    void ctx
      .resume()
      .then(() => this.fadeIn())
      .catch(() => undefined);
    this.watch();
  };

  private armGestureResume(): void {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    for (const ev of GESTURES) window.addEventListener(ev, this.onGesture, true);
  }

  private disarmGestureResume(): void {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    for (const ev of GESTURES) window.removeEventListener(ev, this.onGesture, true);
  }

  /** Swarm sounds per second over the last ~0.6 s. */
  private swarmDensity(now: number): number {
    this.swarmRate *= Math.exp(-Math.max(0, now - this.swarmRateT) / RATE_TAU);
    this.swarmRateT = now;
    return this.swarmRate / RATE_TAU;
  }

  play(id: SfxId, vol = 1, rate = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.reasons.size > 0 || this.sfxVol <= 0 || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const swarm = SWARM[id] === true;
    let gap = SFX_GAP[id] ?? 0.02;
    let detune = 0.1;
    if (swarm) {
      const d = this.swarmDensity(now);
      // 40 sounds/s → the same sound at most ~3× less often, each voice at ~40 % volume
      gap *= 1 + d / 20;
      vol /= Math.sqrt(1 + d / 8);
      if (this.swarmVoices >= SWARM_VOICES) return;
      const cutoff = Math.max(1800, 12000 / (1 + d / 10));
      this.swarmLp.frequency.setTargetAtTime(cutoff, now, 0.12);
      detune = 0.04;
    }
    const last = this.lastPlay.get(id) ?? -1;
    if (now - last < gap) return;
    if (this.voices > 28) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    this.lastPlay.set(id, now);
    if (swarm) this.swarmRate += 1;
    if (PRIORITY[id]) this.duckSwarm(now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 - detune / 2 + Math.random() * detune);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(swarm ? this.swarmBus : this.sfxBus);
    this.voices++;
    if (swarm) this.swarmVoices++;
    const gen = this.gen;
    src.onended = () => {
      g.disconnect();
      if (gen !== this.gen) return;
      this.voices--;
      if (swarm) this.swarmVoices--;
    };
    src.start(now);
  }

  /** Pushes the swarm down for a moment so an important sound cuts through. */
  private duckSwarm(now: number): void {
    const gn = this.swarmBus.gain;
    gn.cancelScheduledValues(now);
    gn.setValueAtTime(Math.min(gn.value, 0.35), now);
    gn.linearRampToValueAtTime(1, now + 0.45);
  }

  setMusic(mode: MusicMode): void {
    this.musicMode = mode;
    this.music?.setMode(mode);
  }

  setMusicMuffled(on: boolean): void {
    this.muffled = on;
    this.music?.setMuffled(on);
  }

  /** For the `?debug=1` overlay: context state and clock (a frozen clock = no sound). */
  debugState(): string {
    const ctx = this.ctx;
    return ctx ? `${ctx.state} ${ctx.currentTime.toFixed(1)}s${this.stuck ? ' stuck' : ''}` : 'locked';
  }

  setMusicProgress(p: number, intensity: number): void {
    if (!this.music) return;
    this.music.setProgress(p);
    this.music.intensity = intensity;
  }
}
