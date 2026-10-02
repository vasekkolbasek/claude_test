import * as THREE from 'three';
import { MB, coinGeometry } from './models';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  r: number; g: number; b: number;
  grav: number; drag: number; spin: number; rot: number;
  grow: number;
}

class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private free: P[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();
  private c = new THREE.Color();
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private cap: number, private additive = false) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }
  spawn(): P | null {
    if (this.ps.length >= this.cap) return null;
    const p = this.free.pop() ?? ({} as P);
    this.ps.push(p);
    return p;
  }
  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.free.push(p); continue; }
      this.ps[n++] = p;
      p.vy -= p.grav * dt;
      const d = Math.pow(p.drag, dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.spin * dt;
    }
    this.ps.length = n;
    for (let i = 0; i < n; i++) {
      const p = this.ps[i];
      const t = p.life / p.max;
      const sc = p.size * (p.grow > 0 ? (1 + (1 - t) * p.grow) * Math.min(1, t * 3) : Math.min(1, t * 2.5));
      this.e.set(p.rot, p.rot * 0.7, 0);
      this.q.setFromEuler(this.e);
      this.s.set(sc, sc, sc);
      this.v.set(p.x, p.y, p.z);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      const fade = this.additive ? Math.min(1, t * 1.5) : 1;
      this.c.setRGB(p.r * fade, p.g * fade, p.b * fade);
      this.mesh.setColorAt(i, this.c);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear(): void { for (const p of this.ps) this.free.push(p); this.ps.length = 0; this.mesh.count = 0; }
}

interface Coin { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; delay: number; h: number; cb?: () => void }

export interface BurstOpts {
  color: number;
  speed?: number;
  up?: number;
  life?: number;
  size?: number;
  grav?: number;
  drag?: number;
  spread?: number;
  grow?: number;
  glow?: boolean;
}

const _col = new THREE.Color();

/** Particles, flying coins, shockwave rings and camera shake. */
export class Fx {
  readonly group = new THREE.Group();
  private debris: ParticlePool;
  private sparks: ParticlePool;
  private coins: Coin[] = [];
  private coinMesh: THREE.InstancedMesh;
  private rings: { mesh: THREE.Mesh; t: number; max: number; r: number }[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  private disposables: { dispose(): void }[] = [];
  shake = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(worldMat: THREE.Material) {
    const cube = new MB().box(1, 1, 1, 0xffffff, 0, 0, 0).build();
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparkGeo = new THREE.OctahedronGeometry(0.5, 0);
    this.debris = new ParticlePool(cube, worldMat, 700);
    this.sparks = new ParticlePool(sparkGeo, sparkMat, 500, true);
    this.debris.mesh.castShadow = false;
    this.group.add(this.debris.mesh, this.sparks.mesh);
    this.coinMesh = new THREE.InstancedMesh(coinGeometry(), worldMat, 80);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.group.add(this.coinMesh);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.disposables.push(cube, sparkMat, sparkGeo, this.ringGeo, this.debris.mesh, this.sparks.mesh, this.coinMesh);
  }

  burst(x: number, y: number, z: number, n: number, o: BurstOpts): void {
    const pool = o.glow ? this.sparks : this.debris;
    _col.set(o.color);
    for (let i = 0; i < n; i++) {
      const p = pool.spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const spread = o.spread ?? 0.2;
      p.x = x + (Math.random() - 0.5) * spread;
      p.y = y + (Math.random() - 0.5) * spread;
      p.z = z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = (o.up ?? 2) * (0.5 + Math.random());
      p.max = p.life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (o.size ?? 0.15) * (0.6 + Math.random() * 0.8);
      const k = 0.85 + Math.random() * 0.3;
      p.r = _col.r * k; p.g = _col.g * k; p.b = _col.b * k;
      p.grav = o.grav ?? 9;
      p.drag = o.drag ?? 0.4;
      p.spin = (Math.random() - 0.5) * 12;
      p.rot = Math.random() * 6;
      p.grow = o.grow ?? 0;
    }
  }

  /** Purple mist puff when a mist creature dissolves. */
  mist(x: number, y: number, z: number, scale = 1): void {
    this.burst(x, y + 0.5 * scale, z, Math.round(7 * scale), { color: 0x5a4a90, speed: 1.4 * scale, up: 1.4, life: 0.8, size: 0.32 * scale, grav: -1.5, drag: 0.15, grow: 1.4, spread: 0.6 * scale, glow: true });
    this.burst(x, y + 0.6 * scale, z, Math.round(5 * scale), { color: 0xd9c8ff, speed: 2.4, up: 2.2, life: 0.5, size: 0.12, grav: 2, glow: true });
  }

  dust(x: number, y: number, z: number, r: number, n = 16): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.burst(x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 1, { color: 0xe9dcc2, speed: 1.2, up: 0.8, life: 0.8, size: 0.4, grav: -0.5, drag: 0.2, grow: 1.4, spread: 0.2 });
    }
  }

  coin(from: THREE.Vector3, to: THREE.Vector3, delay = 0, cb?: () => void, dur = 0.42): void {
    if (this.coins.length >= 80) { cb?.(); return; }
    this.coins.push({ from: from.clone(), to: to.clone(), t: 0, dur, delay, h: 1.6 + from.distanceTo(to) * 0.18, cb });
  }

  ring(x: number, y: number, z: number, r: number, color: number, life = 0.5): void {
    let ring = this.rings.find((rr) => rr.t >= rr.max);
    if (!ring) {
      if (this.rings.length > 12) return;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      this.group.add(mesh);
      ring = { mesh, t: 0, max: life, r };
      this.rings.push(ring);
      this.disposables.push(mat);
    }
    ring.t = 0;
    ring.max = life;
    ring.r = r;
    (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    ring.mesh.position.set(x, y + 0.15, z);
    ring.mesh.visible = true;
  }

  addShake(a: number): void { this.shake = Math.min(1.2, this.shake + a); }

  update(dt: number): void {
    this.debris.update(dt);
    this.sparks.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // Coins
    let n = 0;
    let vis = 0;
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.delay > 0) { c.delay -= dt; this.coins[n++] = c; continue; }
      c.t += dt;
      const k = Math.min(1, c.t / c.dur);
      if (k >= 1) { c.cb?.(); this.sparkle(c.to); continue; }
      this.coins[n++] = c;
      const e = k;
      this.v.lerpVectors(c.from, c.to, e);
      this.v.y += Math.sin(e * Math.PI) * c.h;
      this.q.setFromAxisAngle(this.s.set(0, 1, 0), c.t * 14);
      this.s.setScalar(1.1);
      this.m.compose(this.v, this.q, this.s);
      if (vis < 80) this.coinMesh.setMatrixAt(vis++, this.m);
    }
    this.coins.length = n;
    this.coinMesh.count = vis;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) {
      if (r.t >= r.max) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.max);
      const sc = r.r * (0.2 + 0.8 * (1 - (1 - k) * (1 - k)));
      r.mesh.scale.set(sc, 1, sc);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
  }

  private sparkle(at: THREE.Vector3): void {
    this.burst(at.x, at.y + 0.2, at.z, 3, { color: 0xffe08a, speed: 1.5, up: 1.5, life: 0.35, size: 0.12, grav: 3, glow: true });
  }

  clear(): void {
    this.debris.clear();
    this.sparks.clear();
    for (const c of this.coins) c.cb?.();
    this.coins.length = 0;
    this.coinMesh.count = 0;
    for (const r of this.rings) { r.t = r.max; r.mesh.visible = false; }
    this.shake = 0;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
