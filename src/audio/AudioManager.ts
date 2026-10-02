import { Music, type MusicMode } from './music';
import { SFX, SFX_GAP, type SfxId } from './sfx';
import { zzfxSamples } from './zzfx';

export type MuteReason = 'hidden' | 'ad' | 'platform';

/**
 * Owns the AudioContext. Nothing is created before the first user gesture.
 * Any mute reason (tab hidden, ad, platform pause) silences everything and suspends the context.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private music: Music | null = null;
  private readonly buffers = new Map<SfxId, AudioBuffer>();
  private readonly lastPlay = new Map<SfxId, number>();
  private readonly reasons = new Set<MuteReason>();
  private voices = 0;
  private musicMode: MusicMode = 'off';
  private sfxVol = 0.8;
  private musicVol = 0.7;
  private unlocked = false;

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
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.applyVolumes();
      this.music = new Music(ctx, this.musicBus);
      for (const id of Object.keys(SFX) as SfxId[]) {
        const data = zzfxSamples(ctx.sampleRate, SFX[id]);
        const buf = ctx.createBuffer(1, Math.max(1, data.length), ctx.sampleRate);
        buf.getChannelData(0).set(data);
        this.buffers.set(id, buf);
      }
      this.unlocked = true;
      void ctx.resume().catch(() => undefined);
      this.music.setMode(this.musicMode);
      this.applyMute();
    } catch (e) {
      console.warn('[audio] unavailable', e);
    }
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
      void ctx
        .resume()
        .then(() => {
          this.master.gain.setValueAtTime(0, ctx.currentTime);
          this.master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
        })
        .catch(() => undefined);
    }
  }

  play(id: SfxId, vol = 1, rate = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.reasons.size > 0 || this.sfxVol <= 0 || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = SFX_GAP[id] ?? 0.02;
    const last = this.lastPlay.get(id) ?? -1;
    if (now - last < gap) return;
    if (this.voices > 28) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    this.lastPlay.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.sfxBus);
    this.voices++;
    src.onended = () => {
      this.voices--;
      g.disconnect();
    };
    src.start(now);
  }

  setMusic(mode: MusicMode): void {
    this.musicMode = mode;
    this.music?.setMode(mode);
  }

  setMusicMuffled(on: boolean): void {
    this.music?.setMuffled(on);
  }

  setMusicProgress(p: number, intensity: number): void {
    if (!this.music) return;
    this.music.setProgress(p);
    this.music.intensity = intensity;
  }
}
