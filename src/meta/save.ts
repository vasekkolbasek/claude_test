import type { CharacterId, SectorId } from '../data/types';
import type { Platform } from '../platform/Platform';
import { seenForExisting } from './features';

export const SAVE_VERSION = 3;
const LOCAL_KEY = 'neon-swarm:save';

export type QualitySetting = 'auto' | 0 | 1 | 2;

export interface Settings {
  music: number;
  sfx: number;
  vibration: boolean;
  shake: boolean;
  quality: QualitySetting;
}

export interface LifetimeStats {
  runs: number;
  wins: number;
  kills: number;
  bossKills: number;
  miniBosses: number;
  elites: number;
  evolutions: number;
  gems: number;
  maxLevel: number;
  bitsEarned: number;
  playTime: number;
  longestRun: number;
  revives: number;
  chests: number;
  adsWatched: number;
  dailyQuests: number;
  maxKillsRun: number;
  maxNoHit: number;
}

export interface DailyState {
  /** day index (UTC days since epoch) of the last claimed login reward */
  lastClaim: number;
  streak: number;
  questDay: number;
  questId: string;
  questDone: boolean;
}

export interface SaveData {
  v: number;
  updatedAt: number;
  bits: number;
  workshop: Record<string, number>;
  chars: CharacterId[];
  char: CharacterId;
  sectorsCleared: SectorId[];
  endlessUnlocked: boolean;
  bestTime: Partial<Record<SectorId, number>>;
  bestEndless: number;
  ach: Record<string, number>;
  codex: { e: Record<string, number>; w: string[]; p: string[] };
  stats: LifetimeStats;
  settings: Settings;
  daily: DailyState;
  chestAt: number;
  tutorialDone: boolean;
  authOffered: number;
  /** menu features the player has already opened (progressive menu) */
  seen: string[];
  /** rewarded videos watched towards ad-unlocked characters */
  adUnlock: Record<string, number>;
}

export function defaultStats(): LifetimeStats {
  return {
    runs: 0,
    wins: 0,
    kills: 0,
    bossKills: 0,
    miniBosses: 0,
    elites: 0,
    evolutions: 0,
    gems: 0,
    maxLevel: 0,
    bitsEarned: 0,
    playTime: 0,
    longestRun: 0,
    revives: 0,
    chests: 0,
    adsWatched: 0,
    dailyQuests: 0,
    maxKillsRun: 0,
    maxNoHit: 0,
  };
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    updatedAt: 0,
    bits: 0,
    workshop: {},
    chars: ['spark'],
    char: 'spark',
    sectorsCleared: [],
    endlessUnlocked: false,
    bestTime: {},
    bestEndless: 0,
    ach: {},
    codex: { e: {}, w: [], p: [] },
    stats: defaultStats(),
    settings: { music: 0.7, sfx: 0.8, vibration: true, shake: true, quality: 'auto' },
    daily: { lastClaim: -1, streak: 0, questDay: -1, questId: '', questDone: false },
    chestAt: 0,
    tutorialDone: false,
    authOffered: 0,
    seen: [],
    adUnlock: {},
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function bool(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}

function strArr<T extends string>(v: unknown, d: T[]): T[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as T[]) : d;
}

function numRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const k in v) if (typeof v[k] === 'number' && Number.isFinite(v[k])) out[k] = v[k] as number;
  return out;
}

/**
 * Upgrades any older (or partially corrupted) save to the current schema.
 * v0: pre-release prototype — `coins` instead of `bits`, flat `unlocked` list.
 * v1: had `settings.muted` instead of separate volumes and no daily/codex.p.
 * v2: no progressive menu (`seen`) and no ad-unlock counters.
 */
export function migrate(input: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(input)) return d;
  const raw: Record<string, unknown> = { ...input };
  let v = num(raw.v, 0);
  if (v < 1) {
    if (raw.bits === undefined && typeof raw.coins === 'number') raw.bits = raw.coins;
    if (raw.chars === undefined && Array.isArray(raw.unlocked)) raw.chars = raw.unlocked;
    v = 1;
  }
  if (v < 2) {
    if (isObj(raw.settings) && typeof raw.settings.muted === 'boolean') {
      const muted = raw.settings.muted;
      raw.settings = { ...raw.settings, music: muted ? 0 : 0.7, sfx: muted ? 0 : 0.8 };
    }
  }
  const s = d;
  s.updatedAt = num(raw.updatedAt, 0);
  s.bits = Math.max(0, Math.floor(num(raw.bits, 0)));
  s.workshop = numRecord(raw.workshop);
  s.chars = strArr<CharacterId>(raw.chars, ['spark']);
  if (!s.chars.includes('spark')) s.chars.unshift('spark');
  s.char = typeof raw.char === 'string' && s.chars.includes(raw.char as CharacterId) ? (raw.char as CharacterId) : 'spark';
  s.sectorsCleared = strArr<SectorId>(raw.sectorsCleared, []);
  s.endlessUnlocked = bool(raw.endlessUnlocked, s.sectorsCleared.length > 0);
  s.bestTime = numRecord(raw.bestTime) as Partial<Record<SectorId, number>>;
  s.bestEndless = num(raw.bestEndless, 0);
  s.ach = numRecord(raw.ach);
  if (isObj(raw.codex)) {
    s.codex = { e: numRecord(raw.codex.e), w: strArr(raw.codex.w, []), p: strArr(raw.codex.p, []) };
  }
  if (isObj(raw.stats)) {
    const st = defaultStats();
    for (const k of Object.keys(st) as (keyof LifetimeStats)[]) st[k] = num(raw.stats[k], st[k]);
    s.stats = st;
  }
  if (isObj(raw.settings)) {
    const r = raw.settings;
    const q = r.quality;
    s.settings = {
      music: Math.min(1, Math.max(0, num(r.music, s.settings.music))),
      sfx: Math.min(1, Math.max(0, num(r.sfx, s.settings.sfx))),
      vibration: bool(r.vibration, true),
      shake: bool(r.shake, true),
      quality: q === 0 || q === 1 || q === 2 ? q : 'auto',
    };
  }
  if (isObj(raw.daily)) {
    const r = raw.daily;
    s.daily = {
      lastClaim: num(r.lastClaim, -1),
      streak: num(r.streak, 0),
      questDay: num(r.questDay, -1),
      questId: typeof r.questId === 'string' ? r.questId : '',
      questDone: bool(r.questDone, false),
    };
  }
  s.chestAt = num(raw.chestAt, 0);
  s.tutorialDone = bool(raw.tutorialDone, false);
  s.authOffered = num(raw.authOffered, 0);
  // older saves knew no gated menu: whatever is already open is not «new»
  s.seen = Array.isArray(raw.seen) ? strArr<string>(raw.seen, []) : seenForExisting(s);
  s.adUnlock = numRecord(raw.adUnlock);
  // the ad-unlocked character is Sentinel again (it was Volt for a while): unfinished progress
  // towards Volt carries over; whoever already unlocked Volt keeps him (those videos are spent)
  if (s.adUnlock.volt && !s.chars.includes('volt') && !s.chars.includes('sentinel')) s.adUnlock.sentinel = Math.max(s.adUnlock.sentinel ?? 0, s.adUnlock.volt);
  delete s.adUnlock.volt;
  s.v = SAVE_VERSION;
  return s;
}

/** A rough "how far is this player" metric used to resolve cloud vs. local conflicts. */
export function progressScore(s: SaveData): number {
  return s.stats.playTime + s.stats.bitsEarned * 2 + Object.keys(s.ach).length * 100;
}

function readLocal(): SaveData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(s: SaveData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Owns the save: localStorage is written immediately on every change (survives reloads even
 * when the cloud is unreachable); the platform cloud is written debounced and rate limited.
 */
export class SaveManager {
  data: SaveData = defaultSave();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastCloud = 0;
  private dirtyCloud = false;
  /** minimum interval between cloud writes (SDK limit: 100 writes / 5 min) */
  private readonly cloudInterval = 5000;

  constructor(private readonly platform: Platform) {}

  async load(): Promise<SaveData> {
    const local = readLocal();
    let cloud: SaveData | null;
    try {
      const raw = await this.platform.loadData();
      cloud = raw ? migrate(raw) : null;
    } catch {
      cloud = null;
    }
    this.data = pickNewer(local, cloud) ?? defaultSave();
    writeLocal(this.data);
    return this.data;
  }

  /** Re-reads the cloud after the player signs in and keeps the more advanced progress. */
  async resync(): Promise<void> {
    try {
      const raw = await this.platform.loadData();
      const cloud = raw ? migrate(raw) : null;
      if (cloud && progressScore(cloud) > progressScore(this.data)) {
        this.data = cloud;
        writeLocal(this.data);
      } else {
        this.save(true);
      }
    } catch {
      /* keep local */
    }
  }

  /** Persists the current data. `flush` forces an immediate cloud write (end of run, purchases). */
  save(flush = false): void {
    this.data.updatedAt = Date.now();
    writeLocal(this.data);
    this.dirtyCloud = true;
    const now = Date.now();
    const wait = Math.max(flush ? 0 : 1200, this.lastCloud + this.cloudInterval - now);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.pushCloud(flush), wait);
  }

  private pushCloud(flush: boolean): void {
    this.timer = null;
    if (!this.dirtyCloud) return;
    this.dirtyCloud = false;
    this.lastCloud = Date.now();
    void this.platform.saveData(this.data as unknown as Record<string, unknown>, flush);
  }

  /** Called when the page is hidden: write everything now. */
  flushNow(): void {
    writeLocal(this.data);
    if (this.dirtyCloud) {
      if (this.timer) clearTimeout(this.timer);
      this.pushCloud(true);
    }
  }

  reset(): void {
    const keep = this.data.settings;
    this.data = defaultSave();
    this.data.settings = keep;
    this.data.updatedAt = Date.now();
    writeLocal(this.data);
    this.dirtyCloud = true;
    if (this.timer) clearTimeout(this.timer);
    this.pushCloud(true);
  }
}

export function pickNewer(a: SaveData | null, b: SaveData | null): SaveData | null {
  if (!a) return b;
  if (!b) return a;
  // the most recent write wins (a reset must not be undone by an older cloud copy);
  // progress breaks ties between saves written at the same moment
  if (Math.abs(a.updatedAt - b.updatedAt) > 2000) return a.updatedAt > b.updatedAt ? a : b;
  return progressScore(a) >= progressScore(b) ? a : b;
}
