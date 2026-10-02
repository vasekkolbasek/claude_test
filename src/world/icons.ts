import * as THREE from 'three';
import type { BNode } from '../data/buildings';
import type { UnitId } from '../data/units';
import { makeWorldMaterial } from './material';
import { buildingGeometry, unitGeometry, weaponGeometry } from './models';

/**
 * Renders the procedural models into small PNG data URLs for the DOM UI
 * (wave previews, upgrade cards, weapon cards). Uses a tiny dedicated renderer.
 */
export class IconRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  private mesh: THREE.Mesh;
  private cache = new Map<string, string>();
  private canvas: HTMLCanvasElement;
  private material = makeWorldMaterial();

  constructor(size = 128) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(size, size, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0);
    } catch {
      this.renderer = null;
    }
    const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x8a7f6a, 1.6);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 4);
    this.scene.add(hemi, sun);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.scene.add(this.mesh);
  }

  private shoot(key: string, geo: THREE.BufferGeometry, yaw = 0.6, pitch = 0.42): string {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    if (!this.renderer) { this.cache.set(key, ''); return ''; }
    this.mesh.geometry = geo;
    this.mesh.rotation.y = yaw;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
    const d = r / Math.sin((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(center.x, center.y + Math.sin(pitch) * d, center.z + Math.cos(pitch) * d);
    this.camera.lookAt(center);
    this.renderer.render(this.scene, this.camera);
    let url = '';
    try { url = this.canvas.toDataURL('image/png'); } catch { url = ''; }
    this.cache.set(key, url);
    return url;
  }

  unit(id: UnitId): string { return this.shoot(`u:${id}`, unitGeometry(id), 0.5, 0.25); }
  building(n: BNode): string { return this.shoot(`b:${n.kind}:${n.look}:${n.tier}`, buildingGeometry(n.kind, n.look, n.tier), 0.65, 0.5); }
  weapon(id: string): string { return this.shoot(`w:${id}`, weaponGeometry(id), 1.2, 0.2); }

  dispose(): void {
    this.material.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
  }
}
