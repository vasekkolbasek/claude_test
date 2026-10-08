import { describe, expect, it } from 'vitest';
import { SpatialHash, type GridItem } from '../../src/core/grid';
import { hypot, Rng } from '../../src/core/math';

describe('performance rewrites keep the exact behaviour', () => {
  it('the RNG sequence is unchanged (saved runs, the simulator and seeds depend on it)', () => {
    const r = new Rng(12345);
    const a = [0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061, 0.34747186047025025];
    for (const v of a) expect(r.next()).toBe(v);
    // the uint32 state wraps around exactly as before
    const w = new Rng(0xfffffff0);
    for (const v of [0.8736195750534534, 0.6622341722249985, 0.8231762400828302]) expect(w.next()).toBe(v);
  });

  it('hypot(x, y) is bit-identical to Math.hypot (the simulation must not drift)', () => {
    const r = new Rng(7);
    const special = [0, -0, 1, -1, 1e-320, 5e-324, 1e-200, 1e200, 1.7976931348623157e308, Infinity, -Infinity, NaN, 3, 4, 0.1, 0.2];
    for (const a of special) for (const b of special) expect(Object.is(hypot(a, b), Math.hypot(a, b))).toBe(true);
    for (let i = 0; i < 200_000; i++) {
      const scale = 10 ** Math.floor(r.next() * 12 - 6);
      const a = (r.next() - 0.5) * scale * 2000;
      const b = (r.next() - 0.5) * scale * (r.next() < 0.1 ? 1e-6 : 2000);
      if (hypot(a, b) !== Math.hypot(a, b)) throw new Error(`hypot(${a}, ${b}) = ${hypot(a, b)} != ${Math.hypot(a, b)}`);
    }
  });

  it('a spatial query reports its own count and never shrinks the shared buffer', () => {
    const g = new SpatialHash<GridItem>(64, 256);
    const items: GridItem[] = [];
    for (let i = 0; i < 40; i++) items.push({ x: (i % 8) * 20, y: Math.floor(i / 8) * 20, r: 5, _q: 0 });
    for (const it of items) g.insert(it);
    const out: GridItem[] = [];
    const many = g.query(70, 40, 200, out);
    expect(many).toBe(40);
    const few = g.query(0, 0, 1, out);
    expect(few).toBeGreaterThan(0);
    expect(few).toBeLessThan(many);
    expect(out.length).toBe(40); // the buffer keeps its storage; only the first `few` count
    expect(new Set(out.slice(0, few)).size).toBe(few);
  });
});
