import { CONFIG } from '../data/config';
import type { AchievementId } from '../data/achievements';
import { MAP_IDS, type MapId } from '../data/maps';
import { PERK_IDS, MUTATORS, type MutatorId, type PerkId } from '../data/perks';
import { WEAPON_IDS, type WeaponId } from '../data/weapons';
import type { RunSnapshot } from '../systems/Game';

export type QualityPref = 'auto' | 'high' | 'medium' | 'low';

export interface MapProgress { won: boolean; best: number; wins: number; endlessBest: number }

export interface SaveData {
  v: number;
  /** Last modification time (ms) — used to pick the freshest of cloud/local copies. */
  t: number;
  glory: number;
  maps: Record<MapId, MapProgress>;
  weapon: WeaponId;
  perks: PerkId[];
  mutators: MutatorId[];
  ach: AchievementId[];
  totals: { kills: number; built: number; abilities: number; runs: number; wins: number; weaponsWon: WeaponId[] };
  settings: { music: number; sfx: number; vibration: boolean; quality: QualityPref; lang: 'auto' | 'ru' | 'en' };
  tutorialDone: boolean;
  run: RunSnapshot | null;
  endlessBest: number;
}

export const LOCAL_KEY = 'lastbastion.save';

export function defaultSave(): SaveData {
  const maps = {} as Record<MapId, MapProgress>;
  for (const id of MAP_IDS) maps[id] = { won: false, best: 0, wins: 0, endlessBest: 0 };
  return {
    v: CONFIG.saveVersion,
    t: 0,
    glory: 0,
    maps,
    weapon: 'sword',
    perks: [],
    mutators: [],
    ach: [],
    totals: { kills: 0, built: 0, abilities: 0, runs: 0, wins: 0, weaponsWon: [] },
    settings: { music: 0.6, sfx: 0.8, vibration: true, quality: 'auto', lang: 'auto' },
    tutorialDone: false,
    run: null,
    endlessBest: 0,
  };
}

type Raw = Record<string, any>;

/** Schema migrations: index i upgrades version i → i+1. */
const MIGRATIONS: ((d: Raw) => Raw)[] = [
  // v0 (pre-release prototype): { gloryPoints, unlockedMaps: string[], volume }
  (d) => {
    const out: Raw = { ...d, v: 1 };
    if (typeof d.gloryPoints === 'number') out.glory = d.gloryPoints;
    if (Array.isArray(d.unlockedMaps)) {
      out.maps = {};
      for (const id of d.unlockedMaps) out.maps[id] = { won: true, best: 0, wins: 1 };
    }
    if (typeof d.volume === 'number') out.settings = { music: d.volume, sfx: d.volume };
    delete out.gloryPoints;
    delete out.unlockedMaps;
    delete out.volume;
    return out;
  },
  // v1 → v2: endless records per map, achievements renamed to `ach`, settings.lang.
  (d) => {
    const out: Raw = { ...d, v: 2 };
    if (Array.isArray(d.achievements) && !Array.isArray(d.ach)) out.ach = d.achievements;
    delete out.achievements;
    if (out.maps) for (const k of Object.keys(out.maps)) out.maps[k] = { endlessBest: 0, ...out.maps[k] };
    out.settings = { lang: 'auto', ...(out.settings ?? {}) };
    return out;
  },
];

const num = (v: unknown, def: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** Turns anything (old versions, partial or corrupted data) into a valid SaveData. */
export function migrate(raw: unknown): SaveData {
  const def = defaultSave();
  if (!raw || typeof raw !== 'object') return def;
  let d = { ...(raw as Raw) };
  let v = typeof d.v === 'number' ? d.v : 0;
  if (v > CONFIG.saveVersion) v = CONFIG.saveVersion; // future data: best effort
  while (v < CONFIG.saveVersion) {
    d = MIGRATIONS[v](d);
    v++;
  }
  const out = def;
  out.t = num(d.t, 0, 0);
  out.glory = Math.floor(num(d.glory, 0, 0));
  for (const id of MAP_IDS) {
    const m = d.maps?.[id];
    if (m && typeof m === 'object') {
      out.maps[id] = { won: !!m.won, best: Math.floor(num(m.best, 0, 0)), wins: Math.floor(num(m.wins, 0, 0)), endlessBest: Math.floor(num(m.endlessBest, 0, 0)) };
    }
  }
  if (WEAPON_IDS.includes(d.weapon)) out.weapon = d.weapon;
  if (Array.isArray(d.perks)) out.perks = d.perks.filter((p: unknown) => PERK_IDS.includes(p as PerkId)).slice(0, 3);
  if (Array.isArray(d.mutators)) out.mutators = d.mutators.filter((m: unknown) => MUTATORS.some((x) => x.id === m));
  if (Array.isArray(d.ach)) out.ach = [...new Set(d.ach.filter((a: unknown) => typeof a === 'string'))] as AchievementId[];
  const tt = d.totals ?? {};
  out.totals = {
    kills: Math.floor(num(tt.kills, 0, 0)), built: Math.floor(num(tt.built, 0, 0)), abilities: Math.floor(num(tt.abilities, 0, 0)),
    runs: Math.floor(num(tt.runs, 0, 0)), wins: Math.floor(num(tt.wins, 0, 0)),
    weaponsWon: Array.isArray(tt.weaponsWon) ? tt.weaponsWon.filter((w: unknown) => WEAPON_IDS.includes(w as WeaponId)) : [],
  };
  const s = d.settings ?? {};
  out.settings = {
    music: num(s.music, def.settings.music, 0, 1),
    sfx: num(s.sfx, def.settings.sfx, 0, 1),
    vibration: typeof s.vibration === 'boolean' ? s.vibration : true,
    quality: ['auto', 'high', 'medium', 'low'].includes(s.quality) ? s.quality : 'auto',
    lang: ['auto', 'ru', 'en'].includes(s.lang) ? s.lang : 'auto',
  };
  out.tutorialDone = !!d.tutorialDone;
  out.run = d.run && typeof d.run === 'object' && MAP_IDS.includes(d.run.map) && typeof d.run.night === 'number' ? (d.run as RunSnapshot) : null;
  out.endlessBest = Math.floor(num(d.endlessBest, 0, 0));
  return out;
}

export interface CloudStore {
  loadCloud(): Promise<unknown | null>;
  saveCloud(data: unknown, flush: boolean): Promise<void>;
}

/** Holds the save in memory; writes localStorage immediately and the cloud debounced. */
export class SaveManager {
  data: SaveData = defaultSave();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(private cloud: CloudStore, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage()) {}

  async load(): Promise<SaveData> {
    let local: unknown = null;
    try {
      const s = this.storage?.getItem(LOCAL_KEY);
      if (s) local = JSON.parse(s);
    } catch { local = null; }
    let cloud: unknown = null;
    try { cloud = await this.cloud.loadCloud(); } catch { cloud = null; }
    const a = migrate(local), b = migrate(cloud);
    // Prefer the most recent copy; fall back to the one with more progress.
    let pick = a;
    if (b.t > a.t) pick = b;
    else if (b.t === a.t && b.glory > a.glory) pick = b;
    this.data = pick;
    return pick;
  }

  /** Apply a change and schedule a save. */
  change(fn?: (d: SaveData) => void, flush = false): void {
    fn?.(this.data);
    this.data.t = Date.now();
    this.writeLocal();
    this.dirty = true;
    if (flush) { this.flush(); return; }
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, CONFIG.saveDebounceMs);
  }

  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.dirty) return;
    this.dirty = false;
    void this.cloud.saveCloud(this.data, true).catch(() => { this.dirty = true; });
  }

  private writeLocal(): void {
    try { this.storage?.setItem(LOCAL_KEY, JSON.stringify(this.data)); } catch { /* quota or privacy mode */ }
  }

  reset(keepSettings = true): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    if (keepSettings) this.data.settings = settings;
    this.change(undefined, true);
  }
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__lb_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch { return null; }
}
