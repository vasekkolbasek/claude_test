import { Application, Container, Sprite, TilingSprite, type Texture } from 'pixi.js';
import { clamp, damp, easeOutBack } from '../core/math';
import { ENEMIES } from '../data/enemies';
import { SECTORS } from '../data/sectors';
import type { SectorId } from '../data/types';
import { GEM_CHEST, GEM_HEAL, GEM_MAGNET, GEM_XP } from '../game/entities';
import { EV } from '../game/events';
import { BK } from '../game/weapons';
import type { World } from '../game/World';
import { FxSystem } from './fx';
import { QuadLayer } from './layer';
import { buildAtlas, getAtlas, mix, TS, type Atlas } from './textures';

export type QualityLevel = 0 | 1 | 2; // low, medium, high

const DIRECTIONAL = new Set(['triangle', 'arrow', 'shardtri', 'stealth']);

/** Soft glow (or any radial sprite of native radius 15 world units at scale 1) with a world-space radius. */
function glow(l: QuadLayer, x: number, y: number, radius: number, color: number, alpha: number, tex?: Texture): void {
  const k = radius / 15 / TS;
  l.add(tex ?? getAtlas().tex.soft, x, y, k, k, 0, color, alpha);
}

/** Ring sprite whose drawn radius equals `radius` world units; `native` is the ring radius baked into the texture. */
function ring(l: QuadLayer, tex: Texture, native: number, x: number, y: number, radius: number, rot: number, color: number, alpha: number): void {
  const k = radius / native / TS;
  l.add(tex, x, y, k, k, rot, color, alpha);
}

export interface ViewFeedback {
  /** seconds of hit-stop requested by the last frame's events */
  hitStop: number;
  /** vibration pattern request (ms) */
  vibrate: number;
}

export class GameView {
  readonly app: Application;
  private atlas!: Atlas;
  private readonly root = new Container();
  private grid!: TilingSprite;
  private dust!: TilingSprite;
  private gemsL!: QuadLayer;
  private underL!: QuadLayer;
  private enemiesL!: QuadLayer;
  private ebulletsL!: QuadLayer;
  private bulletsL!: QuadLayer;
  private playerL!: QuadLayer;
  private fxL!: QuadLayer;
  private numsL!: QuadLayer;
  private flash!: Sprite;
  readonly fx = new FxSystem();

  private w = 1;
  private h = 1;
  zoom = 1;
  camX = 0;
  camY = 0;
  private trauma = 0;
  private flashA = 0;
  private flashColor = 0xffffff;
  private time = 0;
  private quality: QualityLevel = 2;
  private playerHitT = 0;
  readonly feedback: ViewFeedback = { hitStop: 0, vibrate: 0 };
  /** attract-mode decorative drifters for the menu */
  private readonly decor: { x: number; y: number; vx: number; vy: number; r: number; tex: string; rot: number; vr: number }[] = [];
  shakeEnabled = true;

  constructor(app: Application) {
    this.app = app;
  }

  init(): void {
    const enemyArt = Object.values(ENEMIES).map((e) => ({ id: e.id, shape: e.shape, color: e.color, r: e.r }));
    this.atlas = buildAtlas(enemyArt);
    const base = this.atlas.source;
    this.grid = new TilingSprite({ texture: this.atlas.grid, width: 16, height: 16 });
    this.dust = new TilingSprite({ texture: this.atlas.dust, width: 16, height: 16 });
    this.dust.alpha = 0.55;
    this.gemsL = new QuadLayer(base, 'add');
    this.underL = new QuadLayer(base, 'add');
    this.enemiesL = new QuadLayer(base, 'add');
    this.ebulletsL = new QuadLayer(base, 'add');
    this.bulletsL = new QuadLayer(base, 'add');
    this.playerL = new QuadLayer(base, 'add');
    this.fxL = new QuadLayer(base, 'add');
    this.numsL = new QuadLayer(base, 'normal');
    this.root.addChild(
      this.underL.pc,
      this.gemsL.pc,
      this.enemiesL.pc,
      this.bulletsL.pc,
      this.playerL.pc,
      this.ebulletsL.pc,
      this.fxL.pc,
      this.numsL.pc,
    );
    this.flash = new Sprite(this.atlas.tex.px);
    this.flash.alpha = 0;
    this.app.stage.addChild(this.dust, this.grid, this.root, this.flash);
    this.setSector('ram');
  }

  setSector(id: SectorId): void {
    const s = SECTORS[id];
    this.app.renderer.background.color = s.bg;
    this.grid.tint = s.grid;
    this.dust.tint = mix(s.accent, 0xffffff, 0.3);
  }

  setQuality(q: QualityLevel): void {
    this.quality = q;
    this.fx.q = [
      { maxParticles: 350, density: 0.45, numbers: true },
      { maxParticles: 800, density: 0.75, numbers: true },
      { maxParticles: 1500, density: 1, numbers: true },
    ][q];
    this.dust.visible = q > 0;
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    // small screens show less world (bigger sprites), large screens a bit more
    const area = clamp(w * h * 0.45, 400_000, 950_000);
    this.zoom = clamp(Math.sqrt((w * h) / area), 0.6, 2.2);
    this.grid.width = w;
    this.grid.height = h;
    this.dust.width = w;
    this.dust.height = h;
    this.flash.width = w;
    this.flash.height = h;
  }

  /** World-space half extents of the screen. */
  viewHalf(): { hw: number; hh: number } {
    return { hw: this.w / 2 / this.zoom, hh: this.h / 2 / this.zoom };
  }

  /** Screen shake is reserved for boss moments (spawn, phase change, kill) and the player's death. */
  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  flashScreen(color: number, a: number): void {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  resetRun(world: World): void {
    this.fx.clear();
    this.camX = world.player.x;
    this.camY = world.player.y;
    this.trauma = 0;
    this.flashA = 0;
    this.playerHitT = 0;
    this.setSector(world.cfg.sector);
  }

  // ---------------------------------------------------------------- events

  consume(world: World): void {
    const fx = this.fx;
    const evs = world.events;
    const fb = this.feedback;
    const p = world.player;
    for (let i = 0; i < evs.count; i++) {
      const e = evs.items[i];
      switch (e.type) {
        case EV.HIT:
          fx.number(e.x, e.y, e.a, e.b === 1, 0xffffff, e.c === 1);
          if (this.quality > 0 && Math.random() < 0.3) fx.burst(e.x, e.y + 8, 0xffe9b0, 1, 150, 0.45, 0.2);
          break;
        case EV.KILL: {
          const flags = e.c;
          const r = e.b;
          if (flags & 4) {
            fx.burst(e.x, e.y, e.a, 120, 700, 2.2, 1.4);
            fx.burst(e.x, e.y, 0xffffff, 50, 500, 1.6, 1.0);
            for (let k = 0; k < 4; k++) fx.ring(e.x, e.y, k % 2 ? 0xffffff : e.a, 260 + k * 120, 0.6 + k * 0.25);
            fx.flare(e.x, e.y, e.a, 200, 1.2, 200);
            this.addTrauma(0.55);
            this.flashScreen(0xffffff, 0.8);
            fb.hitStop = Math.max(fb.hitStop, 0.25);
            fb.vibrate = Math.max(fb.vibrate, 300);
          } else if (flags & 2) {
            fx.burst(e.x, e.y, e.a, 70, 520, 1.8, 1.0);
            fx.ring(e.x, e.y, e.a, 220, 0.6);
            fx.ring(e.x, e.y, 0xffffff, 140, 0.4, true);
            fx.flare(e.x, e.y, e.a, 120, 0.7, 80);
            this.addTrauma(0.35);
            this.flashScreen(e.a, 0.35);
            fb.hitStop = Math.max(fb.hitStop, 0.06);
            fb.vibrate = Math.max(fb.vibrate, 120);
          } else if (flags & 1) {
            fx.burst(e.x, e.y, e.a, 34, 380, 1.4, 0.8);
            fx.ring(e.x, e.y, e.a, 90, 0.4);
            fx.flare(e.x, e.y, e.a, 50, 0.35);
            fb.hitStop = Math.max(fb.hitStop, 0.045);
            fb.vibrate = Math.max(fb.vibrate, 40);
          } else {
            fx.burst(e.x, e.y, e.a, 6 + r * 0.35, 200 + r * 6, 0.7 + r * 0.03, 0.45);
            if (this.quality > 1) fx.flare(e.x, e.y, e.a, r * 1.8, 0.18);
          }
          break;
        }
        case EV.PLAYER_HIT:
          this.flashScreen(0xff2a55, 0.28);
          this.playerHitT = 0.25;
          fx.burst(p.x, p.y, 0xff2a55, 10, 260, 0.9, 0.4);
          fb.vibrate = Math.max(fb.vibrate, 60);
          break;
        case EV.GEM:
          if (this.quality > 0 && e.a > 0) fx.flare(p.x, p.y, [0x29a8ff, 0x6dff8a, 0xffd23d, 0xff3df2][e.a] ?? 0xffffff, 22, 0.2);
          break;
        case EV.LEVELUP:
          fx.ring(p.x, p.y, 0x29f6ff, 150, 0.5);
          fx.ring(p.x, p.y, 0xffffff, 90, 0.35, true);
          fx.burst(p.x, p.y, 0x29f6ff, 24, 320, 1, 0.6);
          this.flashScreen(0x29f6ff, 0.18);
          break;
        case EV.EXPLODE:
          fx.ring(e.x, e.y, e.b, e.a, 0.32);
          fx.flare(e.x, e.y, e.b, e.a * (e.a < 60 ? 0.5 : 0.8), e.a < 60 ? 0.16 : 0.25);
          fx.burst(e.x, e.y, e.b, 10 + e.a * 0.08, 140 + e.a * 2.5, 0.9, 0.45);
          break;
        case EV.BOLT:
          fx.bolt(e.ref as number[], e.a === 1 ? 0xd6f4ff : 0x8fd8ff, e.a === 1 ? 7 : 5);
          break;
        case EV.HEAL:
          for (let k = 0; k < 8; k++) fx.spawn(this.atlas.tex.shard, p.x + (Math.random() - 0.5) * 30, p.y + 10, 0, -60 - Math.random() * 60, 0.7, 0.8, 0x6dff8a, { drag: 1 });
          fx.text(p.x, p.y - 30, `+${Math.round(e.a)}`, 0x6dff8a);
          break;
        case EV.BOSS:
          this.addTrauma(0.35);
          this.flashScreen(e.a === 1 ? 0xff2a55 : 0xff9a3d, 0.35);
          fb.vibrate = Math.max(fb.vibrate, 200);
          break;
        case EV.TELEPORT:
          fx.burst(e.x, e.y, e.c, 8, 200, 0.7, 0.35);
          fx.burst(e.a, e.b, e.c, 8, 200, 0.7, 0.35);
          fx.ring(e.a, e.b, e.c, 40, 0.25, true);
          break;
        case EV.SHIELD_HIT:
          if (e.b === 1) {
            fx.ring(e.x, e.y, 0x3d7bff, e.c * 2.4, 0.3, true);
            fx.burst(e.x, e.y, 0x7da8ff, 12, 260, 0.8, 0.4);
          } else if (Math.random() < 0.4) fx.burst(e.x, e.y, 0x7da8ff, 2, 180, 0.5, 0.25);
          break;
        case EV.CHEST:
          fx.burst(e.x, e.y, 0xffd23d, 40, 420, 1.3, 0.9);
          fx.ring(e.x, e.y, 0xffd23d, 160, 0.5);
          this.flashScreen(0xffd23d, 0.3);
          break;
        case EV.EVOLVE:
          fx.ring(p.x, p.y, e.a, 260, 0.7);
          fx.ring(p.x, p.y, 0xffffff, 180, 0.5, true);
          fx.burst(p.x, p.y, e.a, 60, 520, 1.4, 0.9);
          this.flashScreen(0xffffff, 0.55);
          fb.vibrate = Math.max(fb.vibrate, 150);
          break;
        case EV.MAGNET:
          fx.ring(p.x, p.y, 0x29a8ff, 600, 0.7);
          this.flashScreen(0x29a8ff, 0.2);
          break;
        case EV.HEAL_PULSE:
          fx.ring(e.x, e.y, 0x3dff6e, e.a, 0.45, true);
          break;
        case EV.ENEMY_SHOOT:
          fx.flare(e.x, e.y, e.a, 22, 0.15);
          break;
        case EV.DASH:
          fx.burst(e.x, e.y, e.a, 8, 220, 0.8, 0.35);
          break;
        case EV.BOSS_PHASE:
          fx.ring(e.x, e.y, e.b, 300, 0.6);
          fx.burst(e.x, e.y, e.b, 40, 450, 1.4, 0.8);
          this.addTrauma(0.3);
          this.flashScreen(e.b, 0.3);
          fb.vibrate = Math.max(fb.vibrate, 150);
          break;
        case EV.REVIVE:
          fx.ring(p.x, p.y, 0x29f6ff, e.a, 0.7);
          fx.ring(p.x, p.y, 0xffffff, e.a * 0.7, 0.5, true);
          fx.burst(p.x, p.y, 0x29f6ff, 60, 500, 1.4, 1);
          this.flashScreen(0x29f6ff, 0.6);
          break;
        case EV.PICKUP:
          fx.flare(e.x, e.y, 0x6dff8a, 40, 0.3);
          break;
        case EV.SPLIT:
          fx.ring(e.x, e.y, e.a, 40, 0.25, true);
          break;
        default:
          break;
      }
    }
  }

  // ---------------------------------------------------------------- frame

  private beginLayers(): void {
    this.gemsL.begin();
    this.underL.begin();
    this.enemiesL.begin();
    this.ebulletsL.begin();
    this.bulletsL.begin();
    this.playerL.begin();
    this.fxL.begin();
    this.numsL.begin();
  }

  private endLayers(): void {
    this.gemsL.end();
    this.underL.end();
    this.enemiesL.end();
    this.ebulletsL.end();
    this.bulletsL.end();
    this.playerL.end();
    this.fxL.end();
    this.numsL.end();
  }

  /** Applies camera transform, shake and screen flash. */
  private applyCamera(dt: number, parallax = true): void {
    let sx = 0;
    let sy = 0;
    if (this.trauma > 0) {
      const s = this.shakeEnabled ? this.trauma * this.trauma * 9 : 0;
      sx = (Math.random() * 2 - 1) * s;
      sy = (Math.random() * 2 - 1) * s;
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
    const z = this.zoom;
    this.root.scale.set(z);
    this.root.position.set(this.w / 2 - this.camX * z + sx, this.h / 2 - this.camY * z + sy);
    this.grid.tileScale.set(z);
    this.grid.tilePosition.set(this.w / 2 - this.camX * z + sx, this.h / 2 - this.camY * z + sy);
    if (parallax) {
      this.dust.tileScale.set(z);
      this.dust.tilePosition.set(this.w / 2 - this.camX * z * 0.55, this.h / 2 - this.camY * z * 0.55);
    }
    this.grid.alpha = 0.55 + Math.sin(this.time * 0.8) * 0.06;
    if (this.flashA > 0) {
      this.flash.tint = this.flashColor;
      this.flash.alpha = this.flashA;
      this.flashA = Math.max(0, this.flashA - dt * 2.6);
    } else this.flash.alpha = 0;
  }

  render(world: World, dt: number): void {
    this.time += dt;
    const p = world.player;
    // camera follows with a slight lead in the movement direction
    const k = damp(7, dt);
    this.camX += (p.x + p.vx * 0.18 - this.camX) * k;
    this.camY += (p.y + p.vy * 0.18 - this.camY) * k;
    const vh = this.viewHalf();
    world.view.hw = vh.hw;
    world.view.hh = vh.hh;
    this.fx.update(dt);
    this.beginLayers();
    this.drawWorld(world);
    this.fx.draw(this.fxL, this.numsL, this.zoom);
    this.endLayers();
    this.applyCamera(dt);
  }

  private drawWorld(world: World): void {
    const t = this.atlas.tex;
    const inv = 1 / TS;
    const time = this.time;
    const vh = this.viewHalf();
    const cx = this.camX;
    const cy = this.camY;
    const cullX = vh.hw + 120;
    const cullY = vh.hh + 120;
    const visible = (x: number, y: number, r: number) => Math.abs(x - cx) < cullX + r && Math.abs(y - cy) < cullY + r;

    // ---- gems / pickups
    for (const g of world.gems) {
      if (!g.alive || !visible(g.x, g.y, 20)) continue;
      const bob = 1 + Math.sin(time * 5 + g.x * 0.05) * 0.08;
      if (g.kind === GEM_XP) {
        this.gemsL.add(t[`gem${g.tier}`], g.x, g.y, inv * bob, inv * bob, Math.sin(time * 2 + g.y) * 0.3, 0xffffff, 1);
      } else if (g.kind === GEM_HEAL) {
        glow(this.gemsL, g.x, g.y, 22, 0x3dff6e, 0.45);
        this.gemsL.add(t.heal, g.x, g.y, inv * bob, inv * bob, 0, 0xffffff, 1);
      } else if (g.kind === GEM_MAGNET) {
        glow(this.gemsL, g.x, g.y, 24, 0x29a8ff, 0.5);
        this.gemsL.add(t.magnet, g.x, g.y, inv * bob, inv * bob, Math.sin(time * 3) * 0.3, 0xffffff, 1);
      } else if (g.kind === GEM_CHEST) {
        glow(this.gemsL, g.x, g.y, 52 * bob, 0xffb52e, 0.55);
        this.gemsL.add(t.thinring, g.x, g.y, inv * 1.3, inv * 1.3, time, 0xffd23d, 0.6 + Math.sin(time * 6) * 0.3);
        this.gemsL.add(t.chest, g.x, g.y, inv * bob, inv * bob, Math.sin(time * 2) * 0.2, 0xffffff, 1);
      }
    }

    // ---- mines, rings (under enemies)
    for (const m of world.mines) {
      if (!m.alive) continue;
      const armed = m.arm <= 0;
      const blink = armed ? 0.65 + Math.sin(m.t * 14) * 0.35 : 0.35;
      glow(this.underL, m.x, m.y, 20, 0xffd23d, 0.4 * blink);
      this.underL.add(t.mine, m.x, m.y, inv * (m.evo ? 1.25 : 1), inv * (m.evo ? 1.25 : 1), m.t * 2, m.evo ? 0xfff6b0 : 0xffffff, blink);
    }
    for (const g of world.rings) {
      if (!g.alive) continue;
      const f = g.t / g.dur;
      ring(this.underL, t.ring, 58, g.x, g.y, g.r, 0, g.color, (1 - f) * 0.9);
      if (this.quality > 0) ring(this.underL, t.thinring, 28, g.x, g.y, g.r * 0.92, 0, 0xffffff, (1 - f) * 0.5);
    }

    // ---- enemies
    for (const e of world.enemies) {
      if (!e.alive || !visible(e.x, e.y, e.r * 2)) continue;
      const def = e.def;
      const sp = e.spawnT < 1 ? easeOutBack(e.spawnT) : 1;
      const scale = (e.r / def.r) * sp * inv;
      // hit flash is an overlay (not a texture swap) so dense fights do not wash out to white
      const big = !!def.boss;
      const tex = t[`e_${def.id}`];
      const rot = DIRECTIONAL.has(def.shape) ? e.ang : e.ang;
      const alpha = e.alpha * (e.spawnT < 1 ? 0.3 + e.spawnT * 0.7 : 1);
      if (def.boss) this.drawBossExtras(e.x, e.y, e.r, def.color, e.state, def.boss === 'final');
      if (e.elite) {
        glow(this.enemiesL, e.x, e.y, e.r * 2.6, def.color, 0.4 + Math.sin(time * 6 + e.uid) * 0.12);
      }
      this.enemiesL.add(tex, e.x, e.y, scale, scale, rot, 0xffffff, alpha);
      if (e.flash > 0) this.enemiesL.add(t[`e_${def.id}_f`], e.x, e.y, scale, scale, rot, 0xffffff, big ? 0.22 : 0.55 * alpha);
      // AI telegraphs
      if (def.ai === 'dash' && e.state === 1) {
        this.enemiesL.add(t.beam, e.x, e.y, 210 / 32, 10 / (24 * TS), Math.atan2(e.ty, e.tx), def.color, 0.25 + (1 - e.t / 0.6) * 0.4, 0, 0.5);
      } else if (def.ai === 'bomber' && e.state === 1) {
        ring(this.enemiesL, t.thinring, 28, e.x, e.y, def.p?.radius ?? 80, 0, 0xff2a55, 0.35 + Math.sin(time * 30) * 0.25);
      } else if (def.ai === 'teleport' && e.state === 1) {
        glow(this.enemiesL, e.tx, e.ty, 24, def.color, 0.5);
        this.enemiesL.add(tex, e.tx, e.ty, scale * 0.8, scale * 0.8, rot, 0xffffff, 0.35);
      } else if (def.ai === 'heal') {
        glow(this.enemiesL, e.x, e.y, 34, 0x3dff6e, 0.22);
      }
      if (e.maxShield > 0 && e.shield > 0) {
        ring(this.enemiesL, t.thinring, 28, e.x, e.y, e.r * 1.45, 0, 0x5d8bff, 0.35 + 0.55 * (e.shield / e.maxShield));
      }
      if (e.elite && e.hp < e.maxHp) {
        const bw = e.r * 2;
        const by = e.y - e.r - 10;
        this.enemiesL.add(t.px, e.x - bw / 2, by, bw / 8, 3 / 8, 0, 0x331133, 0.8, 0, 0.5);
        this.enemiesL.add(t.px, e.x - bw / 2, by, ((e.hp / e.maxHp) * bw) / 8, 3 / 8, 0, def.color, 1, 0, 0.5);
      }
    }

    // ---- enemy bullets
    for (const b of world.ebullets) {
      if (!b.alive || !visible(b.x, b.y, 10)) continue;
      const s = (b.r / 11) * inv * 2;
      this.ebulletsL.add(t.ebullet, b.x, b.y, s * 1.5, s * 1.5, 0, b.color, 0.9);
      this.ebulletsL.add(t.ebullet, b.x, b.y, s * 0.7, s * 0.7, 0, 0xffffff, 1);
    }

    // ---- player projectiles
    for (const b of world.bullets) {
      if (!b.alive || !visible(b.x, b.y, 20)) continue;
      const ang = Math.atan2(b.vy, b.vx);
      switch (b.kind) {
        case BK.PULSE: {
          const s = (b.r / 6) * inv;
          this.bulletsL.add(t.bolt, b.x, b.y, s, s, ang, 0xffffff, 1);
          break;
        }
        case BK.PULSE_EVO: {
          const s = (b.r / 7) * inv;
          this.bulletsL.add(t.bolt_evo, b.x, b.y, s, s, ang, 0xffffff, 1);
          break;
        }
        case BK.DRONE:
        case BK.DRONE_EVO: {
          const s = (b.r / 5) * inv;
          this.bulletsL.add(t.dbolt, b.x, b.y, s, s, ang, b.kind === BK.DRONE_EVO ? 0xd0d6ff : 0xffffff, 1);
          break;
        }
        case BK.MISSILE:
        case BK.MISSILE_EVO: {
          this.bulletsL.add(t.missile, b.x, b.y, inv, inv, ang, b.kind === BK.MISSILE_EVO ? 0xffd9a8 : 0xffffff, 1);
          if (Math.random() < (this.quality === 2 ? 0.9 : 0.45)) {
            this.fx.spawn(t.soft, b.x - Math.cos(ang) * 8, b.y - Math.sin(ang) * 8, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3, 0.35, 0xff9a3d, { drag: 2 });
          }
          break;
        }
      }
    }
    for (let i = 0; i < world.blades.count; i++) {
      const b = world.blades.items[i];
      const s = (b.r / (b.evo ? 14 : 12)) * inv;
      glow(this.bulletsL, b.x, b.y, b.r * 1.8, b.evo ? 0xff7df7 : 0xff3df2, 0.4);
      this.bulletsL.add(b.evo ? t.blade_evo : t.blade, b.x, b.y, s, s, time * 9, 0xffffff, 1);
    }
    for (let i = 0; i < world.drones.count; i++) {
      const d = world.drones.items[i];
      glow(this.bulletsL, d.x, d.y, 18, 0x7d8cff, 0.35);
      this.bulletsL.add(d.evo ? t.drone_evo : t.drone, d.x, d.y, inv, inv, d.ang, 0xffffff, 1);
    }
    for (let i = 0; i < world.beams.count; i++) {
      const b = world.beams.items[i];
      const fade = b.evo ? 1 : Math.min(1, b.life / 0.15, (b.max - b.life) / 0.08 + 0.2);
      const flicker = 0.85 + Math.random() * 0.15;
      const col = b.evo ? 0xff9ab0 : 0xff4d6d;
      const core = b.evo ? 0.55 : 1;
      this.bulletsL.add(t.beam, b.x, b.y, b.len / 32, (b.width * (b.evo ? 2 : 2.6) * flicker) / (24 * TS), b.ang, col, (b.evo ? 0.7 : 0.9) * fade, 0, 0.5);
      this.bulletsL.add(t.beam, b.x, b.y, b.len / 32, (b.width * 0.8 * core) / (24 * TS), b.ang, 0xffffff, fade * core, 0, 0.5);
      glow(this.bulletsL, b.x + Math.cos(b.ang) * 14, b.y + Math.sin(b.ang) * 14, 22, col, 0.7 * fade);
    }

    // ---- player
    this.drawPlayer(world);
  }

  private drawBossExtras(x: number, y: number, r: number, color: number, phase: number, final: boolean): void {
    const t = this.atlas.tex;
    const time = this.time;
    const c = final ? [color, 0xff9a3d, 0xff2a55][phase] ?? color : color;
    glow(this.enemiesL, x, y, r * 2.6, c, 0.45 + Math.sin(time * 4) * 0.1);
    const rr = r * 1.35;
    ring(this.enemiesL, t.thinring, 28, x, y, rr, time, c, 0.6);
    if (final) {
      const pulse = 1 + Math.sin(time * (3 + phase * 2)) * 0.15;
      glow(this.enemiesL, x, y, r * 0.55 * pulse, c, 0.9, t.orb);
      const r2 = r * 1.8 + Math.sin(time * 2) * 6;
      ring(this.enemiesL, t.thinring, 28, x, y, r2, -time, 0xffffff, 0.25);
    }
  }

  private drawPlayer(world: World): void {
    const t = this.atlas.tex;
    const p = world.player;
    const inv = 1 / TS;
    const time = this.time;
    if (world.state === 'dead') return;
    const blink = p.inv > 0 && world.t > 1.2 ? (Math.sin(time * 40) > 0 ? 1 : 0.35) : 1;
    const hit = this.playerHitT > 0;
    if (this.playerHitT > 0) this.playerHitT -= 1 / 60;
    const core = hit ? 0xff6b8a : 0xffffff;
    glow(this.playerL, p.x, p.y, 52, hit ? 0xff2a55 : 0x29f6ff, 0.5 * blink);
    this.playerL.add(t.player_ring, p.x, p.y, inv, inv, time * 1.5, 0xffffff, 0.75 * blink);
    const pulse = 1 + Math.sin(time * 6) * 0.05;
    this.playerL.add(t.player, p.x, p.y, inv * pulse, inv * pulse, time * 0.8, core, blink);
    if (p.moving) {
      const d = 30;
      this.playerL.add(t.chevron, p.x + Math.cos(p.face) * d, p.y + Math.sin(p.face) * d, inv, inv, p.face, 0x29f6ff, 0.8);
    }
    // engine trail
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 40 && Math.random() < (this.quality === 0 ? 0.3 : 0.8)) {
      this.fx.spawn(t.soft, p.x - (p.vx / sp) * 10, p.y - (p.vy / sp) * 10, -p.vx * 0.2 + (Math.random() - 0.5) * 20, -p.vy * 0.2 + (Math.random() - 0.5) * 20, 0.4, 0.55, 0x29f6ff, { drag: 2 });
    }
    // HP bar under the player
    const bw = 34;
    const frac = clamp(p.hp / world.stats.maxHp, 0, 1);
    const by = p.y + 26;
    this.playerL.add(t.px, p.x - bw / 2, by, bw / 8, 4 / 8, 0, 0x2a0a20, 0.9, 0, 0.5);
    this.playerL.add(t.px, p.x - bw / 2, by, (bw * frac) / 8, 4 / 8, 0, frac < 0.3 ? 0xff2a55 : 0x6dff8a, 1, 0, 0.5);
  }

  // ---------------------------------------------------------------- menu attract mode

  renderAttract(dt: number): void {
    this.time += dt;
    this.camX += dt * 22;
    this.camY += dt * -14;
    const t = this.atlas.tex;
    const vh = this.viewHalf();
    const keys = ['e_byte', 'e_worm', 'e_trojan', 'e_dasher', 'e_spammer', 'e_splitter', 'e_shielded', 'e_glitch', 'e_medic', 'e_nano', 'e_bomber'];
    while (this.decor.length < 26) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(vh.hw, vh.hh) * (0.3 + Math.random() * 1.1);
      this.decor.push({
        x: this.camX + Math.cos(a) * r,
        y: this.camY + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        r: 0.8 + Math.random() * 0.8,
        tex: keys[Math.floor(Math.random() * keys.length)],
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 1.5,
      });
    }
    this.fx.update(dt);
    this.beginLayers();
    for (let i = this.decor.length - 1; i >= 0; i--) {
      const d = this.decor[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (Math.abs(d.x - this.camX) > vh.hw * 2 + 200 || Math.abs(d.y - this.camY) > vh.hh * 2 + 200) {
        this.decor.splice(i, 1);
        continue;
      }
      const tex: Texture = t[d.tex];
      this.enemiesL.add(tex, d.x, d.y, d.r / TS, d.r / TS, d.rot, 0xffffff, 0.55);
    }
    if (Math.random() < dt * 1.2) {
      const x = this.camX + (Math.random() - 0.5) * vh.hw * 2;
      const y = this.camY + (Math.random() - 0.5) * vh.hh * 2;
      const c = [0x29f6ff, 0xff3df2, 0xffd23d, 0x6dff8a][Math.floor(Math.random() * 4)];
      this.fx.burst(x, y, c, 14, 240, 0.9, 0.8);
      this.fx.ring(x, y, c, 70, 0.5, true);
    }
    this.fx.draw(this.fxL, this.numsL, this.zoom);
    this.endLayers();
    this.applyCamera(dt);
  }

  clearAttract(): void {
    this.decor.length = 0;
  }

  /** Statistics for the adaptive quality controller and debug overlay. */
  stats(): { particles: number } {
    return { particles: this.fx.count };
  }

  getAtlas(): Atlas {
    return getAtlas();
  }
}
