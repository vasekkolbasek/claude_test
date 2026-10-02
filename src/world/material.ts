import * as THREE from 'three';

/** Uniforms shared by every world material (night glow, time for water/wind). */
export const worldUniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

/**
 * Flat-shaded Lambert material with vertex colors and a per-vertex `glow` attribute:
 *  glow in (0..1]  → emissive at night only (windows, torches)
 *  glow > 1.5      → always emissive (eyes, crystals, coins)
 */
export function makeWorldMaterial(opts: { transparent?: boolean; opacity?: number } = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = worldUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat gl = vGlow > 1.5 ? (vGlow - 1.0) * (0.55 + 0.45 * uNight) : vGlow * uNight;\ntotalEmissiveRadiance += vColor.rgb * gl * 1.35;',
      );
  };
  m.customProgramCacheKey = () => 'world-glow' + (opts.transparent ? '-t' : '');
  return m;
}

/** Water: flat-shaded, gently waving surface. */
export function makeWaterMaterial(color: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: true, opacity: 0.82 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.y += sin(position.x * 0.55 + uTime * 1.1) * 0.07 + cos(position.z * 0.45 + uTime * 0.8) * 0.07;',
      );
  };
  m.customProgramCacheKey = () => 'water';
  return m;
}
