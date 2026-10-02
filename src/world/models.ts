import * as THREE from 'three';
import type { BKind } from '../data/buildings';
import type { UnitId } from '../data/units';

interface PartOpts { rx?: number; ry?: number; rz?: number; glow?: number; sx?: number; sy?: number; sz?: number; order?: THREE.EulerOrder }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Builds a single merged, non-indexed geometry with color + glow attributes. */
export class MB {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private glo: number[] = [];

  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, o: PartOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, o.order ?? 'XYZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    g.computeVertexNormals();
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    _c.set(color);
    const glow = o.glow ?? 0;
    for (let i = 0; i < pa.count; i++) {
      this.pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      this.nor.push(na.getX(i), na.getY(i), na.getZ(i));
      this.col.push(_c.r, _c.g, _c.b);
      this.glo.push(glow);
    }
    g.dispose();
    if (g !== geo) geo.dispose();
    return this;
  }
  box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, o);
  }
  /** Box resting on y (bottom at y). */
  boxB(w: number, h: number, d: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.box(w, h, d, color, x, y + h / 2, z, o);
  }
  cyl(rt: number, rb: number, h: number, seg: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z, o);
  }
  cone(r: number, h: number, seg: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, o);
  }
  ico(r: number, color: number, x: number, y: number, z: number, o?: PartOpts, detail = 0): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, o);
  }
  oct(r: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.add(new THREE.OctahedronGeometry(r, 0), color, x, y, z, o);
  }
  dodec(r: number, color: number, x: number, y: number, z: number, o?: PartOpts): this {
    return this.add(new THREE.DodecahedronGeometry(r, 0), color, x, y, z, o);
  }
  /** Triangular prism roof along x. */
  roof(w: number, h: number, d: number, color: number, x: number, y: number, z: number, o: PartOpts = {}): this {
    // Prism axis → x, apex → up, then optional yaw.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 3);
    return this.add(geo, color, x, y + h / 3, z, { ...o, rz: Math.PI / 2, rx: -Math.PI / 2, ry: o.ry ?? 0, order: 'YXZ', sx: d * 0.577, sy: w, sz: h / 1.5 });
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('glow', new THREE.Float32BufferAttribute(this.glo, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------ palette
export const C = {
  stone: 0xf1e8d8, stone2: 0xdcd1c0, stoneDark: 0xb9ae9d, slate: 0x8d93a6,
  roofBlue: 0x5d82c9, roofRed: 0xe0826b, roofTeal: 0x4fb1a2, roofPurple: 0x8d71c9, roofGreen: 0x6aa86a,
  wood: 0xb07e52, woodDark: 0x7f5b3d, woodLight: 0xd3a676,
  gold: 0xf4c552, banner: 0x4a6fd1, bannerRed: 0xd8574f, window: 0xffd27a, fire: 0xff9a3c,
  wheat: 0xecd06e, field: 0xb8d36f, hay: 0xe8c45c, skin: 0xf2c6a0, white: 0xffffff, iron: 0xb7bccb, dark: 0x3b3550,
  ice: 0x9fe3ff, arcane: 0xc59bff, ember: 0xff7a3a, water: 0x7cc6e0,
};

// ------------------------------------------------------------------ buildings
function windows(mb: MB, n: number, r: number, y: number, phase = 0): void {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    mb.box(0.22, 0.34, 0.08, C.window, Math.sin(a) * r, y, Math.cos(a) * r, { ry: a, glow: 1 });
  }
}

function crenels(mb: MB, r: number, y: number, n: number, color: number, s = 0.32): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    mb.boxB(s, s, s, color, Math.sin(a) * r, y, Math.cos(a) * r, { ry: a });
  }
}

function banner(mb: MB, x: number, y: number, z: number, color = C.banner, h = 1.1): void {
  mb.cyl(0.04, 0.04, h + 0.5, 4, C.woodDark, x, y, z);
  mb.boxB(0.55, h * 0.6, 0.05, color, x + 0.3, y + h * 0.45, z);
  mb.boxB(0.6, 0.08, 0.07, C.gold, x + 0.3, y + h * 0.45 + h * 0.6, z);
}

function torch(mb: MB, x: number, y: number, z: number): void {
  mb.cyl(0.05, 0.05, 0.5, 4, C.woodDark, x, y, z);
  mb.oct(0.13, C.fire, x, y + 0.6, z, { glow: 2.2 });
}

function castle(mb: MB, look: string, tier: number): void {
  const roof = look === 'court' ? C.roofRed : C.roofBlue;
  mb.cyl(3.7, 3.9, 0.45, 8, C.stoneDark, 0, 0, 0, { ry: Math.PI / 8 });
  // Curtain walls
  const R = 2.55;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.sin(a) * R * 0.71, z = Math.cos(a) * R * 0.71;
    mb.boxB(3.6, 1.9, 0.6, C.stone2, x, 0.4, z, { ry: a });
    for (let k = -2; k <= 2; k++) mb.boxB(0.36, 0.34, 0.66, C.stone2, x + Math.cos(a) * k * 0.72, 2.3, z - Math.sin(a) * k * 0.72, { ry: a });
  }
  // Corner towers
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    mb.cyl(0.78, 0.86, 3.3, 8, C.stone, x, 0.4, z);
    mb.cone(1.0, 1.5, 8, roof, x, 3.7, z);
    mb.box(0.2, 0.3, 0.08, C.window, x + Math.sin(a + 0.6) * 0.8, 2.6, z + Math.cos(a + 0.6) * 0.8, { ry: a + 0.6, glow: 1 });
    if (tier >= 2) mb.cone(0.16, 0.5, 4, C.gold, x, 5.15, z);
  }
  // Keep
  const kh = look === 'citadel' ? 4.6 : 3.7;
  mb.boxB(2.4, kh, 2.4, C.stone, 0, 0.4, 0);
  mb.cone(1.95, 2.1, 4, roof, 0, 0.4 + kh, 0, { ry: Math.PI / 4 });
  windows(mb, 4, 1.23, 0.4 + kh * 0.62, Math.PI / 4 * 0);
  windows(mb, 4, 1.23, 0.4 + kh * 0.3, Math.PI / 4 * 0);
  banner(mb, 0, 0.4 + kh + 1.8, 0, C.banner, 1.1);
  // Gate facing the camera side (+z).
  mb.boxB(1.1, 1.4, 0.3, C.woodDark, 0, 0.4, R * 0.74 + 0.25, { ry: Math.PI / 4 });
  torch(mb, 0.9, 0.4, R * 0.95);
  torch(mb, R * 0.95, 0.4, 0.9);
  if (look === 'court') {
    // Market stalls with awnings.
    mb.boxB(0.9, 0.7, 0.7, C.wood, 2.6, 0.4, -1.2).boxB(1.1, 0.12, 0.9, C.bannerRed, 2.6, 1.2, -1.2, { rz: 0.2 });
    mb.boxB(0.9, 0.7, 0.7, C.wood, -1.2, 0.4, 2.6).boxB(1.1, 0.12, 0.9, C.gold, -1.2, 1.2, 2.6, { rx: 0.2 });
  }
  if (look === 'citadel') {
    mb.cyl(0.5, 0.6, 1.4, 6, C.stone, 0, 0.4 + kh, 0);
    crenels(mb, 1.25, 0.4 + kh - 0.05, 8, C.stone2, 0.28);
  }
  if (tier >= 2) {
    banner(mb, 2.2, 2.4, 2.2, C.banner, 1.3);
    banner(mb, -2.2, 2.4, -2.2, C.banner, 1.3);
    mb.oct(0.35, C.gold, 0, 0.4 + kh + 2.6, 0, { glow: 1.8 });
  }
}

function wall(mb: MB, look: string, tier: number): void {
  // Built along local x; the gate gap sits in the middle.
  const len = 6.4;
  if (look === 'base' || look === 'spiked') {
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 0.42) {
      const gate = Math.abs(x) < 0.9;
      if (gate) continue;
      const h = 1.5 + Math.sin(x * 7) * 0.15;
      mb.cyl(0.2, 0.22, h, 5, C.wood, x, 0, 0);
      mb.cone(0.2, 0.35, 5, C.woodLight, x, h, 0);
    }
    mb.boxB(1.9, 0.18, 0.18, C.woodDark, 0, 1.45, 0);
    mb.boxB(0.8, 1.2, 0.12, C.woodDark, -0.45, 0, 0.05, { ry: 0.2 }).boxB(0.8, 1.2, 0.12, C.woodDark, 0.45, 0, 0.05, { ry: -0.2 });
    if (look === 'spiked') {
      for (let x = -len / 2 + 0.3; x <= len / 2; x += 0.75) {
        if (Math.abs(x) < 1) continue;
        mb.cone(0.08, 0.9, 4, C.iron, x, 0.6, 0.45, { rx: Math.PI / 2.4 });
        mb.cone(0.08, 0.9, 4, C.iron, x, 0.6, -0.45, { rx: -Math.PI / 2.4 });
      }
    }
  } else {
    for (const s of [-1, 1]) {
      mb.boxB(2.4, 1.8, 0.7, C.stone2, s * 2.0, 0, 0);
      for (let k = 0; k < 3; k++) mb.boxB(0.38, 0.35, 0.74, C.stone2, s * (1.1 + k * 0.85), 1.8, 0);
      mb.cyl(0.55, 0.6, 2.4, 6, C.stone, s * 1.0, 0, 0);
      mb.cone(0.62, 0.7, 6, C.roofBlue, s * 1.0, 2.4, 0);
    }
    mb.boxB(1.4, 0.4, 0.7, C.stone, 0, 1.7, 0);
    mb.boxB(1.2, 1.4, 0.1, C.woodDark, 0, 0, 0);
  }
  if (tier >= 2) {
    if (look === 'stone' || look === 'base') { torch(mb, -1.3, 2.4, 0.4); torch(mb, 1.3, 2.4, 0.4); }
    else for (const s of [-1, 1]) mb.cyl(0.35, 0.3, 0.4, 6, C.dark, s * 1.4, 0, 0.7).oct(0.18, C.ember, s * 1.4, 0.5, 0.7, { glow: 2 });
    banner(mb, 1.2, 1.6, -0.2, C.banner, 0.8);
  }
}

function tower(mb: MB, look: string, tier: number): void {
  if (look === 'base') {
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) mb.cyl(0.13, 0.16, 3.2, 5, C.wood, x, 0, z);
    mb.boxB(1.9, 0.25, 1.9, C.woodDark, 0, 3.0, 0);
    for (const [x, z, ry] of [[0, -0.9, 0], [0, 0.9, 0], [-0.9, 0, Math.PI / 2], [0.9, 0, Math.PI / 2]]) mb.boxB(1.9, 0.5, 0.1, C.wood, x, 3.25, z, { ry });
    mb.cone(1.45, 1.2, 4, C.roofRed, 0, 3.9, 0, { ry: Math.PI / 4 });
    mb.boxB(0.12, 0.6, 1.4, C.woodLight, 0, 1.2, 0, { rx: 0.9 });
    return;
  }
  if (look === 'archer') {
    mb.cyl(0.85, 1.05, 3.6, 8, C.stone, 0, 0, 0);
    mb.cyl(1.2, 1.0, 0.4, 8, C.stone2, 0, 3.6, 0);
    crenels(mb, 1.05, 4.0, 8, C.stone2, 0.3);
    mb.cone(1.25, 1.8, 8, C.roofBlue, 0, 4.4, 0);
    windows(mb, 3, 0.95, 2.2, 0.5);
    if (tier >= 2) { banner(mb, 0, 6.0, 0, C.banner, 0.8); mb.cyl(1.22, 1.22, 0.1, 8, C.gold, 0, 4.35, 0); }
  } else {
    mb.cyl(1.1, 1.25, 2.6, 6, C.stone2, 0, 0, 0);
    mb.cyl(1.35, 1.2, 0.35, 6, C.stoneDark, 0, 2.6, 0);
    // Ballista
    mb.boxB(0.5, 0.4, 0.5, C.woodDark, 0, 2.95, 0);
    mb.boxB(0.3, 0.25, 1.9, C.wood, 0, 3.35, 0.2, { rx: -0.12 });
    mb.boxB(2.0, 0.14, 0.2, C.woodDark, 0, 3.45, 0.7, { rx: -0.12 });
    mb.cone(0.08, 0.4, 4, C.iron, 0, 3.4, 1.35, { rx: Math.PI / 2 });
    windows(mb, 2, 1.14, 1.6, 0.8);
    if (tier >= 2) { mb.boxB(0.18, 0.18, 1.7, C.gold, 0.6, 3.0, 0); mb.boxB(0.18, 0.18, 1.7, C.gold, -0.6, 3.0, 0); }
  }
}

function magic(mb: MB, look: string, tier: number): void {
  const crystal = look === 'frost' ? C.ice : look === 'fire' ? C.ember : C.arcane;
  const roof = look === 'frost' ? 0x7fb8e6 : look === 'fire' ? 0xd86a5a : C.roofPurple;
  mb.cyl(0.75, 1.1, 1.2, 7, C.stone2, 0, 0, 0);
  mb.cyl(0.55, 0.72, 2.8, 7, C.stone, 0, 1.2, 0);
  mb.cyl(0.95, 0.6, 0.45, 7, roof, 0, 4.0, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mb.cone(0.12, 0.9, 4, roof, Math.sin(a) * 0.75, 4.3, Math.cos(a) * 0.75);
  }
  mb.oct(0.45, crystal, 0, 5.4, 0, { glow: 2.4, sy: 1.5 });
  windows(mb, 3, 0.62, 2.6, 0.2);
  if (tier >= 2) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      mb.oct(0.14, crystal, Math.sin(a) * 1.0, 5.0, Math.cos(a) * 1.0, { glow: 2.2 });
    }
  }
}

function barracks(mb: MB, look: string, tier: number): void {
  mb.boxB(3.2, 1.5, 2.0, C.stone, 0, 0, 0);
  mb.roof(3.5, 1.3, 2.4, look === 'sword' ? C.roofRed : C.roofBlue, 0, 1.5, 0);
  mb.boxB(0.7, 1.0, 0.1, C.woodDark, 0, 0, 1.01);
  windows(mb, 0, 0, 0);
  mb.box(0.3, 0.3, 0.06, C.window, -0.95, 0.9, 1.02, { glow: 1 }).box(0.3, 0.3, 0.06, C.window, 0.95, 0.9, 1.02, { glow: 1 });
  // Weapon rack
  mb.boxB(1.3, 0.12, 0.12, C.woodDark, 1.9, 0.6, 1.0, { ry: Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    if (look === 'sword') mb.boxB(0.08, 0.9, 0.22, C.iron, 1.95, 0.0, 0.5 + i * 0.32);
    else mb.cyl(0.03, 0.03, 1.8, 4, C.wood, 1.95, 0, 0.5 + i * 0.32).cone(0.06, 0.25, 4, C.iron, 1.95, 1.8, 0.5 + i * 0.32);
  }
  if (look === 'sword') mb.box(0.55, 0.7, 0.08, C.banner, 0, 2.3, 1.15, { rx: 0.5 }).oct(0.12, C.gold, 0, 2.35, 1.2);
  banner(mb, -1.8, 0, 0.9, look === 'sword' ? C.bannerRed : C.banner, 1.2);
  if (tier >= 2) { banner(mb, 1.6, 1.4, -0.8, C.gold, 0.9); torch(mb, -1.0, 0, 1.3); }
}

function range(mb: MB, look: string, tier: number): void {
  // Open shed
  for (const [x, z] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.6], [1.3, 0.6]]) mb.cyl(0.1, 0.12, 1.6, 5, C.wood, x, 0, z);
  mb.roof(3.1, 0.9, 1.9, look === 'xbows' ? C.roofTeal : C.roofGreen, 0, 1.6, -0.1);
  mb.boxB(2.4, 0.5, 0.15, C.woodDark, 0, 0, -0.8);
  // Targets
  for (const x of [-1, 1]) {
    mb.cyl(0.06, 0.06, 1.1, 4, C.woodDark, x, 0, 1.6);
    mb.cyl(0.45, 0.45, 0.1, 10, C.white, x, 1.0, 1.6, { rx: Math.PI / 2 });
    mb.cyl(0.3, 0.3, 0.12, 10, C.bannerRed, x, 1.0, 1.6, { rx: Math.PI / 2 });
    mb.cyl(0.12, 0.12, 0.14, 8, C.gold, x, 1.0, 1.6, { rx: Math.PI / 2 });
  }
  mb.cone(0.5, 0.9, 6, C.hay, -1.9, 0, -0.2);
  if (look === 'xbows') mb.boxB(0.9, 0.25, 0.25, C.woodDark, 0.4, 0.6, 0.1).boxB(0.08, 0.08, 0.9, C.iron, 0.4, 0.75, 0.1);
  if (tier >= 2) { banner(mb, 1.8, 0, -0.6, C.banner, 1.1); torch(mb, 0, 0, 1.0); }
}

function farm(mb: MB, look: string, tier: number): void {
  // Fields
  for (const [x, z, w, d] of [[1.0, 0.9, 1.4, 1.6], [-1.1, 1.2, 1.3, 1.1]] as const) {
    mb.boxB(w, 0.12, d, 0x9b7a52, x, 0, z);
    for (let i = 0; i < 4; i++) mb.boxB(w * 0.9, 0.22, d * 0.14, tier >= 2 ? C.wheat : C.field, x, 0.1, z - d * 0.36 + i * d * 0.24);
  }
  mb.boxB(1.3, 1.0, 1.1, C.stone, -0.7, 0, -0.8);
  mb.roof(1.5, 0.8, 1.4, C.roofRed, -0.7, 1.0, -0.8);
  mb.box(0.24, 0.26, 0.06, C.window, -0.7, 0.6, -0.24, { glow: 1 });
  mb.cone(0.45, 0.7, 6, C.hay, 0.9, 0, -0.9);
  if (look === 'mill') {
    mb.cyl(0.35, 0.55, 2.4, 6, C.stone2, 0.9, 0, -0.9);
    mb.cone(0.5, 0.6, 6, C.roofRed, 0.9, 2.4, -0.9);
    for (let i = 0; i < 4; i++) mb.box(0.18, 1.4, 0.05, C.woodLight, 0.9 + Math.sin(i * Math.PI / 2 + 0.4) * 0.7, 2.2 + Math.cos(i * Math.PI / 2 + 0.4) * 0.7, -0.4, { rz: -(i * Math.PI / 2 + 0.4) });
  }
  if (look === 'militia') {
    for (let x = -1.8; x <= 1.8; x += 0.6) mb.boxB(0.1, 0.6, 0.1, C.woodDark, x, 0, 2.0);
    mb.boxB(3.7, 0.08, 0.08, C.wood, 0, 0.45, 2.0);
    banner(mb, -1.8, 0, -0.2, C.banner, 0.8);
  }
  if (tier >= 2) torch(mb, 0.0, 0, -0.2);
}

function mine(mb: MB, look: string, tier: number): void {
  mb.dodec(1.3, C.slate, -0.3, 0.6, -0.4, { sy: 0.8 });
  mb.dodec(0.9, 0xa29fb0, 0.8, 0.4, -0.6, { ry: 0.6 });
  mb.dodec(0.6, C.slate, -1.2, 0.3, 0.5);
  // Entrance
  mb.boxB(0.9, 0.9, 0.3, C.dark, 0.1, 0, 0.55);
  mb.boxB(0.14, 1.1, 0.14, C.wood, -0.35, 0, 0.7).boxB(0.14, 1.1, 0.14, C.wood, 0.55, 0, 0.7).boxB(1.1, 0.16, 0.18, C.wood, 0.1, 1.05, 0.7);
  mb.oct(0.1, C.fire, 0.75, 1.0, 0.85, { glow: 2 });
  // Cart with gold
  mb.boxB(0.6, 0.35, 0.45, C.woodDark, 1.0, 0.12, 1.0).ico(0.2, C.gold, 1.0, 0.55, 1.0, { glow: 1.6 });
  mb.cyl(0.1, 0.1, 0.06, 6, C.dark, 0.75, 0.12, 1.25, { rx: Math.PI / 2 });
  if (look === 'deep') {
    for (const x of [-0.9, 0.3]) mb.cyl(0.07, 0.07, 2.4, 4, C.wood, x, 0, -1.2);
    mb.boxB(1.4, 0.12, 0.2, C.wood, -0.3, 2.3, -1.2).cyl(0.25, 0.25, 0.1, 8, C.iron, -0.3, 2.0, -1.1, { rx: Math.PI / 2 });
  }
  if (look === 'fort') {
    for (let a = 0; a < Math.PI * 1.4; a += 0.32) mb.cyl(0.15, 0.17, 1.2, 5, C.wood, Math.cos(a + 2.3) * 1.75, 0, Math.sin(a + 2.3) * 1.75);
    mb.cyl(0.4, 0.5, 1.8, 6, C.stone2, -1.4, 0, 1.0).cone(0.55, 0.6, 6, C.roofBlue, -1.4, 1.8, 1.0);
  }
  if (tier >= 2) mb.ico(0.3, C.gold, -0.6, 1.5, 0.2, { glow: 1.7 });
}

function fish(mb: MB, look: string, tier: number): void {
  for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) mb.cyl(0.08, 0.08, 0.7, 4, C.woodDark, x, -0.2, z);
  mb.boxB(1.5, 0.12, 1.3, C.wood, 0, 0.5, 0);
  mb.boxB(1.2, 0.85, 1.0, C.woodLight, 0, 0.62, 0);
  mb.roof(1.5, 0.7, 1.3, C.roofTeal, 0, 1.47, 0);
  mb.box(0.22, 0.22, 0.05, C.window, 0, 1.05, 0.51, { glow: 1 });
  // Pier towards the water (-x)
  const len = look === 'pier' ? 3.2 : 2.0;
  mb.boxB(len, 0.1, 0.6, C.wood, -0.75 - len / 2, 0.35, 0.2);
  // Boat
  mb.cyl(0.3, 0.3, 1.2, 6, C.woodDark, -1.5, 0.1, 1.0, { rz: Math.PI / 2, sy: 1, sz: 0.6 });
  // Drying rack with fish
  mb.boxB(0.06, 0.7, 0.06, C.woodDark, 0.95, 0, 0.9).boxB(0.06, 0.7, 0.06, C.woodDark, 0.95, 0, -0.1).boxB(0.06, 0.06, 1.1, C.woodDark, 0.95, 0.68, 0.4);
  for (let i = 0; i < 3; i++) mb.boxB(0.05, 0.28, 0.1, 0x9fc4d8, 0.95, 0.38, 0.1 + i * 0.3);
  if (look === 'pier') mb.cyl(0.3, 0.3, 1.0, 6, C.wood, -2.4, 0.1, -0.6, { rz: Math.PI / 2, sz: 0.6 });
  if (look === 'market') {
    mb.boxB(0.8, 0.5, 0.6, C.wood, 0.4, 0, 1.6).boxB(1.0, 0.1, 0.8, C.bannerRed, 0.4, 0.95, 1.6, { rx: 0.25 });
    for (const x of [0.05, 0.75]) mb.boxB(0.05, 0.9, 0.05, C.woodDark, x, 0, 1.95);
  }
  if (tier >= 2) torch(mb, 0.8, 0.5, -0.6);
}

function forge(mb: MB, look: string, tier: number): void {
  mb.boxB(2.2, 1.4, 1.8, C.stone2, 0, 0, 0);
  mb.roof(2.4, 0.9, 2.1, look === 'workshop' ? C.roofTeal : C.roofRed, 0, 1.4, 0);
  mb.cyl(0.32, 0.4, 2.6, 6, C.stoneDark, 0.7, 0, -0.5);
  mb.boxB(0.9, 0.7, 0.2, C.dark, -0.2, 0, 0.91);
  mb.boxB(0.7, 0.4, 0.15, C.ember, -0.2, 0.1, 0.95, { glow: 2.3 });
  // Anvil
  mb.boxB(0.3, 0.35, 0.3, C.dark, 1.0, 0, 1.3).boxB(0.6, 0.18, 0.28, 0x5c5a6b, 1.0, 0.35, 1.3);
  if (look === 'armory') {
    for (let i = 0; i < 3; i++) mb.boxB(0.08, 0.8, 0.22, C.iron, -1.35, 0, -0.5 + i * 0.4);
    mb.box(0.5, 0.6, 0.08, C.banner, -1.15, 1.6, 0.95);
  }
  if (look === 'workshop') {
    mb.cyl(0.45, 0.45, 0.14, 8, C.gold, -1.2, 0.6, 0.9, { rx: Math.PI / 2 });
    mb.cyl(0.3, 0.3, 0.14, 7, C.iron, -0.7, 1.0, 0.95, { rx: Math.PI / 2 });
  }
  if (tier >= 2) { mb.oct(0.18, C.ember, 0.7, 2.8, -0.5, { glow: 2.2 }); banner(mb, -1.0, 0, 1.2, C.banner, 1.0); }
}

const BUILDERS: Record<BKind, (mb: MB, look: string, tier: number) => void> = {
  castle, wall, tower, magic, barracks, range, farm, mine, fish, forge,
};

const cache = new Map<string, THREE.BufferGeometry>();
export function buildingGeometry(kind: BKind, look: string, tier: number): THREE.BufferGeometry {
  const key = `${kind}:${look}:${tier}`;
  let g = cache.get(key);
  if (!g) {
    const mb = new MB();
    BUILDERS[kind](mb, look, tier);
    g = mb.build();
    cache.set(key, g);
  }
  return g;
}

export function rubbleGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const key = `rubble:${radius.toFixed(1)}:${seed % 3}`;
  let g = cache.get(key);
  if (!g) {
    const mb = new MB();
    let s = seed;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    mb.cyl(radius * 0.9, radius, 0.2, 7, C.stoneDark, 0, 0, 0);
    for (let i = 0; i < 6 + radius * 3; i++) {
      const a = r() * Math.PI * 2, d = r() * radius * 0.85;
      mb.box(0.3 + r() * 0.5, 0.25 + r() * 0.4, 0.3 + r() * 0.4, r() < 0.5 ? C.stone2 : C.woodDark, Math.cos(a) * d, 0.3, Math.sin(a) * d, { ry: r() * 3, rx: r() * 0.6 });
    }
    mb.cyl(0.07, 0.07, 0.9, 4, C.woodDark, 0.2, 0.1, 0.1, { rz: 0.7 });
    g = mb.build();
    cache.set(key, g);
  }
  return g;
}

export function disposeModelCache(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}

// ------------------------------------------------------------------ units
const EYE = 0xfff0a0;
function eyes(mb: MB, y: number, z: number, sep = 0.09, color = EYE): void {
  mb.box(0.07, 0.05, 0.04, color, -sep, y, z, { glow: 2.4 }).box(0.07, 0.05, 0.04, color, sep, y, z, { glow: 2.4 });
}

const MIST = 0x6f58b0, MIST2 = 0x57469a, MIST3 = 0x8c79cc;

function soldier(mb: MB, tunic: number, helm: number): void {
  mb.cyl(0.24, 0.3, 0.55, 6, tunic, 0, 0.18, 0);
  mb.boxB(0.12, 0.2, 0.12, C.woodDark, -0.1, 0, 0).boxB(0.12, 0.2, 0.12, C.woodDark, 0.1, 0, 0);
  mb.ico(0.17, C.skin, 0, 0.88, 0);
  mb.cone(0.2, 0.22, 6, helm, 0, 0.92, 0);
}

export function unitGeometry(id: UnitId): THREE.BufferGeometry {
  const key = `unit:${id}`;
  let g = cache.get(key);
  if (g) return g;
  const mb = new MB();
  switch (id) {
    case 'militia':
      soldier(mb, 0xa98a62, 0x8a6d4a);
      mb.cyl(0.025, 0.025, 1.1, 4, C.wood, 0.28, 0.2, 0.1, { rx: 0.2 }).cone(0.07, 0.18, 3, C.iron, 0.28, 1.25, 0.32);
      break;
    case 'spearman':
      soldier(mb, C.banner, C.iron);
      mb.cyl(0.025, 0.025, 1.6, 4, C.wood, 0.28, 0.1, 0.15, { rx: 0.35 }).cone(0.06, 0.25, 4, C.iron, 0.28, 1.45, 0.6, { rx: 0.35 });
      mb.boxB(0.08, 0.4, 0.3, C.gold, -0.28, 0.25, 0.05);
      break;
    case 'swordsman':
      soldier(mb, 0x3f62b8, C.iron);
      mb.boxB(0.06, 0.55, 0.12, C.iron, 0.3, 0.35, 0.2, { rx: 0.5 });
      mb.boxB(0.1, 0.5, 0.42, C.banner, -0.3, 0.2, 0.05).boxB(0.11, 0.12, 0.12, C.gold, -0.3, 0.42, 0.05);
      break;
    case 'bowman':
      soldier(mb, 0x5aa36b, 0x4b7d55);
      mb.boxB(0.05, 0.75, 0.05, C.woodDark, 0.28, 0.2, 0.1, { rx: 0.15 });
      mb.boxB(0.12, 0.4, 0.12, C.woodDark, -0.05, 0.4, -0.27, { rx: -0.3 });
      break;
    case 'crossbowman':
      soldier(mb, 0x3e8d8a, C.iron);
      mb.boxB(0.12, 0.1, 0.5, C.woodDark, 0.18, 0.5, 0.3).boxB(0.5, 0.06, 0.06, C.iron, 0.18, 0.58, 0.48);
      break;
    case 'grunt':
      mb.cone(0.34, 0.85, 6, MIST, 0, 0, 0);
      mb.ico(0.22, MIST2, 0, 0.92, 0);
      eyes(mb, 0.95, 0.19);
      mb.cyl(0.05, 0.09, 0.6, 5, C.woodDark, 0.3, 0.3, 0.15, { rx: 0.6 });
      break;
    case 'runner':
      mb.cone(0.24, 0.75, 5, MIST3, 0, 0, 0, { rx: 0.25 });
      mb.ico(0.17, MIST, 0, 0.8, 0.12);
      eyes(mb, 0.82, 0.28, 0.07);
      mb.cone(0.08, 0.3, 4, MIST2, -0.12, 0.85, -0.05, { rz: 0.6 }).cone(0.08, 0.3, 4, MIST2, 0.12, 0.85, -0.05, { rz: -0.6 });
      break;
    case 'shieldbearer':
      mb.cone(0.42, 0.95, 6, MIST2, 0, 0, 0);
      mb.ico(0.24, MIST, 0, 1.02, 0);
      eyes(mb, 1.04, 0.2);
      mb.boxB(0.75, 0.9, 0.12, 0x6f6b8a, 0, 0.15, 0.42).boxB(0.2, 0.2, 0.06, C.gold, 0, 0.55, 0.49);
      break;
    case 'skirmisher':
      mb.cone(0.3, 0.8, 6, 0x6a5698, 0, 0, 0);
      mb.ico(0.19, MIST2, 0, 0.88, 0);
      mb.cone(0.24, 0.4, 6, 0x3d3263, 0, 0.88, -0.02);
      eyes(mb, 0.88, 0.17);
      mb.boxB(0.05, 0.7, 0.05, C.woodDark, 0.28, 0.25, 0.1);
      break;
    case 'ram':
      mb.cyl(0.3, 0.3, 2.0, 7, C.woodDark, 0, 0.55, -0.2, { rx: Math.PI / 2 });
      mb.cone(0.32, 0.35, 7, C.iron, 0, 0.55, 0.95, { rx: Math.PI / 2 });
      mb.boxB(1.0, 0.12, 1.6, 0x4a3a2c, 0, 0.25, -0.2);
      for (const [x, z] of [[-0.55, 0.3], [0.55, 0.3], [-0.55, -0.7], [0.55, -0.7]]) mb.cyl(0.24, 0.24, 0.1, 8, 0x3a2e24, x, 0.24, z, { rz: Math.PI / 2 });
      mb.roof(1.2, 0.6, 1.8, MIST2, 0, 0.9, -0.2, { ry: Math.PI / 2 });
      eyes(mb, 0.95, -1.1, 0.12);
      break;
    case 'wisp':
      mb.ico(0.32, MIST3, 0, 0, 0, {}, 0);
      mb.oct(0.16, 0xd9b8ff, 0, 0, 0.2, { glow: 2.4 });
      mb.box(0.6, 0.04, 0.25, MIST, -0.45, 0.1, -0.05, { rz: 0.4 }).box(0.6, 0.04, 0.25, MIST, 0.45, 0.1, -0.05, { rz: -0.4 });
      eyes(mb, 0.08, 0.28, 0.1);
      break;
    case 'raider':
      mb.cone(0.36, 0.85, 6, 0x6e4f86, 0, 0, 0, { rx: 0.2 });
      mb.ico(0.21, MIST2, 0, 0.88, 0.12);
      eyes(mb, 0.9, 0.3);
      mb.cyl(0.04, 0.04, 0.7, 4, C.woodDark, 0.32, 0.4, 0.2, { rx: 0.4 }).oct(0.12, C.fire, 0.32, 1.12, 0.35, { glow: 2.4 });
      break;
    case 'giant':
      mb.boxB(0.9, 0.9, 0.6, MIST2, 0, 0.45, 0);
      mb.boxB(0.28, 0.5, 0.28, MIST, -0.25, 0, 0).boxB(0.28, 0.5, 0.28, MIST, 0.25, 0, 0);
      mb.ico(0.3, MIST, 0, 1.55, 0.05);
      eyes(mb, 1.58, 0.3, 0.11);
      mb.boxB(0.25, 0.7, 0.25, MIST, -0.6, 0.6, 0).boxB(0.25, 0.7, 0.25, MIST, 0.6, 0.6, 0.1);
      mb.cyl(0.08, 0.2, 1.1, 6, C.woodDark, 0.7, 0.1, 0.35, { rx: 0.7 });
      break;
    case 'boss_warlord':
      mb.boxB(1.0, 1.0, 0.7, 0x3d2f63, 0, 0.45, 0);
      mb.boxB(0.3, 0.5, 0.3, MIST2, -0.28, 0, 0).boxB(0.3, 0.5, 0.3, MIST2, 0.28, 0, 0);
      mb.ico(0.32, MIST, 0, 1.68, 0.05);
      eyes(mb, 1.7, 0.32, 0.12, 0xff6a5a);
      mb.cone(0.08, 0.45, 4, 0xe9e2d0, -0.3, 1.8, 0, { rz: 0.6 }).cone(0.08, 0.45, 4, 0xe9e2d0, 0.3, 1.8, 0, { rz: -0.6 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mb.cone(0.05, 0.16, 4, C.gold, Math.sin(a) * 0.22, 1.9, 0.05 + Math.cos(a) * 0.22, { glow: 1.6 }); }
      mb.boxB(0.28, 0.75, 0.28, MIST2, -0.68, 0.6, 0).boxB(0.28, 0.75, 0.28, MIST2, 0.68, 0.6, 0.1);
      mb.boxB(0.12, 1.2, 0.5, C.iron, 0.78, 0.4, 0.45, { rx: 0.6 });
      break;
    case 'boss_hag':
      mb.cone(0.6, 1.5, 7, 0x3e5a4e, 0, 0, 0);
      mb.ico(0.27, 0x2f4a40, 0, 1.6, 0);
      mb.cone(0.36, 0.6, 7, 0x24382f, 0, 1.6, -0.03, { rx: -0.2 });
      eyes(mb, 1.6, 0.24, 0.1, 0x9dff9a);
      mb.cyl(0.04, 0.04, 1.9, 4, C.woodDark, 0.5, 0, 0.2).oct(0.2, 0x8dff8a, 0.5, 2.0, 0.2, { glow: 2.5 });
      break;
    case 'boss_colossus':
      mb.dodec(0.75, 0x7d7690, 0, 0.95, 0, { sy: 1.1 });
      mb.dodec(0.38, 0x8b84a0, 0, 1.95, 0.1);
      mb.dodec(0.32, 0x6c6680, -0.85, 1.1, 0).dodec(0.32, 0x6c6680, 0.85, 1.1, 0);
      mb.dodec(0.3, 0x6c6680, -0.35, 0.25, 0).dodec(0.3, 0x6c6680, 0.35, 0.25, 0);
      eyes(mb, 2.0, 0.42, 0.13, 0x8fe8ff);
      mb.box(0.5, 0.06, 0.06, 0x8fe8ff, 0, 1.2, 0.68, { glow: 2.2 });
      break;
  }
  g = mb.build();
  if (!ALLY_LOOK.has(id)) {
    // Mist creatures shimmer faintly at night so they read against dark ground.
    const gl = g.getAttribute('glow') as THREE.BufferAttribute;
    for (let i = 0; i < gl.count; i++) if (gl.getX(i) === 0) gl.setX(i, 0.28);
  }
  cache.set(key, g);
  return g;
}

const ALLY_LOOK = new Set(['militia', 'spearman', 'swordsman', 'bowman', 'crossbowman']);

// ------------------------------------------------------------------ projectiles / props
export function projectileGeometry(kind: string): THREE.BufferGeometry {
  const key = `proj:${kind}`;
  let g = cache.get(key);
  if (g) return g;
  const mb = new MB();
  switch (kind) {
    case 'arrow': mb.box(0.05, 0.05, 0.75, C.woodLight, 0, 0, 0).cone(0.06, 0.16, 4, C.iron, 0, -0.08, 0.4, { rx: Math.PI / 2 }).box(0.14, 0.02, 0.14, C.white, 0, 0, -0.33); break;
    case 'bolt': mb.box(0.1, 0.1, 1.3, C.woodDark, 0, 0, 0).cone(0.13, 0.3, 4, C.iron, 0, -0.15, 0.7, { rx: Math.PI / 2 }); break;
    case 'dart': mb.box(0.05, 0.05, 0.6, 0x3d3263, 0, 0, 0).cone(0.06, 0.15, 4, 0xd9b8ff, 0, -0.07, 0.32, { rx: Math.PI / 2, glow: 2 }); break;
    case 'rock': mb.dodec(0.3, C.slate, 0, 0, 0); break;
    default: {
      const col = kind === 'frost' ? C.ice : kind === 'fire' ? C.ember : kind === 'hex' ? 0x8dff8a : kind === 'star' ? 0xfff2a8 : C.arcane;
      mb.ico(kind === 'star' ? 0.22 : 0.26, col, 0, 0, 0, { glow: 2.8 });
    }
  }
  g = mb.build();
  cache.set(key, g);
  return g;
}

export function coinGeometry(): THREE.BufferGeometry {
  let g = cache.get('coin');
  if (!g) {
    g = new MB().cyl(0.22, 0.22, 0.07, 10, C.gold, 0, -0.035, 0, { rx: Math.PI / 2, glow: 1.7 }).build();
    cache.set('coin', g);
  }
  return g;
}

export type TreeGeo = { geo: THREE.BufferGeometry; hMax: number };
export function treeGeometry(kind: string, leaf: number): THREE.BufferGeometry {
  const key = `tree:${kind}:${leaf}`;
  let g = cache.get(key);
  if (g) return g;
  const mb = new MB();
  switch (kind) {
    case 'pine':
      mb.cyl(0.12, 0.16, 0.6, 4, C.woodDark, 0, 0, 0);
      mb.cone(0.95, 1.5, 5, leaf, 0, 0.5, 0).cone(0.68, 1.3, 5, leaf, 0, 1.25, 0, { ry: 0.6 }).cone(0.4, 1.0, 5, leaf, 0, 1.95, 0);
      break;
    case 'snowpine':
      mb.cyl(0.12, 0.16, 0.6, 4, C.woodDark, 0, 0, 0);
      mb.cone(0.95, 1.5, 5, leaf, 0, 0.5, 0).cone(0.68, 1.3, 5, leaf, 0, 1.25, 0, { ry: 0.6 }).cone(0.4, 0.8, 5, 0xf4f6ff, 0, 2.0, 0);
      break;
    case 'birch':
      mb.cyl(0.08, 0.11, 1.4, 4, 0xeeeae0, 0, 0, 0);
      mb.ico(0.62, leaf, 0, 1.85, 0, { sy: 1.25 });
      break;
    case 'willow':
      mb.cyl(0.14, 0.2, 1.0, 4, C.woodDark, 0, 0, 0);
      mb.ico(0.95, leaf, 0, 1.5, 0, { sy: 0.75 });
      mb.cone(0.95, 1.0, 6, leaf, 0, 0.55, 0, { rx: Math.PI });
      break;
    case 'dead':
      mb.cyl(0.08, 0.15, 1.5, 4, 0x8a7a6a, 0, 0, 0);
      mb.cyl(0.04, 0.06, 0.7, 3, 0x8a7a6a, 0.22, 1.0, 0, { rz: -0.8 }).cyl(0.04, 0.06, 0.6, 3, 0x8a7a6a, -0.2, 1.2, 0, { rz: 0.9 });
      break;
    default:
      mb.cyl(0.13, 0.18, 0.8, 4, C.woodDark, 0, 0, 0);
      mb.ico(0.9, leaf, 0, 1.5, 0);
  }
  g = mb.build();
  cache.set(key, g);
  return g;
}

// ------------------------------------------------------------------ hero
export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Mesh[];
  rider: THREE.Group;
  weapon: THREE.Group;
  cape: THREE.Mesh;
}

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}

export function buildHero(material: THREE.Material, weapon: string): HeroRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const horse = () => new MB()
    .boxB(0.55, 0.5, 1.3, 0xf3efe8, 0, 0.75, 0)
    .boxB(0.3, 0.6, 0.35, 0xf3efe8, 0, 1.05, 0.62, { rx: 0.5 })
    .boxB(0.28, 0.28, 0.55, 0xf3efe8, 0, 1.5, 0.9, { rx: 0.2 })
    .boxB(0.1, 0.5, 0.36, 0x8a6a4a, 0, 1.25, 0.55, { rx: 0.5 })
    .cone(0.1, 0.55, 4, 0x8a6a4a, 0, 0.75, -0.75, { rx: -2.4 })
    .boxB(0.6, 0.12, 0.6, C.banner, 0, 1.22, -0.05)
    .boxB(0.62, 0.3, 0.05, C.gold, 0, 0.95, 0.3)
    .box(0.04, 0.04, 0.04, 0x222233, -0.14, 1.66, 1.08).box(0.04, 0.04, 0.04, 0x222233, 0.14, 1.66, 1.08)
    .build();
  const horseMesh = new THREE.Mesh(cached('hero:horse', horse), material);
  horseMesh.castShadow = true;
  body.add(horseMesh);
  const legGeo = cached('hero:leg', () => new MB().boxB(0.13, 0.8, 0.13, 0xe6e0d6, 0, -0.8, 0).boxB(0.15, 0.1, 0.15, 0x6a5a4a, 0, -0.8, 0).build());
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.48], [0.18, -0.48]]) {
    const leg = new THREE.Mesh(legGeo, material);
    leg.position.set(x, 0.8, z);
    leg.castShadow = true;
    body.add(leg);
    legs.push(leg);
  }
  const rider = new THREE.Group();
  rider.position.set(0, 1.25, -0.05);
  const riderMesh = new THREE.Mesh(
    cached('hero:rider', () => new MB()
      .cyl(0.2, 0.26, 0.6, 6, C.banner, 0, 0.05, 0)
      .boxB(0.5, 0.12, 0.2, C.gold, 0, 0.5, 0)
      .ico(0.18, C.skin, 0, 0.82, 0)
      .cyl(0.2, 0.2, 0.1, 7, C.gold, 0, 0.94, 0, { glow: 1.6 })
      .cone(0.05, 0.12, 4, C.gold, 0.12, 1.02, 0).cone(0.05, 0.12, 4, C.gold, -0.12, 1.02, 0).cone(0.05, 0.12, 4, C.gold, 0, 1.02, 0.12)
      .boxB(0.1, 0.4, 0.12, C.banner, -0.22, 0.2, 0.05).boxB(0.1, 0.4, 0.12, C.banner, 0.22, 0.2, 0.05)
      .build()),
    material,
  );
  riderMesh.castShadow = true;
  rider.add(riderMesh);
  const cape = new THREE.Mesh(cached('hero:cape', () => new MB().box(0.5, 0.7, 0.04, C.bannerRed, 0, -0.35, 0).build()), material);
  cape.position.set(0, 0.6, -0.2);
  cape.castShadow = true;
  rider.add(cape);
  const wpn = new THREE.Group();
  wpn.position.set(0.3, 0.45, 0.1);
  wpn.add(new THREE.Mesh(weaponGeometry(weapon), material));
  rider.add(wpn);
  body.add(rider);
  return { root, body, legs, rider, weapon: wpn, cape };
}

export function weaponGeometry(weapon: string): THREE.BufferGeometry {
  const key = `weapon:${weapon}`;
  let g = cache.get(key);
  if (g) return g;
  const mb = new MB();
  switch (weapon) {
    case 'bow': {
      // Curved limbs from short segments + string
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a0 = -0.95 + (i / n) * 1.9, a1 = -0.95 + ((i + 1) / n) * 1.9;
        const y0 = Math.sin(a0) * 0.55, z0 = Math.cos(a0) * 0.22 - 0.22, y1 = Math.sin(a1) * 0.55, z1 = Math.cos(a1) * 0.22 - 0.22;
        const len = Math.hypot(y1 - y0, z1 - z0);
        mb.box(0.07, len + 0.02, 0.08, i === 3 ? C.gold : C.woodDark, 0, (y0 + y1) / 2 + 0.2, (z0 + z1) / 2, { rx: -Math.atan2(z1 - z0, y1 - y0) });
      }
      mb.box(0.015, 0.9, 0.015, C.white, 0, 0.2, -0.3);
      break;
    }
    case 'spear':
      mb.cyl(0.035, 0.04, 1.7, 5, C.wood, 0, -0.55, 0);
      mb.oct(0.12, C.iron, 0, 1.3, 0, { sy: 2.4, sx: 0.8, sz: 0.4 });
      mb.box(0.2, 0.06, 0.06, C.gold, 0, 1.12, 0);
      mb.box(0.03, 0.22, 0.14, C.bannerRed, 0, 0.98, 0.08);
      break;
    case 'staff':
      mb.cyl(0.04, 0.05, 1.5, 5, C.woodLight, 0, -0.45, 0);
      mb.cyl(0.07, 0.05, 0.14, 6, C.gold, 0, 0.98, 0);
      mb.oct(0.17, 0xfff2a8, 0, 1.22, 0, { glow: 2.6, sy: 1.3 });
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; mb.cone(0.03, 0.22, 3, C.gold, Math.sin(a) * 0.08, 1.02, Math.cos(a) * 0.08, { rz: Math.sin(a) * 0.5, rx: Math.cos(a) * 0.5 }); }
      break;
    default:
      mb.box(0.06, 0.95, 0.2, 0xd9dde8, 0, 0.55, 0);
      mb.cone(0.1, 0.18, 4, 0xd9dde8, 0, 1.02, 0, { ry: Math.PI / 4, sz: 0.3 });
      mb.box(0.1, 0.07, 0.48, C.gold, 0, 0.06, 0);
      mb.box(0.07, 0.24, 0.07, C.woodDark, 0, -0.1, 0);
      mb.ico(0.06, C.gold, 0, -0.25, 0);
  }
  g = mb.build();
  cache.set(key, g);
  return g;
}
