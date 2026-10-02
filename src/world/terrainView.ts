import * as THREE from 'three';
import { Polyline, smoothstep } from '../core/math';
import { Rng, makeNoise2 } from '../core/rng';
import { BUILD_RADIUS } from '../data/buildings';
import type { MapDef } from '../data/maps';
import { WATER_LEVEL, type Heightfield } from '../systems/terrain';
import { makeWaterMaterial, worldUniforms } from './material';
import { C, MB, treeGeometry } from './models';

const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Static map visuals: ground, water, vegetation, rocks, bridges and attack-path ribbons. */
export class TerrainView {
  readonly group = new THREE.Group();
  private disposables: { dispose(): void }[] = [];
  private pathRibbons: THREE.Mesh[] = [];
  private ribbonMat: THREE.ShaderMaterial;

  constructor(private map: MapDef, private hf: Heightfield, private material: THREE.Material) {
    this.ribbonMat = new THREE.ShaderMaterial({
      uniforms: { uTime: worldUniforms.uTime, uColor: { value: new THREE.Color(0xff6a5a) }, uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
        void main(){
          float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float chev = fract(vUv.x * 0.45 - uTime * 0.9 - abs(vUv.y - 0.5) * 0.9);
          float a = smoothstep(0.0, 0.35, edge) * (0.25 + 0.75 * smoothstep(0.45, 0.6, chev) * (1.0 - smoothstep(0.75, 0.95, chev)));
          gl_FragColor = vec4(uColor, a * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.disposables.push(this.ribbonMat);
    this.buildGround();
    this.buildWater();
    this.buildVegetation();
    this.buildBridges();
    this.buildRibbons();
  }

  private buildGround(): void {
    const m = this.map, p = m.palette, hf = this.hf;
    const ext = hf.ext + 18;
    const cell = 1.5;
    const n = Math.ceil((ext * 2) / cell);
    const noise = makeNoise2(m.seed + 11);
    const paths = m.paths.map((pp) => new Polyline(pp));
    const rng = new Rng(m.seed);
    // Jittered grid vertices.
    const vx: number[] = [], vz: number[] = [], vy: number[] = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        let x = -ext + i * cell, z = -ext + j * cell;
        if (i > 0 && i < n && j > 0 && j < n) { x += rng.range(-0.26, 0.26) * cell; z += rng.range(-0.26, 0.26) * cell; }
        vx.push(x); vz.push(z);
        vy.push(Math.abs(x) > hf.ext || Math.abs(z) > hf.ext ? hf.compute(x, z) : hf.height(x, z));
      }
    }
    const pos: number[] = [], col: number[] = [], glow: number[] = [];
    const grass = new THREE.Color(p.grass), grass2 = new THREE.Color(p.grass2), meadow = new THREE.Color(p.meadow);
    const pathC = new THREE.Color(p.path), sand = new THREE.Color(p.sand), rock = new THREE.Color(p.rock), cliff = new THREE.Color(p.cliff), snow = new THREE.Color(p.snow);
    const bed = new THREE.Color(p.water).lerp(new THREE.Color(p.sand), 0.35);
    const faceColor = (cx: number, cz: number, h: number, slope: number) => {
      const nv = noise(cx * 0.12, cz * 0.12);
      _c.copy(grass).lerp(grass2, smoothstep(-0.2, 0.6, nv) * 0.8);
      if (noise(cx * 0.05 + 40, cz * 0.05) > 0.35) _c.lerp(meadow, 0.55);
      // Paths
      let pd = Infinity;
      for (const pl of paths) pd = Math.min(pd, pl.distanceTo(cx, cz));
      const pw = 1.55 + noise(cx * 0.4, cz * 0.4) * 0.35;
      if (pd < pw) _c.lerp(pathC, pd < pw - 0.5 ? 1 : 0.6);
      // Building pads get a light dusty tint.
      for (const s of m.slots) {
        if (s.x === undefined) continue;
        const d = Math.hypot(cx - s.x, cz - s.z!);
        const r = BUILD_RADIUS[s.kind] + (s.kind === 'castle' ? 1.4 : 0.5);
        if (d < r) _c.lerp(pathC, s.kind === 'castle' ? 0.7 : 0.35);
      }
      if (h < 0.15) _c.lerp(sand, smoothstep(0.15, -0.05, h));
      if (h < -0.25) _c.copy(bed).lerp(sand, smoothstep(-1.0, -0.25, h) * 0.6);
      if (slope > 0.6 || h > 2.6) _c.lerp(slope > 1.1 ? cliff : rock, Math.min(1, smoothstep(0.6, 1.0, slope) * 0.9 + smoothstep(2.6, 4.5, h) * 0.6));
      if (h > 7.5) _c.lerp(snow, smoothstep(7.5, 9, h));
      const j = 1 + (rng.next() - 0.5) * 0.035;
      _c.multiplyScalar(j);
      return _c;
    };
    const W = n + 1;
    const pushTri = (a: number, b: number, c: number) => {
      const cx = (vx[a] + vx[b] + vx[c]) / 3, cz = (vz[a] + vz[b] + vz[c]) / 3, h = (vy[a] + vy[b] + vy[c]) / 3;
      const slope = (Math.max(vy[a], vy[b], vy[c]) - Math.min(vy[a], vy[b], vy[c])) / cell;
      const fc = faceColor(cx, cz, h, slope);
      for (const k of [a, b, c]) {
        pos.push(vx[k], vy[k], vz[k]);
        col.push(fc.r, fc.g, fc.b);
        glow.push(0);
      }
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        if ((i + j) % 2 === 0) { pushTri(a, c, b); pushTri(b, c, d); }
        else { pushTri(a, c, d); pushTri(a, d, b); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.disposables.push(geo);
  }

  private buildWater(): void {
    const ext = this.hf.ext + 18;
    const geo = new THREE.PlaneGeometry(ext * 2, ext * 2, 60, 60);
    geo.rotateX(-Math.PI / 2);
    const mat = makeWaterMaterial(this.map.palette.water);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = WATER_LEVEL - 0.12;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.disposables.push(geo, mat);
  }

  private buildVegetation(): void {
    const m = this.map, hf = this.hf, t = m.terrain;
    const rng = new Rng(m.seed + 99);
    const paths = m.paths.map((pp) => new Polyline(pp));
    const ext = hf.ext + 4;
    const kinds = [...new Set(t.trees)];
    const buckets = new Map<string, THREE.Matrix4[]>();
    const colors = new Map<string, THREE.Color[]>();
    const blocked = (x: number, z: number, pad: number) => {
      for (const pl of paths) if (pl.distanceTo(x, z) < 3.3 + pad) return true;
      for (const s of m.slots) {
        if (s.x === undefined) continue;
        if (Math.hypot(x - s.x, z - s.z!) < BUILD_RADIUS[s.kind] + 2.4 + pad + (s.kind === 'castle' ? 3 : 0)) return true;
      }
      for (const [rx, rz, rr] of t.rocks) if (Math.hypot(x - rx, z - rz) < rr + 0.5) return true;
      return false;
    };
    const step = 2.1;
    const clumpAt = makeClump(m.seed);
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let z = -ext; z <= ext; z += step) {
      for (let x = -ext; x <= ext; x += step) {
        const px = x + rng.range(-0.9, 0.9), pz = z + rng.range(-0.9, 0.9);
        const r = Math.max(Math.abs(px), Math.abs(pz));
        const edge = smoothstep(m.half * 0.45, m.half + 2, r);
        const clump = clumpAt(px, pz);
        const far = smoothstep(m.half + 8, m.half + 20, r);
        const dens = t.treeDensity * (0.06 + 0.7 * edge + 0.35 * Math.max(0, clump)) * (1 - far * 0.45);
        if (rng.next() > dens) continue;
        const h = r > hf.ext ? hf.compute(px, pz) : hf.height(px, pz);
        if (h < 0.12 || h > 8.2) continue;
        if (r < m.half + 2 && blocked(px, pz, 0)) continue;
        let kind = rng.pick(kinds);
        if (h > 5.5 && kinds.includes('snowpine')) kind = 'snowpine';
        const leaf = rng.pick(m.palette.leaves);
        const key = `${kind}:${leaf}`;
        const sc = rng.range(0.75, 1.35) * (kind === 'willow' ? 1.1 : 1);
        p.set(px, h - 0.05, pz);
        q.setFromEuler(e.set(rng.range(-0.06, 0.06), rng.range(0, Math.PI * 2), rng.range(-0.06, 0.06)));
        s.set(sc, sc * rng.range(0.9, 1.15), sc);
        if (!buckets.has(key)) { buckets.set(key, []); colors.set(key, []); }
        buckets.get(key)!.push(new THREE.Matrix4().compose(p, q, s));
        colors.get(key)!.push(new THREE.Color().setScalar(rng.range(0.9, 1.08)));
      }
    }
    for (const [key, mats] of buckets) {
      const [kind, leaf] = key.split(':');
      const geo = treeGeometry(kind, Number(leaf));
      const inst = new THREE.InstancedMesh(geo, this.material, mats.length);
      mats.forEach((mm, i) => { inst.setMatrixAt(i, mm); inst.setColorAt(i, colors.get(key)![i]); });
      inst.castShadow = true;
      inst.receiveShadow = false;
      inst.computeBoundingSphere();
      this.group.add(inst);
      this.disposables.push(inst);
    }

    // Rocks: clusters from data + scattered pebbles on the rim.
    const rocks: THREE.Matrix4[] = [];
    const rockCol: THREE.Color[] = [];
    const addRock = (x: number, z: number, sc: number) => {
      const h = hf.compute(x, z);
      if (h < -0.6) return;
      p.set(x, h + sc * 0.15, z);
      q.setFromEuler(e.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)));
      s.set(sc, sc * rng.range(0.6, 1), sc);
      rocks.push(new THREE.Matrix4().compose(p, q, s));
      rockCol.push(_c2.set(m.palette.rock).multiplyScalar(rng.range(0.85, 1.1)).clone());
    };
    for (const [rx, rz, rr] of t.rocks) {
      const n = Math.round(rr * 3);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(0, rr);
        addRock(rx + Math.cos(a) * d, rz + Math.sin(a) * d, rng.range(0.4, 1.0));
      }
    }
    for (let i = 0; i < 160; i++) {
      const x = rng.range(-ext, ext), z = rng.range(-ext, ext);
      const r = Math.max(Math.abs(x), Math.abs(z));
      if (r < m.half * 0.55) continue;
      if (r < m.half + 2 && blocked(x, z, 0.5)) continue;
      addRock(x, z, rng.range(0.25, 0.9) * (r > m.half ? 1.6 : 1));
    }
    if (rocks.length) {
      const geo = new MB().dodec(0.8, 0xffffff, 0, 0, 0).build();
      const inst = new THREE.InstancedMesh(geo, this.material, rocks.length);
      rocks.forEach((mm, i) => { inst.setMatrixAt(i, mm); inst.setColorAt(i, rockCol[i]); });
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      this.group.add(inst);
      this.disposables.push(inst, geo);
    }

    // Flowers / grass tufts for colour detail.
    const tufts: THREE.Matrix4[] = [];
    const tuftCol: THREE.Color[] = [];
    const flowerColors = [0xffffff, 0xffd86b, 0xff9fb2, 0xb9a6ff, 0x9fd0ff];
    for (let i = 0; i < 900; i++) {
      const x = rng.range(-m.half, m.half), z = rng.range(-m.half, m.half);
      const h = hf.height(x, z);
      if (h < 0.1 || h > 3) continue;
      if (blocked(x, z, -1.5)) continue;
      const flower = rng.next() < 0.35;
      p.set(x, h, z);
      q.setFromEuler(e.set(0, rng.range(0, 6), 0));
      const sc = flower ? 0.6 : rng.range(0.6, 1.1);
      s.set(sc, sc, sc);
      tufts.push(new THREE.Matrix4().compose(p, q, s));
      tuftCol.push(flower ? new THREE.Color(rng.pick(flowerColors)) : _c2.set(m.palette.grass2).multiplyScalar(rng.range(0.75, 0.95)).clone());
    }
    const tuftGeo = new MB().cone(0.12, 0.35, 3, 0xffffff, 0, 0, 0).cone(0.09, 0.28, 3, 0xffffff, 0.12, 0, 0.05).build();
    const tuftMesh = new THREE.InstancedMesh(tuftGeo, this.material, tufts.length);
    tufts.forEach((mm, i) => { tuftMesh.setMatrixAt(i, mm); tuftMesh.setColorAt(i, tuftCol[i]); });
    tuftMesh.computeBoundingSphere();
    this.group.add(tuftMesh);
    this.disposables.push(tuftMesh, tuftGeo);
  }

  private buildBridges(): void {
    for (const b of this.map.bridges) {
      const mb = new MB();
      for (let x = -b.len / 2; x <= b.len / 2; x += 0.55) mb.boxB(0.5, 0.15, 3.2, x % 1.1 === 0 ? C.wood : C.woodLight, x, 0.25, 0, { ry: (Math.sin(x * 9) * 0.04) });
      for (const z of [-1.6, 1.6]) {
        for (let x = -b.len / 2; x <= b.len / 2 + 0.01; x += b.len / 4) mb.cyl(0.1, 0.1, 1.6, 5, C.woodDark, x, -0.6, z);
        mb.boxB(b.len, 0.12, 0.12, C.woodDark, 0, 0.9, z);
      }
      const geo = mb.build();
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.set(b.x, 0, b.z);
      mesh.rotation.y = b.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.disposables.push(geo);
    }
  }

  private buildRibbons(): void {
    for (const pts of this.map.paths) {
      const line = new Polyline(pts);
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      const tmp = { x: 0, z: 0, tx: 0, tz: 0 };
      const n = Math.ceil(line.length / 0.8);
      for (let i = 0; i <= n; i++) {
        const sArc = (i / n) * (line.length - 3.5);
        line.sample(sArc, tmp);
        const nx = -tmp.tz, nz = tmp.tx, w = 1.25;
        for (const side of [-1, 1]) {
          const x = tmp.x + nx * w * side, z = tmp.z + nz * w * side;
          pos.push(x, Math.max(this.hf.height(x, z), 0.05) + 0.12, z);
          uv.push(sArc, side < 0 ? 0 : 1);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, this.ribbonMat.clone());
      mesh.renderOrder = 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.pathRibbons.push(mesh);
      this.disposables.push(geo, mesh.material as THREE.Material);
    }
  }

  /** Fade attack-path ribbons in/out; `active` = path indices of the next wave. */
  updateRibbons(active: readonly number[] | null, dt: number): void {
    this.pathRibbons.forEach((r, i) => {
      const mat = r.material as THREE.ShaderMaterial;
      const target = active && active.includes(i) ? 0.85 : 0;
      const o = mat.uniforms.uOpacity.value as number;
      const v = o + (target - o) * Math.min(1, dt * 3);
      mat.uniforms.uOpacity.value = v;
      r.visible = v > 0.01;
    });
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.group.clear();
  }
}

function makeClump(seed: number): (x: number, z: number) => number {
  const n = makeNoise2(seed + 5);
  return (x, z) => n(x * 0.09, z * 0.09) * 1.4 - 0.25;
}
