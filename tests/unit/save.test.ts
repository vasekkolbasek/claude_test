import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { LOCAL_KEY, SaveManager, defaultSave, migrate } from '../../src/save/save';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('migrations', () => {
  it('turns garbage into a default save', () => {
    for (const bad of [null, undefined, 42, 'x', [], { v: 'nope' }]) {
      const s = migrate(bad);
      expect(s.v).toBe(CONFIG.saveVersion);
      expect(s.glory).toBe(0);
      expect(s.maps.valley.won).toBe(false);
    }
  });

  it('migrates a v0 prototype save', () => {
    const s = migrate({ gloryPoints: 321, unlockedMaps: ['valley'], volume: 0.3 });
    expect(s.glory).toBe(321);
    expect(s.maps.valley.won).toBe(true);
    expect(s.maps.valley.endlessBest).toBe(0);
    expect(s.settings.music).toBe(0.3);
    expect(s.settings.lang).toBe('auto');
  });

  it('migrates v1 achievements field', () => {
    const s = migrate({ v: 1, glory: 10, achievements: ['first_build'], maps: { swamp: { won: true, best: 10, wins: 2 } } });
    expect(s.ach).toEqual(['first_build']);
    expect(s.maps.swamp).toEqual({ won: true, best: 10, wins: 2, endlessBest: 0 });
  });

  it('sanitises values and drops unknown ids', () => {
    const s = migrate({ v: 2, glory: -5, weapon: 'laser', perks: ['tithe', 'bogus', 'swift', 'purse', 'stout'], settings: { music: 7, quality: 'ultra' } });
    expect(s.glory).toBe(0);
    expect(s.weapon).toBe('sword');
    expect(s.perks).toEqual(['tithe', 'swift', 'purse']);
    expect(s.settings.music).toBe(1);
    expect(s.settings.quality).toBe('auto');
  });

  it('keeps a valid run snapshot and drops a broken one', () => {
    expect(migrate({ v: 2, run: { map: 'valley', night: 3 } }).run?.night).toBe(3);
    expect(migrate({ v: 2, run: { map: 'mars', night: 3 } }).run).toBeNull();
  });
});

describe('SaveManager', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('writes local immediately and debounces cloud writes', async () => {
    const cloudWrites: unknown[] = [];
    const store = new MemStorage();
    const sm = new SaveManager({ loadCloud: async () => null, saveCloud: async (d) => { cloudWrites.push(JSON.parse(JSON.stringify(d))); } }, store);
    await sm.load();
    sm.change((d) => { d.glory = 10; });
    sm.change((d) => { d.glory = 20; });
    sm.change((d) => { d.glory = 30; });
    expect(JSON.parse(store.getItem(LOCAL_KEY)!).glory).toBe(30);
    expect(cloudWrites).toHaveLength(0);
    vi.advanceTimersByTime(CONFIG.saveDebounceMs + 10);
    expect(cloudWrites).toHaveLength(1);
    expect((cloudWrites[0] as { glory: number }).glory).toBe(30);
  });

  it('flush writes immediately', async () => {
    const cloudWrites: unknown[] = [];
    const sm = new SaveManager({ loadCloud: async () => null, saveCloud: async (d) => { cloudWrites.push(d); } }, new MemStorage());
    await sm.load();
    sm.change((d) => { d.glory = 5; }, true);
    expect(cloudWrites).toHaveLength(1);
  });

  it('picks the newest of cloud and local copies', async () => {
    const store = new MemStorage();
    store.setItem(LOCAL_KEY, JSON.stringify({ ...defaultSave(), t: 100, glory: 1 }));
    const sm = new SaveManager({ loadCloud: async () => ({ ...defaultSave(), t: 200, glory: 2 }), saveCloud: async () => undefined }, store);
    expect((await sm.load()).glory).toBe(2);
    const store2 = new MemStorage();
    store2.setItem(LOCAL_KEY, JSON.stringify({ ...defaultSave(), t: 300, glory: 3 }));
    const sm2 = new SaveManager({ loadCloud: async () => ({ ...defaultSave(), t: 200, glory: 2 }), saveCloud: async () => undefined }, store2);
    expect((await sm2.load()).glory).toBe(3);
  });

  it('survives a failing cloud and missing storage', async () => {
    const sm = new SaveManager({ loadCloud: async () => { throw new Error('offline'); }, saveCloud: async () => { throw new Error('offline'); } }, null);
    const d = await sm.load();
    expect(d.glory).toBe(0);
    sm.change((x) => { x.glory = 1; }, true);
    expect(sm.data.glory).toBe(1);
  });
});
