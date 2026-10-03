import { AudioSys } from './audio/audio';
import type { SfxName } from './audio/sfx';
import { Input } from './core/input';
import { CONFIG } from './data/config';
import { BNODES } from './data/buildings';
import type { MapId } from './data/maps';
import { mutatorMultiplier } from './data/perks';
import { UNITS, type UnitId } from './data/units';
import { normalizeLang, setLang, t, tk } from './i18n';
import type { Platform } from './platform/Platform';
import { SaveManager } from './save/save';
import { Bot } from './systems/bot';
import { Game, type RunConfig } from './systems/Game';
import { applyRun, checkAchievements, type MetaOutcome } from './systems/meta';
import { vibrate } from './ui/dom';
import { Hud, nodeName } from './ui/hud';
import { Screens, type ResultsData, type UiHost } from './ui/screens';
import { Tutorial } from './ui/tutorial';
import { IconRenderer } from './world/icons';
import { makeWorldMaterial } from './world/material';
import { Stage } from './world/stage';
import { View } from './world/View';

type Mode = 'boot' | 'menu' | 'run' | 'results';

export class App implements UiHost {
  readonly save: SaveManager;
  readonly icons: IconRenderer;
  readonly audio = new AudioSys();
  readonly stage: Stage;
  readonly input: Input;
  readonly screens: Screens;
  readonly material = makeWorldMaterial();
  mode: Mode = 'boot';
  game: Game | null = null;
  view: View | null = null;
  hud: Hud | null = null;
  tutorial: Tutorial | null = null;
  bot: Bot | null = null;
  private offs: (() => void)[] = [];
  private pauses = new Set<string>();
  private gameplayActive = false;
  private readyCalled = false;
  private lastInterstitial = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private outcome: MetaOutcome | null = null;
  private resultsData: ResultsData | null = null;
  private respawnAdNight = -1;
  timeScale = 1;
  errors: string[] = [];

  constructor(readonly platform: Platform, readonly root: HTMLElement, canvas: HTMLCanvasElement) {
    this.save = new SaveManager(platform);
    this.stage = new Stage(canvas);
    this.icons = new IconRenderer(128);
    const joy = document.getElementById('joy')!;
    this.input = new Input(canvas, joy);
    this.input.onGesture = () => this.audio.unlock();
    this.screens = new Screens(document.getElementById('ui')!, this);
  }

  async init(onProgress: (p: number) => void): Promise<void> {
    await this.save.load();
    onProgress(0.35);
    this.applySettings();
    onProgress(0.5);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    document.addEventListener('visibilitychange', () => this.setPause('hidden', document.hidden));
    window.addEventListener('blur', () => this.setPause('blur', true));
    window.addEventListener('focus', () => this.setPause('blur', false));
    window.addEventListener('pagehide', () => this.save.flush());
    this.platform.onPause(() => this.setPause('sdk', true));
    this.platform.onResume(() => this.setPause('sdk', false));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    // Warm up the icon renderer and shader programs while the loader is still visible.
    for (const id of ['grunt', 'runner', 'shieldbearer'] as const) this.icons.unit(id);
    onProgress(0.7);
    this.showMenu(false);
    this.stage.render();
    onProgress(1);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Called once the menu is visible and interactive. */
  ready(): void {
    if (this.readyCalled) return;
    this.readyCalled = true;
    this.platform.loadingReady();
  }

  // ------------------------------------------------------------ settings
  applySettings(): void {
    const s = this.save.data.settings;
    this.audio.setVolumes(s.music, s.sfx);
    const lang = s.lang === 'auto' ? normalizeLang(this.platform.langCode()) : s.lang;
    setLang(lang);
    document.title = t('title');
    if (this.stage.setting !== s.quality) this.stage.setQualitySetting(s.quality);
  }

  resetProgress(): void {
    this.save.reset(true);
    this.applySettings();
    this.hudToast(t('set.resetDone'));
    this.showMenu(false);
  }

  click(): void { this.audio.unlock(); this.audio.play('click', 0.6); }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.stage.resize(w, h);
  }

  // ------------------------------------------------------------ pause / gameplay state
  private setPause(reason: string, on: boolean): void {
    if (on) this.pauses.add(reason); else this.pauses.delete(reason);
    const silent = this.pauses.has('ad') || this.pauses.has('hidden') || this.pauses.has('blur') || this.pauses.has('sdk');
    this.audio.setMuted('sys', silent);
    if (on && (reason === 'hidden' || reason === 'blur' || reason === 'sdk') && this.mode === 'run' && !this.pauses.has('user') && !this.pauses.has('ad')) {
      this.openPause();
    }
    if (on) this.input.reset();
    this.syncGameplay();
  }

  private get paused(): boolean { return this.pauses.size > 0; }

  private syncGameplay(): void {
    const g = this.game;
    const active = this.mode === 'run' && !!g && !this.paused && g.phase !== 'victory' && g.phase !== 'defeat';
    if (g) g.paused = this.paused;
    if (active !== this.gameplayActive) {
      this.gameplayActive = active;
      if (active) this.platform.gameplayStart(); else this.platform.gameplayStop();
    }
  }

  // ------------------------------------------------------------ ads
  private adHooks() {
    return {
      onStart: () => { this.setPause('ad', true); this.audio.setMuted('ad', true); },
      onEnd: () => { this.audio.setMuted('ad', false); this.setPause('ad', false); },
    };
  }

  async rewarded(): Promise<boolean> {
    const ok = await this.platform.showRewarded(this.adHooks());
    if (!ok) this.hudToast(t('hud.adFail'));
    return ok;
  }

  /** Interstitial only at logical pauses (between screens), never during a run. */
  private interstitial(then: () => void): void {
    const now = Date.now();
    if (!this.readyCalled || now - this.lastInterstitial < CONFIG.interstitialCooldownMs || this.mode === 'run') { then(); return; }
    this.lastInterstitial = now;
    void this.platform.showInterstitial(this.adHooks()).then(then);
  }

  // ------------------------------------------------------------ menu
  private menuGame(): Game {
    const g = new Game({ map: 'coast', weapon: this.save.data.weapon, perks: [], mutators: [], endless: false, seed: 7 });
    const nodes: Record<string, string> = {
      castle: 'castle_citadel_bastions', tower1: 'tower_archer_keen', tower2: 'tower_ballista', tower3: 'tower_archer', magic1: 'magic_frost',
      farm1: 'farm_mill_harvest', farm2: 'farm_mill', farm3: 'farm', barracks1: 'barracks_spear', forge1: 'forge_armory', wall1: 'wall_stone', fish1: 'fish_pier', range1: 'range_bows', mine1: 'mine_deep',
    };
    for (const [slot, node] of Object.entries(nodes)) {
      const b = g.bySlot.get(slot);
      if (b) g.applyNode(b, BNODES[node], false, true);
    }
    g.hero.x = 4.5; g.hero.z = 6; g.hero.facing = 0.6;
    return g;
  }

  showMenu(withAd: boolean): void {
    const go = () => {
      this.teardownRun();
      this.mode = 'menu';
      const g = this.menuGame();
      this.game = g;
      this.view = new View(this.stage, g, this.material);
      this.view.showcase = true;
      this.stage.dayness = 1;
      this.stage.dayTarget = 1;
      this.audio.setMood('menu');
      this.screens.showMenu();
      this.syncGameplay();
    };
    if (withAd) this.interstitial(go); else go();
  }

  // ------------------------------------------------------------ runs
  startRun(map: MapId, endless: boolean, seed?: number): void {
    const s = this.save.data;
    const cfg: RunConfig = { map, weapon: s.weapon, perks: [...s.perks], mutators: [...s.mutators], endless, seed: seed ?? (Math.random() * 1e9) | 0 };
    this.save.change((d) => { d.run = null; });
    this.beginRun(cfg);
  }

  continueRun(): void {
    const snap = this.save.data.run;
    if (!snap) { this.screens.showMenu(); return; }
    this.beginRun({ map: snap.map, weapon: snap.weapon, perks: snap.perks, mutators: snap.mutators, endless: snap.endless, seed: snap.seed, snapshot: snap });
  }

  private beginRun(cfg: RunConfig): void {
    this.audio.unlock();
    this.teardownRun();
    this.screens.clear();
    const g = new Game(cfg);
    g.timeScale = this.timeScale;
    this.game = g;
    this.view = new View(this.stage, g, this.material);
    this.stage.dayness = 1;
    const hud = new Hud(document.getElementById('ui')!, g, this.stage, this.icons, {
      pause: () => { this.click(); this.openPause(); },
      startNight: () => { this.click(); g.input.startNight = true; },
      rally: () => { g.input.rally = true; },
      ability: () => { g.input.ability = true; },
      coinsAd: () => void this.coinsAd(),
      respawnAd: () => void this.respawnAd(),
      choose: (i) => this.choose(i),
      holdButton: (on) => { this.input.holdButton = on; this.audio.unlock(); },
      speed: () => this.toggleSpeed(),
    });
    this.hud = hud;
    hud.setTouch(this.platform.isMobile() || this.input.touchMode || navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
    this.mode = 'run';
    this.respawnAdNight = -1;
    this.bindRun(g, hud);
    if (!this.save.data.tutorialDone && cfg.map === 'valley' && !cfg.snapshot) {
      this.tutorial = new Tutorial(g, hud, () => hud.touch, () => { this.save.change((d) => { d.tutorialDone = true; }); });
    }
    this.audio.setMood('day');
    hud.banner(t('hud.day'), tk(`map.${cfg.map}`));
    this.saveSnapshot();
    this.syncGameplay();
    this.introduceEnemies();
  }

  private bindRun(g: Game, hud: Hud): void {
    const ev = g.events;
    const vol = (x: number, z: number, base = 1) => {
      const d = Math.hypot(x - this.stage.target.x, z - this.stage.target.z);
      return base * Math.max(0, 1 - d / 38);
    };
    const play = (n: SfxName, v = 1, r = 1) => this.audio.play(n, v, r);
    const vib = (ms: number) => vibrate(this.save.data.settings.vibration && hud.touch, ms);
    this.offs.push(
      ev.on('coinIn', () => play('coin', 0.5, 0.9 + (g.hold ? (g.hold.t / g.hold.need) * 0.5 : 0))),
      ev.on('built', ({ b, upgrade }) => {
        play('build', 0.9);
        play(upgrade ? 'upgrade' : 'chime', 0.7);
        vib(18);
        if (b.node) hud.floatText(b.x, g.heightAt(b.x, b.z) + 3.5, b.z, nodeName(b.node));
        this.liveAchievements();
      }),
      ev.on('choice', ({ b, options }) => { play('chime', 0.6, 1.2); hud.showChoice(b, options); }),
      ev.on('phase', ({ phase, night }) => {
        hud.hideChoice();
        if (phase === 'night') {
          hud.hideIntro();
          this.audio.setMood('night');
          play('horn', 0.9);
          const boss = g.plan.boss;
          hud.banner(t('hud.nightFalls', { n: night }), boss ? t('hud.bossNight') : !g.cfg.endless && night === g.map.nights ? t('hud.lastNight') : t('hud.nightFallsSub'));
        } else if (phase === 'dawn') {
          this.audio.setMood('day');
          play('dawn', 0.8);
          const inc = g.lastIncome;
          hud.banner(t('hud.dawn'), inc ? t('hud.dawnIncome', { n: inc.total }) + (inc.clean ? ` · ${t('hud.clean')}` : '') : t('hud.dawnSub'));
          this.liveAchievements();
        } else if (phase === 'day') {
          hud.coinsAdUsed = false;
          hud.fast = false;
          g.timeScale = this.timeScale;
          this.saveSnapshot();
          this.introduceEnemies();
        } else if (phase === 'victory') {
          play('victory', 1);
          this.finishRun(true);
        } else if (phase === 'defeat') {
          play('defeat', 1);
          this.audio.setMood('silent');
          this.onDefeat();
        }
        this.syncGameplay();
      }),
      ev.on('income', ({ parts }) => {
        let k = 0;
        for (const p of parts) {
          hud.floatText(p.b.x, g.heightAt(p.b.x, p.b.z) + 3, p.b.z, `+${p.n}`);
          if (k++ < 6) setTimeout(() => play('coin', 0.5, 1 + k * 0.05), 400 + k * 120);
        }
      }),
      ev.on('shoot', ({ p }) => {
        const v = vol(p.x, p.z, 0.7);
        if (v <= 0.05) return;
        const k = p.kind;
        if (k === 'arrow' || k === 'dart') play('arrow', v);
        else if (k === 'bolt') play('bolt', v);
        else if (k === 'fire') play('fire', v);
        else if (k === 'frost') play('frost', v);
        else play('magic', v);
      }),
      ev.on('death', ({ u }) => { if (u.team === 1) play('poof', vol(u.x, u.z, u.def.big ? 1 : 0.55), u.def.big ? 0.6 : 1); }),
      ev.on('melee', ({ x, z }) => play('hit', vol(x, z, 0.45))),
      ev.on('hit', ({ e }) => { if (e.ent === 'h') { play('hurt', 0.6); vib(12); } }),
      ev.on('bdestroyed', ({ b }) => { play('crash', vol(b.x, b.z, 1)); vib(60); }),
      ev.on('ability', ({ kind }) => { play(kind === 'starfall' ? 'heal' : 'whoosh', 0.9); vib(25); }),
      ev.on('heroDeath', () => { play('defeat', 0.5, 1.6); vib(80); }),
      ev.on('heroRespawn', () => play('respawn', 0.7)),
      ev.on('bossSpawn', () => { play('roar', 1); vib(120); }),
      ev.on('rally', ({ mode }) => { play('click', 0.7); hud.toast(mode === 'charge' ? t('hud.troopsCharge') : t('hud.troopsHold')); }),
      ev.on('troopSpawn', ({ u }) => play('respawn', vol(u.x, u.z, 0.25), 1.6)),
      ev.on('holdCancel', () => undefined),
    );
  }

  /** Shows a card for every enemy type the player meets for the first time. */
  private introduceEnemies(): void {
    const g = this.game, hud = this.hud;
    if (!g || !hud || this.mode !== 'run') return;
    const seen = new Set(this.save.data.seen);
    const fresh: UnitId[] = [];
    for (const m of g.plan.preview.values()) for (const id of m.keys()) if (!seen.has(id) && !fresh.includes(id)) fresh.push(id);
    if (!fresh.length) return;
    this.save.change((d) => { d.seen = [...d.seen, ...fresh]; });
    hud.showIntro(fresh.slice(0, 3).map((id) => ({ icon: this.icons.unit(id), name: tk(`unit.${id}`), desc: tk(`unit.${id}.d`), boss: !!UNITS[id].boss })));
  }

  private toggleSpeed(): void {
    const g = this.game, hud = this.hud;
    if (!g || !hud || g.phase !== 'night') return;
    this.click();
    hud.fast = !hud.fast;
    g.timeScale = this.timeScale * (hud.fast ? 2 : 1);
  }

  private liveAchievements(): void {
    const g = this.game;
    if (!g || !this.hud) return;
    const got = checkAchievements(this.save.data, undefined, g.stats);
    if (got.length) {
      this.save.change();
      for (const a of got) this.hud.toast(t('ach.unlocked', { s: tk(`ach.${a}`) }), 'ach');
    }
  }

  private saveSnapshot(): void {
    const g = this.game;
    if (!g || this.mode !== 'run' || g.phase !== 'day') return;
    this.save.change((d) => { d.run = g.snapshot(); });
  }

  private choose(i: number): void {
    const g = this.game;
    if (!g || !g.choice) return;
    this.click();
    g.chooseUpgrade(i);
    this.hud?.hideChoice();
  }

  private async coinsAd(): Promise<void> {
    const g = this.game, hud = this.hud;
    if (!g || !hud || hud.coinsAdUsed || g.phase !== 'day') return;
    this.click();
    hud.coinsAdUsed = true;
    if (await this.rewarded()) {
      g.coins += CONFIG.rewardCoins;
      hud.toast(t('hud.rewardOk'), 'good');
      this.audio.play('coin', 0.8);
    } else hud.coinsAdUsed = false;
  }

  private async respawnAd(): Promise<void> {
    const g = this.game, hud = this.hud;
    if (!g || !hud || g.hero.alive || this.respawnAdNight === g.night) return;
    this.click();
    if (await this.rewarded()) {
      this.respawnAdNight = g.night;
      hud.respawnAdUsed = true;
      if (!g.hero.alive) g.respawnHero();
    }
  }

  private openPause(): void {
    if (this.mode !== 'run' || this.pauses.has('user')) return;
    this.pauses.add('user');
    this.syncGameplay();
    const resume = () => { this.screens.clear(); this.pauses.delete('user'); this.syncGameplay(); };
    const show = () => this.screens.showPause(resume, () => this.screens.showSettings(show), () => this.exitToMenu(), !!this.hud?.touch);
    show();
  }

  private exitToMenu(): void {
    this.pauses.delete('user');
    this.saveSnapshot();
    this.save.flush();
    this.showMenu(true);
  }

  private onDefeat(): void {
    const g = this.game!;
    this.hud?.hideChoice();
    const canSecond = !g.secondChanceUsed;
    setTimeout(() => {
      if (this.game !== g || g.phase !== 'defeat') return;
      this.screens.showDefeat(canSecond, async () => {
        this.click();
        if (await this.rewarded()) {
          this.screens.clear();
          g.secondChance();
          this.audio.setMood('day');
          this.hud?.banner(t('hud.day'), t('defeat.secondDesc'));
          this.syncGameplay();
        }
      }, () => { this.click(); this.finishRun(false); });
    }, 1400);
  }

  private finishRun(victory: boolean): void {
    const g = this.game;
    if (!g || this.mode !== 'run') return;
    this.mode = 'results';
    this.syncGameplay();
    const nights = victory ? g.map.nights : g.nightsSurvived;
    const r = { map: g.cfg.map, endless: g.cfg.endless, victory: victory && !g.cfg.endless, nights, stats: g.stats, weapon: g.cfg.weapon, mutators: g.cfg.mutators };
    let outcome!: MetaOutcome;
    this.save.change((d) => {
      d.run = null;
      outcome = applyRun(d, r);
    }, true);
    this.outcome = outcome;
    if (g.cfg.endless) void this.platform.submitScore(this.save.data.endlessBest);
    const data: ResultsData = {
      victory: r.victory, endless: r.endless, map: r.map, nights, kills: g.stats.kills, lost: g.stats.lost,
      glory: outcome.glory, mult: mutatorMultiplier(g.cfg.mutators), levelBefore: outcome.levelBefore, levelAfter: outcome.levelAfter,
      unlocks: outcome.unlocks, achievements: outcome.achievements, record: outcome.record, mapUnlocked: outcome.mapUnlocked, canDouble: outcome.glory > 0,
    };
    this.resultsData = data;
    this.audio.setMood('menu');
    setTimeout(() => {
      this.hud?.hint(null);
      this.screens.showResults(data, () => void this.doubleGlory(), () => { this.click(); this.showMenu(true); });
    }, victory ? 2200 : 300);
  }

  private async doubleGlory(): Promise<void> {
    const o = this.outcome, d = this.resultsData;
    if (!o || !d || !d.canDouble) return;
    this.click();
    if (await this.rewarded()) {
      d.canDouble = false;
      this.save.change((s) => { s.glory += o.glory; }, true);
      d.glory = o.glory * 2;
      this.screens.updateGlory(d.glory);
      this.audio.play('chime', 0.8);
    }
  }

  private hudToast(s: string): void { this.hud?.toast(s); }

  private teardownRun(): void {
    for (const o of this.offs) o();
    this.offs = [];
    this.hud?.dispose();
    this.hud = null;
    this.tutorial = null;
    this.bot = null;
    this.view?.dispose();
    this.view = null;
    this.game?.dispose();
    this.game = null;
    this.input.reset();
    this.pauses.delete('user');
  }

  // ------------------------------------------------------------ main loop
  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (document.hidden) return;
    try {
      this.tick(dt);
    } catch (e) {
      this.reportError(e);
    }
  };

  reportError(e: unknown): void {
    const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    if (this.errors.length < 20) this.errors.push(msg);
  }

  private tick(dt: number): void {
    this.time += dt;
    const g = this.game;
    this.audio.update();
    if (g) {
      if (this.mode === 'run' && !this.paused) this.handleInput(g);
      if (this.bot && this.mode === 'run' && !this.paused) this.bot.update(dt * g.timeScale);
      const simDt = this.paused ? 0 : dt;
      g.update(simDt);
      if (this.mode === 'menu') g.update(0);
      this.tutorial?.update(dt);
    }
    this.view?.update(this.paused ? 0 : dt, this.time);
    this.stage.updateLighting(dt);
    this.stage.updateCamera(this.view?.fx.shake ?? 0, this.time);
    this.hud?.update();
    this.stage.render();
    this.stage.trackFps(dt);
    this.input.endFrame();
  }

  private handleInput(g: Game): void {
    const inp = this.input;
    if (inp.pressed('Escape', 'KeyP')) {
      if (g.choice) { g.cancelChoice(); this.hud?.hideChoice(); }
      else this.openPause();
      return;
    }
    if (g.choice) {
      if (inp.pressed('Digit1', 'Numpad1', 'ArrowLeft', 'KeyA')) this.choose(0);
      else if (inp.pressed('Digit2', 'Numpad2', 'ArrowRight', 'KeyD')) this.choose(1);
      g.input.moveX = 0; g.input.moveZ = 0; g.input.hold = false;
      return;
    }
    if (this.bot) return;
    const m = inp.screenMove();
    const yaw = this.stage.yaw;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let mx = rx * m.x - fx * m.y, mz = rz * m.x - fz * m.y;
    if (inp.mouse.down && mx === 0 && mz === 0) {
      const p = this.stage.groundPoint(inp.mouse.x, inp.mouse.y);
      if (p) {
        const dx = p.x - g.hero.x, dz = p.z - g.hero.z, d = Math.hypot(dx, dz);
        if (d > 0.6) { mx = dx / d; mz = dz / d; }
      }
    }
    g.input.moveX = mx;
    g.input.moveZ = mz;
    g.input.hold = inp.hold;
    if (inp.pressed('KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight')) g.input.ability = true;
    if (inp.pressed('KeyR', 'KeyF')) g.input.rally = true;
    if (inp.pressed('Enter', 'NumpadEnter', 'KeyN') && g.phase === 'day') g.input.startNight = true;
    if (inp.touchMode && this.hud && !this.hud.touch) this.hud.setTouch(true);
  }

  // ------------------------------------------------------------ test hooks
  enableBot(on: boolean): void {
    if (!this.game || this.mode !== 'run') return;
    this.bot = on ? new Bot(this.game, { skill: 0.9, noise: 0.05, seed: 3 }) : null;
  }

  /** Steps the simulation without rendering (smoke tests / screenshots). */
  fastForward(seconds: number, step = 1 / 20): void {
    const g = this.game;
    if (!g || this.mode !== 'run') return;
    const scale = g.timeScale;
    g.timeScale = 1;
    for (let t = 0; t < seconds && this.mode === 'run' && g.phase !== 'defeat'; t += step) {
      this.bot?.update(step);
      g.update(step);
      this.view?.update(step, this.time += step);
      if (g.choice && !this.bot) g.chooseUpgrade(0);
    }
    g.timeScale = scale;
  }

  /** Test/screenshot hook: stage a scene. */
  debugSetup(o: { tier?: number; spec?: number; coins?: number; night?: number; phase?: 'day' | 'night'; spawn?: string[]; spawnPath?: number; spawnS?: number; hero?: [number, number]; facing?: number; dayness?: number; hideHud?: boolean; zoom?: number; target?: [number, number]; skip?: string[] }): void {
    const g = this.game;
    if (!g) return;
    if (o.tier !== undefined) {
      for (const b of g.buildings) {
        if (o.skip?.includes(b.slot.id)) continue;
        let node = BNODES[b.kind];
        const spec = (o.spec ?? (b.id % 2));
        if (o.tier >= 1) node = BNODES[node.next[spec]];
        if (o.tier >= 2) node = BNODES[node.next[(b.id >> 1) % 2]];
        g.applyNode(b, node, false, true);
      }
    }
    if (o.coins !== undefined) g.coins = o.coins;
    if (o.night !== undefined) { g.night = o.night; g.plan = g.makePlan(); }
    if (o.phase === 'night') { g.startNight(); g.nightTime = 0; }
    if (o.hero) { g.hero.x = o.hero[0]; g.hero.z = o.hero[1]; }
    if (o.facing !== undefined) g.hero.facing = o.facing;
    if (o.spawn) {
      o.spawn.forEach((id, i) => {
        const u = g.spawnEnemy(id as never, o.spawnPath ?? 0, (o.spawnS ?? 20) + i * 1.4);
        u.age = 5;
      });
    }
    if (o.dayness !== undefined) { this.stage.dayness = o.dayness; this.stage.dayTarget = o.dayness; }
    if (o.hideHud && this.hud) this.hud.root.style.display = 'none';
    if (o.zoom !== undefined) this.stage.zoom = o.zoom;
    if (o.target) this.stage.follow(o.target[0], 0, o.target[1], 0, true);
  }

  /** Test hook: end the current run immediately. */
  debugEndRun(victory: boolean): void {
    if (this.mode === 'run') this.finishRun(victory);
  }

  setSpeed(s: number): void {
    this.timeScale = s;
    if (this.game) this.game.timeScale = s;
  }

  stop(): void { cancelAnimationFrame(this.raf); }
}
