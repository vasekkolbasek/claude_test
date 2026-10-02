import * as THREE from 'three';
import type { ProjKind } from '../data/buildings';
import { UNIT_IDS, type UnitId } from '../data/units';
import type { Building } from '../entities/entities';
import type { Game } from '../systems/Game';
import { buildHero, buildingGeometry, projectileGeometry, rubbleGeometry, unitGeometry, weaponGeometry, type HeroRig } from './models';

const PROJ_KINDS: ProjKind[] = ['arrow', 'bolt', 'orb', 'frost', 'fire', 'dart', 'hex', 'rock', 'star'];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _right = new THREE.Vector3();

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

interface BView { mesh: THREE.Mesh; key: string; marker: THREE.Group; markerMat: THREE.MeshBasicMaterial; discMat: THREE.MeshBasicMaterial; pulse: number }

/** Renders buildings, slot markers, units (instanced), projectiles, health bars and the hero. */
export class EntityView {
  readonly group = new THREE.Group();
  private bviews = new Map<Building, BView>();
  private unitMeshes = new Map<UnitId, THREE.InstancedMesh>();
  private projMeshes = new Map<ProjKind, THREE.InstancedMesh>();
  private bars: THREE.InstancedMesh;
  private barCount = 0;
  private ringGeo = new THREE.RingGeometry(0.9, 1.0, 48);
  private discGeo = new THREE.CircleGeometry(1, 40);
  private lineGeo = new THREE.PlaneGeometry(1, 0.22);
  hero: HeroRig;
  private heroShadow: THREE.Mesh;
  private disposables: { dispose(): void }[] = [];
  highlight: Building | null = null;

  constructor(private g: Game, private material: THREE.Material) {
    for (const id of UNIT_IDS) {
      const boss = id.startsWith('boss');
      const ally = ['militia', 'spearman', 'swordsman', 'bowman', 'crossbowman'].includes(id);
      const cap = boss ? 6 : ally ? 90 : id === 'grunt' || id === 'runner' ? 220 : 140;
      const mesh = new THREE.InstancedMesh(unitGeometry(id), material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, _c.setRGB(1, 1, 1));
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.unitMeshes.set(id, mesh);
      this.group.add(mesh);
      this.disposables.push(mesh);
    }
    for (const k of PROJ_KINDS) {
      const mesh = new THREE.InstancedMesh(projectileGeometry(k), material, 160);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.projMeshes.set(k, mesh);
      this.group.add(mesh);
      this.disposables.push(mesh);
    }
    const barGeo = new THREE.PlaneGeometry(1, 1);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true });
    this.bars = new THREE.InstancedMesh(barGeo, barMat, 700);
    this.bars.setColorAt(0, _c.setRGB(1, 1, 1));
    this.bars.frustumCulled = false;
    this.bars.renderOrder = 20;
    this.bars.count = 0;
    this.group.add(this.bars);
    this.disposables.push(barGeo, barMat, this.bars, this.ringGeo, this.discGeo, this.lineGeo);

    this.hero = buildHero(material, g.hero.weapon.id);
    this.group.add(this.hero.root);
    const shGeo = new THREE.CircleGeometry(0.9, 24);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.35, depthWrite: false });
    this.heroShadow = new THREE.Mesh(shGeo, shMat);
    this.group.add(this.heroShadow);
    this.disposables.push(shGeo, shMat);

    for (const b of g.buildings) this.createBView(b);
  }

  setWeapon(id: string): void {
    const m = this.hero.weapon.children[0] as THREE.Mesh;
    m.geometry = weaponGeometry(id);
  }

  private createBView(b: Building): void {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    const h = this.g.heightAt(b.x, b.z);
    mesh.position.set(b.x, h, b.z);
    if (b.wall) mesh.rotation.y = Math.atan2(-(b.wall.bz - b.wall.az), b.wall.bx - b.wall.ax);
    else if (b.kind === 'castle') mesh.rotation.y = Math.PI / 4;
    else mesh.rotation.y = Math.atan2(b.rallyX - b.x, b.rallyZ - b.z);
    this.group.add(mesh);
    // Slot marker
    const marker = new THREE.Group();
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, depthWrite: false });
    const discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
    const r = b.wall ? 1.3 : b.radius + 0.25;
    const ring = new THREE.Mesh(this.ringGeo, markerMat);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(r);
    const disc = new THREE.Mesh(this.discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.scale.setScalar(r * 0.9);
    marker.add(disc, ring);
    if (b.wall) {
      const len = Math.hypot(b.wall.bx - b.wall.ax, b.wall.bz - b.wall.az);
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const dash = new THREE.Mesh(this.lineGeo, markerMat);
        dash.rotation.x = -Math.PI / 2;
        dash.scale.set(len / 7, 1, 1);
        dash.position.x = (i / 2.5) * (len / 2);
        marker.add(dash);
      }
      marker.rotation.y = mesh.rotation.y;
    }
    marker.position.set(b.x, Math.max(h, 0.05) + 0.06, b.z);
    marker.renderOrder = 3;
    this.group.add(marker);
    this.disposables.push(markerMat, discMat);
    this.bviews.set(b, { mesh, key: '', marker, markerMat, discMat, pulse: Math.random() * 6 });
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const g = this.g;
    camera.getWorldQuaternion(_q);
    _right.set(1, 0, 0).applyQuaternion(_q);
    this.barCount = 0;
    this.barQ.copy(_q);

    // Buildings & markers
    const showMarkers = g.phase === 'day';
    for (const [b, v] of this.bviews) {
      const key = b.node ? (b.ruined ? `ruin:${b.kind}` : `${b.kind}:${b.node.look}:${b.node.tier}`) : '';
      if (key !== v.key) {
        v.key = key;
        if (!b.node) v.mesh.visible = false;
        else {
          v.mesh.geometry = b.ruined ? rubbleGeometry(b.radius, b.id) : buildingGeometry(b.kind, b.node.look, b.node.tier);
          v.mesh.visible = true;
        }
      }
      if (b.node) {
        const t = b.builtT;
        let sy = 1, sxz = 1;
        if (t < 0.7 && !b.ruined) { const k = Math.min(1, t / 0.7); sy = Math.max(0.02, easeOutBack(k)); sxz = 0.75 + 0.25 * Math.min(1, k * 1.5); }
        let ox = 0, oz = 0;
        if (b.hitT < 0.15 && !b.ruined) { ox = (Math.random() - 0.5) * 0.12; oz = (Math.random() - 0.5) * 0.12; }
        const h = g.heightAt(b.x, b.z);
        v.mesh.position.set(b.x + ox, h, b.z + oz);
        v.mesh.scale.set(sxz, sy, sxz);
        if (b.alive && b.hp < b.maxHp) this.addBar(b.x, h + (b.kind === 'castle' ? 8.2 : b.kind === 'wall' ? 2.6 : 4.4), b.z, b.hp / b.maxHp, b.kind === 'castle' ? 2.6 : 1.4, 0.16, 0x6fd16f);
      }
      // Marker visibility: empty slots by day, or highlighted upgradable building.
      const act = showMarkers ? g.actionFor(b) : null;
      const wantMarker = !!act && (!b.node || this.highlight === b);
      v.marker.visible = wantMarker;
      if (wantMarker) {
        v.pulse += dt * 3;
        const near = this.highlight === b;
        const afford = act!.cost <= g.coins;
        const base = near ? 1 : 0.65;
        v.markerMat.opacity = base * (0.75 + 0.25 * Math.sin(v.pulse));
        v.markerMat.color.set(afford ? (near ? 0xfff1a0 : 0xffe9a8) : 0xd8d0c8);
        v.discMat.opacity = near ? 0.32 : 0.14;
        const s = near ? 1.06 + Math.sin(v.pulse * 1.5) * 0.03 : 1;
        if (!b.wall) v.marker.scale.setScalar(s);
      }
    }

    // Units
    for (const m of this.unitMeshes.values()) m.count = 0;
    for (const u of g.units) {
      if (!u.alive) continue;
      const mesh = this.unitMeshes.get(u.def.id)!;
      if (mesh.count >= mesh.instanceMatrix.count) continue;
      const i = mesh.count++;
      const sc = u.def.scale * 1.35;
      let y = g.heightAt(u.x, u.z);
      if (u.def.flying) y = Math.max(y, 0) + 1.7 + Math.sin(u.age * 3 + u.id) * 0.25;
      const ph = u.age * u.speed * 3.2 + u.id;
      let lean = 0, wob = 0, fwd = 0;
      if (u.moving) { y += Math.abs(Math.sin(ph)) * 0.12 * sc; lean = 0.1; wob = Math.sin(ph) * 0.09; }
      if (u.attackT < 0.28) { const k = Math.sin((u.attackT / 0.28) * Math.PI); fwd = k * 0.35 * sc; lean += k * 0.35; }
      let grow = 1;
      if (u.age < 0.6 && u.team === 1) { const k = u.age / 0.6; y -= (1 - k) * 0.9 * sc; grow = 0.4 + 0.6 * k; }
      const fx = Math.sin(u.facing), fz = Math.cos(u.facing);
      _p.set(u.x + fx * fwd, y, u.z + fz * fwd);
      _e.set(lean, u.facing, wob, 'YXZ');
      _q.setFromEuler(_e);
      let sq = 1;
      if (u.hitT < 0.1) sq = 0.88;
      _s.set(sc * grow * (2 - sq), sc * grow * sq, sc * grow * (2 - sq));
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      if (u.hitT < 0.08) _c.setRGB(2.6, 2.6, 2.6);
      else if (u.slowT > 0) _c.setRGB(0.75, 0.95, 1.5);
      else if (u.burnT > 0) _c.setRGB(1.5, 0.95, 0.75);
      else _c.setRGB(1, 1, 1);
      mesh.setColorAt(i, _c);
      if (u.hp < u.maxHp) {
        const top = u.def.flying ? y + 0.9 * sc : y + 1.3 * sc + (u.def.big ? 0.4 : 0);
        this.addBar(u.x, top, u.z, u.hp / u.maxHp, u.def.boss ? 2.4 : u.def.big ? 1.3 : 0.8, u.def.boss ? 0.2 : 0.11, u.team === 0 ? 0x6fb7ff : 0xff6b6b);
      }
    }
    for (const m of this.unitMeshes.values()) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // Projectiles
    for (const m of this.projMeshes.values()) m.count = 0;
    for (const p of g.projectiles) {
      if (!p.alive || p.delay > 0) continue;
      const mesh = this.projMeshes.get(p.kind)!;
      if (mesh.count >= 160) continue;
      const f = Math.min(1, p.traveled / Math.max(0.01, p.total));
      const g0 = g.heightAt(p.sx, p.sz), g1 = g.heightAt(p.tx, p.tz);
      const hEnd = p.team === 0 ? 0.7 : 1.0;
      const arcH = p.arc * p.total;
      const y = g0 + p.h0 + (g1 + hEnd - g0 - p.h0) * f + arcH * 4 * f * (1 - f);
      const dy = (g1 + hEnd - g0 - p.h0) + arcH * 4 * (1 - 2 * f);
      const dxz = p.total;
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.atan2(dy, dxz);
      _p.set(p.x, y, p.z);
      if (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'dart') _e.set(pitch, yaw, 0, 'YXZ');
      else _e.set(time * 5, time * 7, 0);
      _q.setFromEuler(_e);
      _s.setScalar(p.kind === 'star' ? 1.4 : 1);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(mesh.count++, _m);
    }
    for (const m of this.projMeshes.values()) m.instanceMatrix.needsUpdate = true;

    this.updateHero(dt, time);
    // Hero bar
    const h = g.hero;
    if (h.alive && (h.hp < h.maxHp || g.phase === 'night')) this.addBar(h.x, g.heightAt(h.x, h.z) + 3.6, h.z, h.hp / h.maxHp, 1.3, 0.15, 0xffd34d);

    // Bars billboarding
    this.bars.count = this.barCount;
    this.bars.instanceMatrix.needsUpdate = true;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
  }

  private barQ = new THREE.Quaternion();
  private addBar(x: number, y: number, z: number, ratio: number, w: number, hgt: number, color: number): void {
    if (this.barCount + 2 > 700) return;
    ratio = Math.max(0, Math.min(1, ratio));
    const q = this.barQ;
    _p.set(x, y, z);
    _s.set(w + 0.08, hgt + 0.07, 1);
    _m.compose(_p, q, _s);
    this.bars.setMatrixAt(this.barCount, _m);
    this.bars.setColorAt(this.barCount++, _c.setRGB(0.12, 0.1, 0.16));
    const off = -(1 - ratio) * w * 0.5;
    _p.set(x + _right.x * off, y + _right.y * off, z + _right.z * off);
    _s.set(Math.max(0.001, w * ratio), hgt, 1);
    _m.compose(_p, q, _s);
    this.bars.setMatrixAt(this.barCount, _m);
    this.bars.setColorAt(this.barCount++, _c.set(color));
  }

  private updateHero(dt: number, time: number): void {
    const g = this.g, h = g.hero, rig = this.hero;
    rig.root.visible = h.alive;
    this.heroShadow.visible = h.alive;
    if (!h.alive) return;
    const y = g.heightAt(h.x, h.z);
    rig.root.position.set(h.x, y, h.z);
    rig.root.rotation.y = h.facing;
    this.heroShadow.position.set(h.x, Math.max(y, 0) + 0.04, h.z);
    const run = h.moving ? 1 : 0;
    const ph = time * 11;
    rig.legs.forEach((leg, i) => {
      const off = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.x = run * Math.sin(ph + off) * 0.7;
    });
    rig.body.position.y = run * Math.abs(Math.sin(ph)) * 0.12;
    rig.body.rotation.x = run * 0.05;
    rig.cape.rotation.x = 0.2 + run * (0.5 + Math.sin(ph * 0.5) * 0.15);
    // Weapon swing
    const a = h.attackT < 0.3 ? Math.sin((h.attackT / 0.3) * Math.PI) : 0;
    const ab = h.abilityT < 0.5 ? Math.sin((h.abilityT / 0.5) * Math.PI) : 0;
    rig.weapon.rotation.x = -a * 1.4;
    rig.rider.rotation.y = ab * Math.PI * 2 * (h.weapon.ability === 'whirl' ? 1 : 0.1);
    rig.rider.rotation.x = a * 0.15;
    const flash = h.hitT < 0.1;
    rig.root.scale.setScalar(flash ? 1.36 : 1.3);
    void dt;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.clear();
    this.bviews.clear();
  }
}
