import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import type { Palette } from '../data/maps';
import { worldUniforms } from './material';

export type Quality = 'high' | 'medium' | 'low';
export type QualitySetting = Quality | 'auto';

const _a = new THREE.Color();
const _b = new THREE.Color();

/** Renderer, scene, camera rig, lights, sky/fog and automatic quality scaling. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.4);
  readonly hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 1.3);
  readonly fog = new THREE.Fog(0xcfe6ee, 60, 150);
  quality: Quality = 'high';
  setting: QualitySetting = 'auto';
  /** 1 = full day, 0 = deep night. */
  dayness = 1;
  dayTarget = 1;
  private palette: Palette | null = null;
  // Camera rig
  readonly target = new THREE.Vector3();
  readonly yaw = Math.PI / 4;
  pitch = 0.92;
  distance = 46;
  zoom = 1;
  private focus = new THREE.Vector3();
  private w = 1;
  private h = 1;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private lowStreak = 0;
  private highStreak = 0;
  onQualityChange: ((q: Quality) => void) | null = null;
  readonly qualityListeners = new Set<(q: Quality) => void>();

  constructor(readonly canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xcfe6ee);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.applyQuality('high');
  }

  setPalette(p: Palette): void { this.palette = p; }

  setQualitySetting(s: QualitySetting): void {
    this.setting = s;
    if (s !== 'auto') this.applyQuality(s);
    else this.applyQuality(this.guessQuality());
  }

  private guessQuality(): Quality {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
    return mobile ? 'medium' : 'high';
  }

  applyQuality(q: Quality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    const pr = q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'needsUpdate' in m) m.needsUpdate = true;
    });
    this.resize(this.w, this.h);
    this.onQualityChange?.(q);
    this.qualityListeners.forEach((f) => f(q));
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    // Portrait: pull the camera back so the battlefield stays readable.
    const portrait = this.h > this.w;
    this.camera.fov = portrait ? 44 : 32;
    this.distance = portrait ? 60 : this.w / this.h < 1.5 ? 58 : 54;
    this.camera.updateProjectionMatrix();
  }

  get aspect(): number { return this.w / this.h; }

  /** Smoothly follow a point. */
  follow(x: number, y: number, z: number, dt: number, snap = false): void {
    this.focus.set(x, y, z);
    if (snap) this.target.copy(this.focus);
    else this.target.lerp(this.focus, 1 - Math.pow(0.0025, dt));
  }

  updateCamera(shake: number, time: number): void {
    const d = this.distance * this.zoom;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const sx = shake > 0 ? (Math.sin(time * 61) + Math.sin(time * 37)) * shake * 0.25 : 0;
    const sy = shake > 0 ? Math.sin(time * 53) * shake * 0.25 : 0;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * d + sx,
      this.target.y + sp * d + sy,
      this.target.z + Math.cos(this.yaw) * cp * d - sx,
    );
    this.camera.lookAt(this.target.x + sx * 0.5, this.target.y, this.target.z);
    // Fog hugs the view distance so map edges dissolve.
    this.fog.near = d * 0.95;
    this.fog.far = d * 2.3;
    // Shadow camera follows the view target (snapped to texels to avoid shimmer).
    const texel = (68 / this.sun.shadow.mapSize.x) * 2;
    const tx = Math.round(this.target.x / texel) * texel, tz = Math.round(this.target.z / texel) * texel;
    const sunDir = this.sunDirection();
    this.sun.position.set(tx + sunDir.x * 60, sunDir.y * 60, tz + sunDir.z * 60);
    this.sun.target.position.set(tx, 0, tz);
  }

  private sunDir = new THREE.Vector3();
  private sunDirection(): THREE.Vector3 {
    // Sun swings lower and warmer near dusk; moonlight comes from the other side.
    const d = this.dayness;
    const ang = lerp(-0.9, 0.55, d);
    const elev = lerp(0.95, 1.05, d);
    return this.sunDir.set(Math.sin(ang) * 0.9, elev, Math.cos(ang) * 0.6 + 0.2).normalize();
  }

  /** Lighting blend between day, golden hour and night. */
  updateLighting(dt: number): void {
    this.dayness += (this.dayTarget - this.dayness) * Math.min(1, dt * 0.9);
    const d = clamp(this.dayness, 0, 1);
    const p = this.palette;
    const golden = Math.max(0, 1 - Math.abs(d - 0.5) * 2.4);
    // Sun
    _a.set(0xfff3e0).lerp(_b.set(0x8eaaff), 1 - d);
    _a.lerp(_b.set(0xffa86b), golden * 0.8);
    this.sun.color.copy(_a);
    this.sun.intensity = lerp(1.35, 2.5, d);
    // Hemisphere
    this.hemi.color.set(0xd6ecff).lerp(_b.set(0x7686d8), 1 - d).lerp(_a.set(0xffc49a), golden * 0.5);
    this.hemi.groundColor.set(0x8f8470).lerp(_b.set(0x2e2856), 1 - d);
    this.hemi.intensity = lerp(1.2, 1.35, d);
    // Sky & fog
    if (p) {
      _a.set(p.fogDay).lerp(_b.set(p.fogNight), 1 - d).lerp(_b.set(0xf2b38c), golden * 0.45);
      this.fog.color.copy(_a);
      (this.scene.background as THREE.Color).copy(_a);
    }
    worldUniforms.uNight.value = clamp((0.75 - d) / 0.55, 0, 1);
  }

  render(): void { this.renderer.render(this.scene, this.camera); }

  /** Auto quality: step down when FPS stays low, step up when there is headroom. */
  trackFps(dt: number): void {
    if (this.setting !== 'auto' || dt <= 0) return;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc < 2.5) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    if (document.hidden) return;
    if (fps < 42) { this.lowStreak++; this.highStreak = 0; } else if (fps > 58) { this.highStreak++; this.lowStreak = 0; } else { this.lowStreak = 0; this.highStreak = 0; }
    if (this.lowStreak >= 2 && this.quality !== 'low') {
      this.lowStreak = 0;
      this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
    } else if (this.highStreak >= 8 && this.quality === 'low') {
      this.highStreak = 0;
      this.applyQuality('medium');
    }
  }

  /** World → CSS pixel coordinates. */
  private projTmp = new THREE.Vector3();
  project(v: THREE.Vector3, out: { x: number; y: number; behind: boolean }): typeof out {
    const p = this.projTmp.copy(v).project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.w;
    out.y = (-p.y * 0.5 + 0.5) * this.h;
    out.behind = p.z > 1;
    return out;
  }

  /** Ray from screen point onto the y=0 plane. */
  groundPoint(sx: number, sy: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (!isFinite(t) || t < 0) return null;
    return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
  }

  dispose(): void { this.renderer.dispose(); }
}
