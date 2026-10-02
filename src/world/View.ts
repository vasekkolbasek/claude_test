import * as THREE from 'three';
import type { Game } from '../systems/Game';
import { EntityView } from './entityView';
import { Fx } from './fx';
import type { Stage } from './stage';
import { TerrainView } from './terrainView';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

const IMPACT_COLORS: Record<string, number> = {
  orb: 0xc59bff, frost: 0x9fe3ff, fire: 0xff8a3c, hex: 0x8dff8a, star: 0xfff2a8, rock: 0xa9a3b5, arrow: 0xe8dcc0, bolt: 0xe8dcc0, dart: 0xd9b8ff,
};

/** Visual representation of one Game: owns terrain, entities and effects, reacts to sim events. */
export class View {
  readonly terrain: TerrainView;
  readonly entities: EntityView;
  readonly fx: Fx;
  private offs: (() => void)[] = [];
  private onQuality = (q: string) => this.terrain.setTreeShadows(q === 'high');
  /** When true the camera slowly orbits the castle (menu background). */
  showcase = false;
  private orbit = 0;
  private ambientT = 0;

  constructor(private stage: Stage, private g: Game, material: THREE.Material) {
    stage.setPalette(g.map.palette);
    this.terrain = new TerrainView(g.map, g.hf, material);
    this.entities = new EntityView(g, material);
    this.fx = new Fx(material);
    stage.scene.add(this.terrain.group, this.entities.group, this.fx.group);
    this.bind();
    stage.follow(g.hero.x, 0, g.hero.z, 0, true);
    this.terrain.setTreeShadows(stage.quality === 'high');
    stage.qualityListeners.add(this.onQuality);
  }

  private h(x: number, z: number): number { return this.g.heightAt(x, z); }

  private bind(): void {
    const g = this.g, fx = this.fx, ev = g.events;
    this.offs.push(
      ev.on('coinIn', ({ b }) => {
        _v.set(g.hero.x, this.h(g.hero.x, g.hero.z) + 2.4, g.hero.z);
        _w.set(b.x, this.h(b.x, b.z) + 1.2, b.z);
        fx.coin(_v, _w, 0, undefined, 0.32);
      }),
      ev.on('built', ({ b }) => {
        const y = this.h(b.x, b.z);
        fx.dust(b.x, y, b.z, b.radius + 0.4, 18);
        fx.burst(b.x, y + 1.5, b.z, 16, { color: 0xffe08a, speed: 3, up: 4, life: 0.7, size: 0.16, grav: 6, glow: true });
        fx.ring(b.x, y, b.z, b.radius + 1.8, 0xffe9a8, 0.55);
        fx.addShake(0.12);
      }),
      ev.on('income', ({ parts }) => {
        let k = 0;
        for (const p of parts) {
          const n = Math.min(5, p.n);
          for (let i = 0; i < n; i++) {
            _v.set(p.b.x, this.h(p.b.x, p.b.z) + 2, p.b.z);
            _w.set(g.hero.x, this.h(g.hero.x, g.hero.z) + 2.4, g.hero.z);
            fx.coin(_v, _w, 0.4 + k * 0.06 + i * 0.08, undefined, 0.6);
          }
          k++;
        }
      }),
      ev.on('spawn', ({ u }) => {
        if (u.team === 1) fx.burst(u.x, this.h(u.x, u.z) + 0.3, u.z, 3, { color: 0x4a3c80, speed: 0.8, up: 0.8, life: 0.7, size: 0.35, grav: -0.6, drag: 0.2, grow: 1.2, spread: 0.8, glow: true });
      }),
      ev.on('death', ({ u }) => {
        const y = this.h(u.x, u.z) + (u.def.flying ? 1.7 : 0);
        if (u.team === 1) {
          fx.mist(u.x, y, u.z, u.def.boss ? 3 : u.def.big ? 1.8 : 1);
          if (u.def.boss) { fx.addShake(0.9); fx.ring(u.x, y, u.z, 7, 0xd9c8ff, 0.9); }
        } else fx.burst(u.x, y + 0.5, u.z, 8, { color: 0xb8c4dc, speed: 1.6, up: 1.5, life: 0.6, size: 0.2, grav: -1, grow: 1.2 });
      }),
      ev.on('impact', ({ x, z, kind, splash }) => {
        const y = this.h(x, z) + 0.6;
        const c = IMPACT_COLORS[kind] ?? 0xffffff;
        if (kind === 'arrow' || kind === 'bolt' || kind === 'dart') {
          if (Math.random() < 0.5) fx.burst(x, y, z, 2, { color: 0xe9dcc2, speed: 1.2, up: 1, life: 0.3, size: 0.1, grav: 6 });
        } else {
          fx.burst(x, y, z, splash > 0 ? 10 : 5, { color: c, speed: 3 + splash, up: 2.5, life: 0.45, size: 0.15, grav: 4, glow: true });
          if (kind === 'fire') fx.burst(x, y, z, 4, { color: 0x5a5060, speed: 1, up: 1.4, life: 0.8, size: 0.35, grav: -1, grow: 1.4 });
        }
        if (splash > 0) fx.ring(x, y - 0.5, z, splash, c, 0.35);
      }),
      ev.on('melee', ({ x, z, team }) => {
        if (Math.random() < 0.6) fx.burst(x, this.h(x, z) + 0.8, z, 3, { color: team === 0 ? 0xfff2c0 : 0xd9b8ff, speed: 2.5, up: 2, life: 0.25, size: 0.1, grav: 5, glow: true });
      }),
      ev.on('hit', ({ e }) => {
        if (e.ent === 'b' && Math.random() < 0.35) fx.burst(e.x, this.h(e.x, e.z) + 1.5, e.z, 2, { color: 0xd9cfbf, speed: 2, up: 2, life: 0.5, size: 0.14, grav: 9 });
        if (e.ent === 'h') fx.addShake(0.06);
      }),
      ev.on('bdestroyed', ({ b }) => {
        const y = this.h(b.x, b.z);
        fx.burst(b.x, y + 1.5, b.z, 26, { color: 0xd9cfbf, speed: 5, up: 6, life: 1.1, size: 0.35, grav: 14, spread: b.radius });
        fx.burst(b.x, y + 1.2, b.z, 10, { color: 0x8a6a4a, speed: 4, up: 5, life: 1.0, size: 0.3, grav: 14, spread: b.radius });
        fx.dust(b.x, y, b.z, b.radius + 0.6, 20);
        fx.addShake(b.kind === 'castle' ? 1.2 : 0.45);
      }),
      ev.on('repaired', ({ b }) => {
        fx.burst(b.x, this.h(b.x, b.z) + 1, b.z, 10, { color: 0xbff0a8, speed: 2, up: 3, life: 0.8, size: 0.14, grav: 2, glow: true });
      }),
      ev.on('ability', ({ kind, x, z, r }) => {
        const y = this.h(x, z);
        const c = kind === 'whirl' ? 0xffffff : kind === 'volley' ? 0xffe9a8 : kind === 'charge' ? 0xffd27a : 0xfff2a8;
        fx.ring(x, y, z, r, c, 0.45);
        fx.burst(x, y + 1, z, 18, { color: c, speed: r * 2, up: 2, life: 0.5, size: 0.14, grav: 3, glow: true });
        if (kind === 'starfall') fx.ring(x, y, z, r * 0.6, 0xbff0a8, 0.6);
        fx.addShake(0.25);
      }),
      ev.on('heroDeath', () => {
        const h = g.hero;
        fx.burst(h.x, this.h(h.x, h.z) + 1.2, h.z, 24, { color: 0xffe9a8, speed: 3, up: 3, life: 1, size: 0.2, grav: 2, glow: true });
        fx.addShake(0.5);
      }),
      ev.on('heroRespawn', () => {
        const h = g.hero;
        for (let i = 0; i < 4; i++) fx.burst(h.x, this.h(h.x, h.z) + i * 0.8, h.z, 6, { color: 0xffe08a, speed: 1.2, up: 3, life: 0.8, size: 0.14, grav: -1, glow: true });
        fx.ring(h.x, this.h(h.x, h.z), h.z, 2.5, 0xffe08a, 0.6);
      }),
      ev.on('bossSpawn', ({ u }) => {
        fx.addShake(0.9);
        fx.ring(u.x, this.h(u.x, u.z), u.z, 6, 0xb08bff, 0.9);
      }),
    );
  }

  update(dt: number, time: number): void {
    const g = this.g, st = this.stage;
    st.dayTarget = g.phase === 'night' || g.phase === 'defeat' ? 0 : 1;
    if (this.showcase) {
      this.orbit += dt * 0.05;
      st.follow(Math.sin(this.orbit) * 3, 0, Math.cos(this.orbit) * 3, dt);
      st.zoom = 0.82;
    } else {
      const h = g.hero;
      // Lead the camera slightly in the direction of movement.
      const lead = h.moving ? 2.2 : 0;
      st.follow(h.x + Math.sin(h.facing) * lead, 0, h.z + Math.cos(h.facing) * lead, dt);
      const zt = g.phase === 'night' ? 1.12 : 1;
      st.zoom += (zt - st.zoom) * Math.min(1, dt * 1.5);
    }
    this.terrain.updateRibbons(g.phase === 'day' && !this.showcase ? g.plan.paths : null, dt);
    this.entities.highlight = g.activeSlot();
    // Ambient life: fireflies at night, drifting pollen by day.
    this.ambientT += dt;
    const night = 1 - st.dayness;
    const rate = night > 0.5 ? 0.12 : 0.3;
    while (this.ambientT > rate) {
      this.ambientT -= rate;
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 26;
      const x = st.target.x + Math.cos(a) * r, z = st.target.z + Math.sin(a) * r;
      const y = Math.max(this.h(x, z), 0) + 0.6 + Math.random() * 2;
      if (night > 0.5) this.fx.burst(x, y, z, 1, { color: 0xd8ff7a, speed: 0.4, up: 0.25, life: 2.6, size: 0.15, grav: -0.05, drag: 0.8, glow: true });
      else this.fx.burst(x, y, z, 1, { color: 0xfffbe8, speed: 0.6, up: 0.1, life: 2.2, size: 0.05, grav: 0.05, drag: 0.9, glow: true });
    }
    this.entities.update(dt, time, st.camera);
    this.fx.update(dt);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.stage.qualityListeners.delete(this.onQuality);
    this.stage.scene.remove(this.terrain.group, this.entities.group, this.fx.group);
    this.terrain.dispose();
    this.entities.dispose();
    this.fx.dispose();
  }
}
