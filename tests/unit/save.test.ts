import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSave, migrate, pickNewer, SaveManager, SAVE_VERSION } from '../../src/meta/save';
import type { Platform } from '../../src/platform/Platform';

function fakePlatform(cloud: Record<string, unknown> | null = null) {
  const writes: unknown[] = [];
  const p = {
    loadData: vi.fn(async () => cloud),
    saveData: vi.fn(async (d: Record<string, unknown>) => {
      writes.push(JSON.parse(JSON.stringify(d)));
      return true;
    }),
  } as unknown as Platform;
  return { p, writes };
}

describe('save migration', () => {
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('x')).toEqual(defaultSave());
    expect(migrate([1, 2])).toEqual(defaultSave());
  });

  it('unfinished videos for Volt count for Sentinel, the ad character again; owned characters stay', () => {
    const m = migrate({ v: 3, chars: ['spark'], adUnlock: { volt: 3 } });
    expect(m.adUnlock.sentinel).toBe(3);
    expect(m.adUnlock.volt).toBeUndefined();
    const owned = migrate({ v: 3, chars: ['spark', 'volt'], adUnlock: { volt: 5 } });
    expect(owned.chars).toContain('volt');
    expect(owned.adUnlock.sentinel).toBeUndefined(); // the videos were spent on Volt
    const both = migrate({ v: 3, chars: ['spark', 'sentinel'], adUnlock: { volt: 2 } });
    expect(both.chars).toContain('sentinel');
  });

  it('round-trips the current schema', () => {
    const s = defaultSave();
    s.bits = 123;
    s.workshop = { core_dmg: 2 };
    s.chars = ['spark', 'sentinel'];
    s.char = 'sentinel';
    s.ach = { first_run: 5 };
    const m = migrate(JSON.parse(JSON.stringify(s)));
    expect(m).toEqual(s);
    expect(m.v).toBe(SAVE_VERSION);
  });

  it('migrates v0 (coins / unlocked)', () => {
    const m = migrate({ coins: 77, unlocked: ['spark', 'volt'], char: 'volt' });
    expect(m.bits).toBe(77);
    expect(m.chars).toEqual(['spark', 'volt']);
    expect(m.char).toBe('volt');
  });

  it('migrates v1 muted flag to volumes', () => {
    const m = migrate({ v: 1, bits: 5, settings: { muted: true, vibration: false } });
    expect(m.settings.music).toBe(0);
    expect(m.settings.sfx).toBe(0);
    expect(m.settings.vibration).toBe(false);
  });

  it('sanitizes corrupted fields', () => {
    const m = migrate({ v: 2, bits: -50, char: 'hacker', chars: 'nope', workshop: { a: 'x', b: 2 }, settings: { music: 9, quality: 7 } });
    expect(m.bits).toBe(0);
    expect(m.char).toBe('spark');
    expect(m.chars).toEqual(['spark']);
    expect(m.workshop).toEqual({ b: 2 });
    expect(m.settings.music).toBe(1);
    expect(m.settings.quality).toBe('auto');
  });

  it('always keeps the starter character', () => {
    expect(migrate({ v: 2, chars: ['volt'] }).chars).toContain('spark');
  });
});

describe('pickNewer', () => {
  it('prefers the most recent write', () => {
    const a = defaultSave();
    const b = defaultSave();
    a.updatedAt = 10_000;
    b.updatedAt = 50_000;
    b.stats.playTime = 0;
    a.stats.playTime = 9999;
    expect(pickNewer(a, b)).toBe(b);
  });
  it('breaks near-ties by progress', () => {
    const a = defaultSave();
    const b = defaultSave();
    a.updatedAt = 10_000;
    b.updatedAt = 10_500;
    a.stats.bitsEarned = 1000;
    expect(pickNewer(a, b)).toBe(a);
  });
  it('handles nulls', () => {
    const a = defaultSave();
    expect(pickNewer(null, a)).toBe(a);
    expect(pickNewer(a, null)).toBe(a);
    expect(pickNewer(null, null)).toBeNull();
  });
});

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('loads cloud data when local is empty', async () => {
    const cloud = { ...defaultSave(), bits: 42, updatedAt: 100 };
    const { p } = fakePlatform(cloud as unknown as Record<string, unknown>);
    const m = new SaveManager(p);
    await m.load();
    expect(m.data.bits).toBe(42);
  });

  it('writes local immediately and debounces cloud writes', async () => {
    const { p, writes } = fakePlatform();
    const m = new SaveManager(p);
    await m.load();
    for (let i = 0; i < 10; i++) {
      m.data.bits = i;
      m.save();
    }
    expect(JSON.parse(localStorage.getItem('neon-swarm:save') as string).bits).toBe(9);
    expect(writes.length).toBe(0);
    await vi.advanceTimersByTimeAsync(6000);
    expect(writes.length).toBe(1);
    expect((writes[0] as { bits: number }).bits).toBe(9);
  });

  it('survives a reload from local storage only', async () => {
    const { p } = fakePlatform();
    const m = new SaveManager(p);
    await m.load();
    m.data.bits = 555;
    m.save();
    const m2 = new SaveManager(fakePlatform().p);
    await m2.load();
    expect(m2.data.bits).toBe(555);
  });

  it('reset clears progress but keeps settings', async () => {
    const { p, writes } = fakePlatform();
    const m = new SaveManager(p);
    await m.load();
    m.data.bits = 900;
    m.data.settings.music = 0.1;
    m.reset();
    expect(m.data.bits).toBe(0);
    expect(m.data.settings.music).toBe(0.1);
    expect(writes.length).toBe(1);
  });
});
