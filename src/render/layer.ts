import { Particle, ParticleContainer, type Texture } from 'pixi.js';

export function bgr(rgb: number): number {
  return ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);
}

/**
 * Immediate-mode wrapper over a ParticleContainer: call begin(), add() quads, end().
 * All layers share one atlas texture so each layer is a single draw call.
 */
export class QuadLayer {
  readonly pc: ParticleContainer;
  private readonly pool: Particle[] = [];
  private n = 0;
  private cap: number;

  constructor(base: Texture, blend: 'add' | 'normal', cap = 4000) {
    this.cap = cap;
    this.pc = new ParticleContainer({
      texture: base,
      dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true },
    });
    this.pc.blendMode = blend;
  }

  begin(): void {
    this.n = 0;
  }

  get count(): number {
    return this.n;
  }

  add(tex: Texture, x: number, y: number, sx: number, sy: number, rot: number, color: number, alpha: number, ax = 0.5, ay = 0.5): void {
    if (this.n >= this.cap) return;
    let p = this.pool[this.n];
    if (!p) {
      p = new Particle({ texture: tex });
      this.pool.push(p);
    }
    p.texture = tex;
    p.x = x;
    p.y = y;
    p.scaleX = sx;
    p.scaleY = sy;
    p.rotation = rot;
    p.anchorX = ax;
    p.anchorY = ay;
    const a = alpha <= 0 ? 0 : alpha >= 1 ? 255 : (alpha * 255) | 0;
    p.color = bgr(color) + (a << 24);
    this.n++;
  }

  end(): void {
    const ch = this.pc.particleChildren;
    const n = this.n;
    if (ch.length !== n) ch.length = n;
    for (let i = 0; i < n; i++) ch[i] = this.pool[i];
  }
}
