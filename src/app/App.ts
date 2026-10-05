import { Application } from 'pixi.js';
import { AudioManager } from '../audio/AudioManager';
import type { SfxId } from '../audio/sfx';
import { CONFIG } from '../config';
import { BALANCE } from '../data/balance';
import type { EvolutionId, GameModeId, SectorId } from '../data/types';
import { Bot } from '../game/Bot';
import { EV } from '../game/events';
import { SHOT } from '../game/weapons';
import { World } from '../game/World';
import { t } from '../i18n';
import { Input } from '../input/Input';
import { checkAchievements } from '../meta/achievements';
import { applyRunResult, passivePool, runBonuses, weaponPool, type RunSummary } from '../meta/progress';
import { SaveManager } from '../meta/save';
import type { Platform } from '../platform/Platform';
import { GameView, type QualityLevel } from '../render/GameView';
import { Hud } from '../ui/hud';
import { buildLevelUp } from '../ui/levelup';
import { UI } from '../ui/UI';
import { openPause } from '../ui/screens/pause';
import { openRevive } from '../ui/screens/revive';
import { showMenu } from '../ui/screens/menu';
import { showResults } from '../ui/screens/results';
import { Tutorial } from './tutorial';
import { QualityController } from './quality';
import { applyStage, type StageRect } from './stage';

type Mode = 'boot' | 'menu' | 'run' | 'results';
export type PauseReason = 'user' | 'hidden' | 'ad' | 'platform' | 'revive' | 'levelup' | 'death' | 'rotate';

const SHOT_SFX: Record<number, SfxId> = {
  [SHOT.PULSE]: 'pulse',
  [SHOT.CHAIN]: 'chain',
  [SHOT.LASER]: 'laser',
  [SHOT.MINE]: 'mine',
  [SHOT.MISSILE]: 'missile',
  [SHOT.WAVE]: 'wave',
  [SHOT.DRONE]: 'drone',
};

export class App {
  pixi!: Application;
  view!: GameView;
  ui!: UI;
  hud!: Hud;
  input!: Input;
  readonly audio = new AudioManager();
  save!: SaveManager;
  world: World | null = null;
  mode: Mode = 'boot';
  readonly pauses = new Set<PauseReason>();
  summary: RunSummary | null = null;
  bot: Bot | null = null;
  /** test hook: player cannot die */
  godMode = false;
  /** smoke tests always go through the sector screen */
  readonly testFlow = new URLSearchParams(location.search).has('test');

  private hitStop = 0;
  private deathT = 0;
  private winT = 0;
  private lastInterstitial = Date.now();
  private adBusy = false;
  private reviveAdUsed = false;
  private freeRevivesUsed = 0;
  private rerollAdUsed = false;
  private levelUpOpen = false;
  private gemCombo = 0;
  private gemComboT = 0;
  private lastVibrate = 0;
  private tutorial: Tutorial | null = null;
  private quality!: QualityController;
  private runMenuMusic = false;
  private debugEl: HTMLElement | null = null;
  private dbg = { acc: 0, frames: 0, sim: 0, view: 0 };

  constructor(readonly platform: Platform) {}

  // ---------------------------------------------------------------- boot

  async boot(progress: (f: number) => void): Promise<void> {
    this.save = new SaveManager(this.platform);
    await this.save.load();
    // grant anything earned but not yet applied (e.g. unlocks added in an update)
    if (checkAchievements(this.save.data, null, false).length) this.save.save();
    progress(0.6);

    this.pixi = new Application();
    const s = this.save.data.settings;
    this.stage = applyStage(this.clampStage());
    const appEl = document.getElementById('app') as HTMLElement;
    await this.pixi.init({
      preference: ['webgl', 'canvas'],
      resizeTo: appEl,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: 0x05030f,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      autoStart: true,
    });
    appEl.appendChild(this.pixi.canvas);
    appEl.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));
    appEl.appendChild(Object.assign(document.createElement('div'), { className: 'scanlines' }));
    progress(0.75);

    this.view = new GameView(this.pixi);
    this.view.init();
    progress(0.9);

    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui';
    document.body.appendChild(uiRoot);
    this.ui = new UI(uiRoot);
    this.ui.onClick = () => this.sfx('click', 0.8);
    this.hud = new Hud(() => this.openPauseMenu());
    this.input = new Input(this.pixi.canvas);
    this.input.onPause = () => this.openPauseMenu();

    this.quality = new QualityController(s.quality, (q) => this.applyQuality(q));
    this.applySettings();
    this.wireLifecycle();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => this.onResize());
    this.lockPortrait();
    // locking usually needs a user gesture (and often fullscreen): retry once on the first touch
    window.addEventListener('pointerdown', () => this.lockPortrait(), { once: true });
    this.pixi.ticker.add((tk) => this.tick(Math.min(tk.deltaMS / 1000, 0.1)));
    if (this.testFlow && new URLSearchParams(location.search).has('capture')) this.pixi.ticker.stop();
    if (new URLSearchParams(location.search).has('debug')) {
      this.debugEl = Object.assign(document.createElement('div'), { className: 'debug-overlay' });
      document.body.appendChild(this.debugEl);
    }
    this.goMenu(false);
  }

  private stage: StageRect = { x: 0, y: 0, w: 1, h: 1 };

  /** Desktop keeps the field within 2:1; phones and tablets always go full screen. */
  private clampStage(): boolean {
    const d = this.platform.device();
    return d === 'desktop' || d === 'tv';
  }

  private onResize(): void {
    this.stage = applyStage(this.clampStage());
    // the canvas follows #app through resizeTo; refresh it now so the camera sees the new size
    this.pixi.resize();
    this.view.resize(this.stage.w, this.stage.h);
    this.checkOrientation();
  }

  // ---------------------------------------------------------------- portrait only on phones/tablets

  private rotateEl: HTMLElement | null = null;

  /** Touch devices are played in portrait: in landscape a full-screen «rotate» notice covers
   * everything and the run is paused (GameplayAPI stop) until the device is turned back. */
  private checkOrientation(): void {
    const d = this.platform.device();
    const on = (d === 'mobile' || d === 'tablet') && window.innerWidth > window.innerHeight;
    if (on && !this.rotateEl) {
      const el = document.createElement('div');
      el.className = 'rotate-overlay';
      el.setAttribute('role', 'alert');
      el.setAttribute('data-test', 'rotate');
      const phone = document.createElement('div');
      phone.className = 'rot-phone';
      const title = document.createElement('div');
      title.className = 'rot-title';
      title.textContent = t('rotate.title');
      const text = document.createElement('div');
      text.className = 'rot-text';
      text.textContent = t('rotate.text');
      el.append(phone, title, text);
      // swallow every touch so nothing underneath reacts
      for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart'] as const) el.addEventListener(ev, (e) => e.stopPropagation());
      document.body.appendChild(el);
      this.rotateEl = el;
      this.input.reset();
    } else if (!on && this.rotateEl) {
      this.rotateEl.remove();
      this.rotateEl = null;
      // back in portrait mid-run: resume deliberately from the pause menu, not straight into the swarm
      if (this.world?.state === 'playing' && !this.pauses.has('levelup')) this.openPauseMenu();
    }
    this.setPause('rotate', on);
  }

  private lockPortrait(): void {
    const d = this.platform.device();
    if (d !== 'mobile' && d !== 'tablet') return;
    try {
      const o = screen.orientation as unknown as { lock?: (o: string) => Promise<void> } | undefined;
      o?.lock?.('portrait')?.catch(() => undefined);
    } catch {
      // not supported / not allowed outside fullscreen: the overlay covers it
    }
  }

  private wireLifecycle(): void {
    const onHidden = (hidden: boolean) => {
      this.setPause('hidden', hidden);
      this.audio.mute('hidden', hidden);
      if (hidden) {
        this.input.reset();
        this.save.flushNow();
      }
    };
    document.addEventListener('visibilitychange', () => onHidden(document.visibilityState === 'hidden'));
    window.addEventListener('blur', () => onHidden(true));
    window.addEventListener('focus', () => onHidden(document.visibilityState === 'hidden'));
    window.addEventListener('pagehide', () => this.save.flushNow());
    this.platform.onPause(() => {
      this.setPause('platform', true);
      this.audio.mute('platform', true);
    });
    this.platform.onResume(() => {
      this.setPause('platform', false);
      this.audio.mute('platform', false);
    });
  }

  applySettings(): void {
    const s = this.save.data.settings;
    this.audio.setVolumes(s.music, s.sfx);
    this.view.shakeEnabled = s.shake;
    this.quality.setSetting(s.quality);
  }

  private applyQuality(q: QualityLevel): void {
    this.view.setQuality(q);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const res = q === 2 ? dpr : q === 1 ? Math.min(dpr, 1.5) : 1;
    if (Math.abs(this.pixi.renderer.resolution - res) > 0.01) {
      this.pixi.renderer.resolution = res;
      this.pixi.renderer.resize(this.stage.w, this.stage.h, res);
    }
  }

  // ---------------------------------------------------------------- pause / gameplay markup

  setPause(reason: PauseReason, on: boolean): void {
    const had = this.pauses.has(reason);
    if (on === had) return;
    if (on) this.pauses.add(reason);
    else this.pauses.delete(reason);
    this.sync();
  }

  /** Re-derives GameplayAPI state, input and music muffling from the pause set. */
  sync(): void {
    const inRun = this.mode === 'run' && !!this.world;
    const blocking = ['user', 'hidden', 'ad', 'platform', 'revive', 'death', 'rotate'] as const;
    const gameplay = inRun && !blocking.some((r) => this.pauses.has(r));
    if (gameplay) this.platform.gameplayStart();
    else this.platform.gameplayStop();
    const running = inRun && this.pauses.size === 0 && this.world?.state === 'playing';
    this.input.setEnabled(running);
    // visible but unfocused (e.g. focus stayed on the host page after an ad): offer a tap to continue
    const needTap = inRun && this.pauses.has('hidden') && document.visibilityState === 'visible' && !this.pauses.has('ad');
    this.setTapOverlay(needTap);
    this.audio.setMusicMuffled(inRun && (this.pauses.has('user') || this.pauses.has('levelup') || this.pauses.has('revive') || this.pauses.has('rotate')));
  }

  private tapEl: HTMLElement | null = null;

  private setTapOverlay(on: boolean): void {
    if (on && !this.tapEl) {
      const el = document.createElement('button');
      el.className = 'tap-overlay';
      el.textContent = t('hud.tapToContinue');
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        window.focus();
        this.setPause('hidden', false);
        this.audio.mute('hidden', false);
      });
      document.body.appendChild(el);
      this.tapEl = el;
    } else if (!on && this.tapEl) {
      this.tapEl.remove();
      this.tapEl = null;
    }
  }

  get running(): boolean {
    return this.mode === 'run' && this.pauses.size === 0 && this.world?.state === 'playing';
  }

  // ---------------------------------------------------------------- ads

  /** Rewarded video. Resolves true only when the platform granted the reward. */
  async rewarded(): Promise<boolean> {
    if (this.adBusy) return false;
    this.adBusy = true;
    let opened = false;
    const ok = await this.platform.showRewarded({
      onOpen: () => {
        opened = true;
        this.setPause('ad', true);
        this.audio.mute('ad', true);
      },
      onClose: () => {
        this.setPause('ad', false);
        this.audio.mute('ad', false);
      },
    });
    this.adBusy = false;
    if (ok) {
      this.save.data.stats.adsWatched++;
      this.save.save();
    } else if (!opened) this.ui.toast(t('common.adUnavailable'), 'info', 'video');
    return ok;
  }

  /** Interstitial at a natural break. Never during gameplay; throttled on our side too. */
  async interstitial(): Promise<void> {
    if (this.adBusy || this.mode === 'run') return;
    if (Date.now() - this.lastInterstitial < CONFIG.interstitialMinGapMs) return;
    if (this.save.data.stats.runs < CONFIG.interstitialMinRuns) return;
    this.adBusy = true;
    this.lastInterstitial = Date.now();
    await this.platform.showInterstitial({
      onOpen: () => {
        this.setPause('ad', true);
        this.audio.mute('ad', true);
      },
      onClose: () => {
        this.setPause('ad', false);
        this.audio.mute('ad', false);
      },
    });
    this.adBusy = false;
  }

  // ---------------------------------------------------------------- navigation

  goMenu(withAd: boolean): void {
    const go = () => {
      this.mode = 'menu';
      this.world = null;
      this.ui.closeAllModals();
      this.hud.reset();
      this.view.setSector('ram');
      this.view.clearAttract();
      showMenu(this);
      this.audio.setMusic('menu');
      this.pauses.delete('user');
      this.pauses.delete('levelup');
      this.pauses.delete('revive');
      this.pauses.delete('death');
      this.sync();
    };
    if (withAd) void this.interstitial().then(go);
    else go();
  }

  startRun(sector: SectorId, mode: GameModeId): void {
    const save = this.save.data;
    this.ui.closeAllModals();
    const seedParam = new URLSearchParams(location.search).get('seed');
    this.world = new World({
      seed: seedParam ? Number(seedParam) : undefined,
      mode,
      sector,
      character: save.char,
      bonuses: runBonuses(save),
      weaponPool: weaponPool(save),
      passivePool: passivePool(save),
    });
    const vh = this.view.viewHalf();
    this.world.view.hw = vh.hw;
    this.world.view.hh = vh.hh;
    this.view.resetRun(this.world);
    this.hud.reset();
    this.ui.show(this.hud.el);
    this.mode = 'run';
    this.reviveAdUsed = false;
    this.freeRevivesUsed = 0;
    this.rerollAdUsed = false;
    this.levelUpOpen = false;
    this.deathT = 0;
    this.winT = 0;
    this.hitStop = 0;
    this.pauses.delete('user');
    this.pauses.delete('levelup');
    this.pauses.delete('revive');
    this.pauses.delete('death');
    this.audio.setMusic('run');
    this.runMenuMusic = false;
    this.tutorial = save.tutorialDone ? null : new Tutorial(this);
    this.input.moved = false;
    this.sync();
  }

  openPauseMenu(): void {
    if (this.mode !== 'run' || !this.world || this.pauses.has('user') || this.pauses.has('revive') || this.deathT > 0 || this.winT > 0) return;
    if (this.world.state !== 'playing' && this.world.state !== 'levelup') return;
    this.setPause('user', true);
    openPause(this, () => this.setPause('user', false));
  }

  /** Test hook: sandbox helpers for screenshots and content checks. */
  sandbox(cmd: { skip?: number; noWeapons?: boolean; give?: [string, number][]; evolve?: string[]; spawn?: [string, number, number?][]; time?: number; god?: boolean; passives?: [string, number][] }): void {
    const w = this.world;
    if (!w) return;
    if (cmd.god !== undefined) this.godMode = cmd.god;
    if (cmd.time !== undefined) w.t = cmd.time;
    if (cmd.skip !== undefined) w.skipTo(cmd.skip);
    if (cmd.noWeapons) w.weapons.length = 0;
    for (const [id, lv] of cmd.give ?? []) {
      let wp = w.weapons.find((x) => x.id === id);
      if (!wp) wp = w.addWeapon(id as never, 0);
      wp.level = lv;
    }
    for (const [id, lv] of cmd.passives ?? []) {
      for (let i = 0; i < lv; i++) {
        const has = w.passives.find((p) => p.id === id);
        w.applyCard({ kind: has ? 'passive_up' : 'passive_new', id, rarity: 0, levelFrom: 0, levelTo: 1, value: 0 });
      }
    }
    for (const id of cmd.evolve ?? []) w.evolve(id as never);
    for (const [id, n, r = 220] of cmd.spawn ?? []) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        w.spawnEnemy(id as never, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
      }
    }
  }

  /** Capture hook: advance exactly one frame of `dt` seconds and render it (ticker stopped). */
  captureFrame(dt: number): void {
    this.tick(dt);
    this.pixi.render();
  }

  /** Test hook: hand control to the steering bot (also auto-picks upgrades). */
  enableBot(skill = 0.6): void {
    this.bot = new Bot({ skill, seed: 99 });
  }

  quitRun(): void {
    if (!this.world) return;
    this.finishRun(false);
  }

  // ---------------------------------------------------------------- frame

  private tick(dt: number): void {
    try {
      this.frame(dt);
    } catch (e) {
      console.error('[frame]', e);
    }
  }

  private frame(dt: number): void {
    this.input.update();
    this.quality.sample(dt);
    const w = this.world;
    const t0 = performance.now();
    let t1 = t0;
    if ((this.mode === 'run' || this.mode === 'results') && w) {
      if (this.mode === 'run') {
        // keep the spawn ring in sync with resizes / rotations
        const vh = this.view.viewHalf();
        w.view.hw = vh.hw;
        w.view.hh = vh.hh;
        this.stepRun(w, dt);
      }
      t1 = performance.now();
      const frozen = this.mode === 'run' && this.pauses.size > 0 && this.deathT <= 0 && this.winT <= 0;
      this.view.render(w, frozen ? 0 : dt);
      if (this.mode === 'run') this.hud.update(w);
    } else {
      this.view.renderAttract(dt);
    }
    if (this.debugEl) this.debugTick(dt, t1 - t0, performance.now() - t1);
    if (this.gemComboT > 0) {
      this.gemComboT -= dt;
      if (this.gemComboT <= 0) this.gemCombo = 0;
    }
  }

  private stepRun(w: World, dt: number): void {
    if (this.winT > 0) {
      // victory slow-motion: let the Chaos Core's explosion play out before the results
      this.winT -= dt;
      if (this.winT <= 0) this.finishRun(true);
      return;
    }
    if (this.deathT > 0) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.onDeath();
      return;
    }
    if (this.pauses.size === 0 && w.state === 'playing') {
      if (this.bot) this.bot.steer(w, dt);
      else {
        w.input.x = this.input.move.x;
        w.input.y = this.input.move.y;
      }
      let sim = dt;
      if (this.hitStop > 0) {
        const s = Math.min(this.hitStop, sim);
        this.hitStop -= s;
        sim -= s;
        sim *= 1; // remaining time runs normally
      }
      while (sim > 1e-4) {
        const step = Math.min(sim, 1 / 30);
        if (this.godMode) w.player.hp = w.stats.maxHp;
        w.update(step);
        this.onEvents(w);
        sim -= step;
        if (w.state !== 'playing') break;
      }
      this.tutorial?.update(w, dt);
      this.audio.setMusicProgress(w.t / BALANCE.bossTime, Math.min(1, w.enemies.length / 300));
    }
    if (w.state === 'levelup' && !this.levelUpOpen) this.openLevelUp(w);
    else if (w.state === 'dead' && !this.pauses.has('death') && !this.pauses.has('revive')) this.startDeath(w);
    else if (w.state === 'won' && this.winT <= 0) {
      this.winT = 1.7;
      this.input.setEnabled(false);
      this.audio.setMusicMuffled(true);
    }
  }

  private onEvents(w: World): void {
    this.view.consume(w);
    const fb = this.view.feedback;
    if (fb.hitStop > 0) {
      this.hitStop = Math.max(this.hitStop, fb.hitStop);
      fb.hitStop = 0;
    }
    if (fb.vibrate > 0) {
      this.vibrate(fb.vibrate);
      fb.vibrate = 0;
    }
    const evs = w.events;
    for (let i = 0; i < evs.count; i++) {
      const e = evs.items[i];
      switch (e.type) {
        case EV.HIT:
          this.sfx('hit', 0.6, e.b ? 0.8 : 1.1);
          break;
        case EV.KILL:
          if (e.c & 6) this.sfx('killBig', 1);
          else if (e.c & 1) this.sfx('killBig', 0.55, 1.3);
          else this.sfx('kill', 0.7, 1.35 - Math.min(0.5, e.b / 40));
          break;
        case EV.PLAYER_HIT:
          this.sfx('hurt');
          break;
        case EV.GEM:
          this.gemCombo = Math.min(this.gemCombo + 1, 16);
          this.gemComboT = 0.5;
          this.sfx('gem', 0.7, 1 + this.gemCombo * 0.045);
          break;
        case EV.LEVELUP:
          this.sfx('levelup');
          this.hud.flashXp();
          break;
        case EV.SHOOT: {
          const id = SHOT_SFX[e.a];
          if (id) this.sfx(id, id === 'pulse' || id === 'drone' ? 0.6 : 0.85);
          break;
        }
        case EV.EXPLODE:
          this.sfx('explode', 0.8);
          break;
        case EV.HEAL:
          this.sfx('heal');
          break;
        case EV.PICKUP:
          this.sfx('pickup');
          break;
        case EV.BOSS:
          this.sfx('boss');
          this.hud.banner(t('hud.warnBoss', { name: t(`e.${String(e.ref)}`) }), 'boss');
          if (e.a === 1) this.audio.setMusic('boss');
          break;
        case EV.SHIELD_HIT:
          this.sfx('shield', 0.6);
          break;
        case EV.CHEST:
          this.sfx('chest');
          this.hud.banner(t('hud.chest'), 'gold');
          break;
        case EV.EVOLVE:
          this.sfx('evolve');
          this.hud.banner(t('hud.evolved', { name: t(`w.${String(e.ref as EvolutionId)}`) }), 'gold');
          break;
        case EV.MAGNET:
          this.sfx('magnet');
          break;
        case EV.ENEMY_SHOOT:
          this.sfx('enemyShot', 0.6);
          break;
        case EV.WARN:
          this.sfx('warn', 0.8);
          this.hud.banner(t(e.a === 1 ? 'hud.warnRush' : 'hud.warnRing'), 'info');
          break;
        case EV.BOSS_PHASE:
          this.sfx('bossPhase');
          break;
        case EV.REVIVE:
          this.sfx('revive');
          break;
        case EV.TELEPORT:
          this.sfx('teleport', 0.5);
          break;
        default:
          break;
      }
    }
    // the final boss died: back to run music for the endless continuation
    if (w.mode === 'endless' && !w.boss && !this.runMenuMusic && w.run.bossKills > 0) {
      this.runMenuMusic = true;
      this.audio.setMusic('run');
    }
  }

  private debugTick(dt: number, sim: number, view: number): void {
    const d = this.dbg;
    d.acc += dt;
    d.frames++;
    d.sim += sim;
    d.view += view;
    if (d.acc < 0.5 || !this.debugEl) return;
    const w = this.world;
    this.debugEl.textContent = `${Math.round(d.frames / d.acc)} fps | sim ${(d.sim / d.frames).toFixed(2)} ms | view ${(d.view / d.frames).toFixed(2)} ms | q${this.quality.level} | e ${w?.enemies.length ?? 0} b ${w?.bullets.length ?? 0} g ${w?.gems.length ?? 0} fx ${this.view.stats().particles}`;
    d.acc = d.frames = d.sim = d.view = 0;
  }

  sfx(id: SfxId, vol = 1, rate = 1): void {
    this.audio.play(id, vol, rate);
  }

  vibrate(ms: number): void {
    if (!this.save.data.settings.vibration) return;
    const now = performance.now();
    if (now - this.lastVibrate < 120) return;
    this.lastVibrate = now;
    try {
      navigator.vibrate?.(Math.min(400, ms));
    } catch {
      /* not supported */
    }
  }

  // ---------------------------------------------------------------- level up

  private openLevelUp(w: World): void {
    this.levelUpOpen = true;
    this.rerollAdUsed = false;
    this.setPause('levelup', true);
    this.tutorial?.onLevelUp();
    const modal = this.ui.openModal(
      buildLevelUp({
        chest: w.chestChoice,
        getCards: () => w.choices,
        pick: (i) => {
          w.chooseCard(i);
          this.rerollAdUsed = false;
        },
        hasMore: () => w.state === 'levelup',
        rerollsLeft: () => w.rerollsLeft,
        reroll: () => {
          w.reroll(false);
        },
        canAdReroll: () => !this.rerollAdUsed,
        adReroll: async () => {
          const ok = await this.rewarded();
          if (ok) {
            this.rerollAdUsed = true;
            w.reroll(true);
          }
          return ok;
        },
        onClose: () => {
          this.ui.closeModal(modal);
          this.levelUpOpen = false;
          this.setPause('levelup', false);
        },
        sound: (id) => this.sfx(id, 0.8),
      }),
    );
    if (this.bot) this.botPick(modal, w);
  }

  private botPick(modal: HTMLElement, w: World): void {
    setTimeout(() => {
      if (!modal.isConnected || w.state !== 'levelup' || !this.bot) return;
      const i = this.bot.pick(w.choices, w);
      const cards = modal.querySelectorAll<HTMLElement>('.card');
      cards[i]?.click();
      setTimeout(() => this.botPick(modal, w), 700);
    }, 650);
  }

  // ---------------------------------------------------------------- death / revive / results

  private startDeath(w: World): void {
    this.setPause('death', true);
    this.deathT = 1.1;
    this.view.fx.burst(w.player.x, w.player.y, 0x29f6ff, 70, 520, 1.5, 1.1);
    this.view.fx.ring(w.player.x, w.player.y, 0xff3df2, 220, 0.7);
    this.view.addTrauma(0.4);
    this.view.flashScreen(0xff2a55, 0.5);
    this.sfx('killBig', 1, 0.7);
    this.vibrate(300);
  }

  private onDeath(): void {
    const w = this.world;
    if (!w) return;
    const freeLeft = Math.max(0, Math.floor(w.stats.revives) - this.freeRevivesUsed);
    if (freeLeft <= 0 && this.reviveAdUsed) {
      this.finishRun(false);
      return;
    }
    this.setPause('revive', true);
    this.setPause('death', false);
    openRevive(this, {
      freeLeft,
      adAvailable: !this.reviveAdUsed,
      onFree: () => {
        this.freeRevivesUsed++;
        this.doRevive();
      },
      onAd: async () => {
        const ok = await this.rewarded();
        if (ok) {
          this.reviveAdUsed = true;
          this.doRevive();
        }
        return ok;
      },
      onDecline: () => {
        this.setPause('revive', false);
        this.finishRun(false);
      },
    });
  }

  private doRevive(): void {
    const w = this.world;
    if (!w) return;
    w.revive();
    this.onEvents(w);
    this.setPause('revive', false);
  }

  finishRun(won: boolean): void {
    const w = this.world;
    if (!w || this.mode !== 'run') return;
    this.ui.closeAllModals();
    this.levelUpOpen = false;
    this.mode = 'results';
    this.deathT = 0;
    this.winT = 0;
    this.pauses.delete('user');
    this.pauses.delete('levelup');
    this.pauses.delete('revive');
    this.pauses.delete('death');
    this.tutorial?.dispose();
    this.tutorial = null;
    // nothing from the run's HUD (boss bar, low-HP vignette, banners) may outlive it
    this.hud.reset();
    this.summary = applyRunResult(this.save.data, w, won);
    this.save.save(true);
    if (w.mode === 'endless' && this.platform.isAuthorized()) {
      void this.platform.setScore(CONFIG.leaderboard, Math.round(this.save.data.bestEndless * 1000));
    }
    this.audio.setMusic('menu');
    this.sfx(won ? 'victory' : 'defeat');
    this.sync();
    showResults(this, this.summary);
  }

  /** Grants the ×2 bits reward on the results screen. */
  doubleBits(): void {
    const s = this.summary;
    if (!s || s.doubled) return;
    s.doubled = true;
    this.save.data.bits += s.bits;
    this.save.data.stats.bitsEarned += s.bits;
    const extra = checkAchievements(this.save.data, null, false);
    s.achievements.push(...extra);
    this.save.save(true);
  }
}
