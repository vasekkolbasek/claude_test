import * as THREE from 'three';
import type { UnitId } from '../data/units';
import { makeWorldMaterial, worldUniforms } from './material';
import { MB, buildHero, buildingGeometry, treeGeometry, unitGeometry } from './models';

/**
 * Promotional art (store icon / cover): a floating-island diorama built from the game's own
 * procedural models, rendered with a transparent background and composed over a painted
 * CSS sky. Only used with the `?promo=` URL parameter by the release screenshot script.
 */
export function renderDiorama(size: number, opts: { enemies: boolean; yaw: number; pitch: number; zoom: number; night: number }): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const mat = makeWorldMaterial();
  const prevNight = worldUniforms.uNight.value;
  worldUniforms.uNight.value = opts.night;

  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x5a4a7a, 1.25);
  const sun = new THREE.DirectionalLight(0xffc48a, 2.6);
  sun.position.set(-14, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0005;
  const rim = new THREE.DirectionalLight(0x9db4ff, 1.1);
  rim.position.set(12, 8, -12);
  scene.add(hemi, sun, rim);

  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.scale.setScalar(s);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Island
  const island = new MB();
  let seed = 7;
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  island.cyl(10.5, 10.8, 0.6, 18, 0x9fd07a, 0, -0.6, 0);
  island.cyl(10.8, 7.5, 2.6, 14, 0xb59a7a, 0, -3.2, 0);
  island.cyl(7.5, 2.5, 4.2, 10, 0x9a8f9e, 0, -7.4, 0);
  island.cone(2.5, 2.4, 8, 0x8a8094, 0, -9.8, 0, { rx: Math.PI });
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 6 + r() * 3.5;
    island.dodec(0.9 + r() * 1.2, r() < 0.5 ? 0xa59cae : 0xb8ae9e, Math.cos(a) * d, -3 - r() * 4, Math.sin(a) * d);
  }
  // Dirt road and plaza
  island.cyl(4.2, 4.2, 0.62, 16, 0xe0c48e, 0, -0.58, 0);
  island.boxB(2.2, 0.62, 7.5, 0xe0c48e, 0, -0.58, 6, { ry: 0.15 });
  island.boxB(2.2, 0.62, 6.5, 0xe0c48e, -6.2, -0.58, -2.2, { ry: 1.2 });
  add(island.build(), 0, 0, 0);

  add(buildingGeometry('castle', 'citadel', 2), 0, 0, 0, Math.PI / 4, 1.05);
  add(buildingGeometry('tower', 'archer', 2), -5.8, 0, 3.4, 0.3);
  add(buildingGeometry('magic', 'frost', 2), 6.0, 0, -3.2, 0);
  add(buildingGeometry('wall', 'stone', 2), 3.6, 0, 6.6, -0.4);
  add(buildingGeometry('farm', 'mill', 2), -5.2, 0, -5.4, 0.8);
  add(buildingGeometry('barracks', 'sword', 1), 6.2, 0, 3.0, -0.9, 0.9);
  for (const [x, z, k, s] of [[-8.6, 1, 'round', 1.3], [-7.8, -2.5, 'pine', 1.2], [8.4, -0.6, 'round', 1.1], [-2.5, -8.6, 'pine', 1.4], [2.5, -8.8, 'round', 1.2], [8.2, -5.6, 'pine', 1.0], [-8.2, 5.8, 'birch', 1.1], [0.5, 9.2, 'round', 1.0]] as const) {
    add(treeGeometry(k, k === 'pine' ? 0x5aa86a : 0x6fbf73), x, 0, z, r() * 6, s);
  }
  const hero = buildHero(mat, 'sword');
  hero.root.position.set(1.8, 0, 4.4);
  hero.root.rotation.y = 0.5;
  hero.root.scale.setScalar(1.5);
  hero.root.traverse((o) => { o.castShadow = true; });
  scene.add(hero.root);
  for (const [id, x, z, ry] of [['spearman', 4.4, 4.6, 0.6], ['swordsman', -2.8, 5.4, 0.2], ['bowman', -4.2, 2.2, 0.4]] as [UnitId, number, number, number][]) {
    add(unitGeometry(id), x, 0, z, ry, 1.5);
  }
  if (opts.enemies) {
    for (const [id, x, z, s] of [['grunt', 8.5, 6.5, 1.5], ['grunt', 9.6, 4.6, 1.5], ['runner', 7.6, 8.2, 1.5], ['giant', 10.4, 7.8, 1.4], ['shieldbearer', 6.4, 9.2, 1.5]] as [UnitId, number, number, number][]) {
      add(unitGeometry(id), x, 0, z, Math.atan2(-x, -z), s);
    }
  }

  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  const d = 52 / opts.zoom;
  cam.position.set(Math.sin(opts.yaw) * Math.cos(opts.pitch) * d, Math.sin(opts.pitch) * d - 1, Math.cos(opts.yaw) * Math.cos(opts.pitch) * d);
  cam.lookAt(0, -1.8, 0);
  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/png');
  worldUniforms.uNight.value = prevNight;
  mat.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}

/** Builds the promo page (icon or cover) on top of everything. */
export function showPromo(kind: string, title: string): void {
  const icon = kind === 'icon';
  const W = window.innerWidth, H = window.innerHeight;
  const art = renderDiorama(icon ? 1024 : 1024, icon
    ? { enemies: false, yaw: Math.PI / 4 + 0.1, pitch: 0.52, zoom: 1.08, night: 0.25 }
    : { enemies: true, yaw: Math.PI / 4 - 0.2, pitch: 0.46, zoom: 1.0, night: 0.35 });
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:1000;overflow:hidden;background:
    radial-gradient(circle at ${icon ? '50% 30%' : '72% 26%'}, rgba(255,236,190,.95) 0, rgba(255,200,150,.55) ${icon ? 18 : 12}%, rgba(255,170,140,0) ${icon ? 36 : 28}%),
    linear-gradient(180deg, #4a3f8f 0%, #8a6fb8 34%, #f0a88a 70%, #ffd9a0 100%);`;
  // Stars
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('div');
    const x = (i * 73) % 100, y = (i * 37) % 45;
    s.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${1 + (i % 3)}px;height:${1 + (i % 3)}px;border-radius:50%;background:#fff;opacity:${0.35 + (i % 5) * 0.12}`;
    root.appendChild(s);
  }
  const img = document.createElement('img');
  img.src = art;
  if (icon) img.style.cssText = `position:absolute;left:50%;top:55%;width:${W * 1.08}px;height:${W * 1.08}px;transform:translate(-50%,-50%);`;
  else img.style.cssText = `position:absolute;right:${-W * 0.07}px;top:50%;width:${H * 1.42}px;height:${H * 1.42}px;transform:translateY(-46%);`;
  root.appendChild(img);
  if (!icon) {
    const t = document.createElement('div');
    t.style.cssText = `position:absolute;left:${W * 0.05}px;top:50%;transform:translateY(-55%);width:${W * 0.5}px;font-family:Kurale,Georgia,serif;color:#fff;`;
    t.innerHTML = `<div style="font-size:${H * 0.17}px;line-height:.95;color:#fff;text-shadow:0 ${H * 0.012}px 0 #4a3a7a, 0 ${H * 0.03}px ${H * 0.05}px rgba(30,10,60,.55)">${title.split(' ')[0]}</div>
      <div style="font-size:${H * 0.19}px;line-height:.95;color:#ffe08a;text-shadow:0 ${H * 0.012}px 0 #7a4a2a, 0 ${H * 0.03}px ${H * 0.05}px rgba(30,10,60,.55)">${title.split(' ').slice(1).join(' ')}</div>`;
    root.appendChild(t);
  }
  document.body.appendChild(root);
}
