import { BALANCE } from '../data/balance';
import { enemyFor } from '../data/enemies';
import {
  ENDLESS_CYCLE_LENGTH,
  ENDLESS_DENSITY_PER_MIN,
  ENDLESS_EVENT_CYCLE,
  ENDLESS_LOOP_FROM,
  ENDLESS_RATE_PER_MIN,
  WAVES,
  WAVE_EVENTS,
} from '../data/waves';
import type { EnemyId, GameModeId, SectorDef, WaveEvent, WaveSegment } from '../data/types';

export type GameMode = GameModeId;

export interface WaveState {
  min: number;
  rate: number;
  elite: number;
  roster: ReadonlyArray<readonly [EnemyId, number]>;
  hpMult: number;
  dmgMult: number;
}

function segmentIndex(t: number): number {
  let i = 0;
  while (i + 1 < WAVES.length && WAVES[i + 1].at <= t) i++;
  return i;
}

/** Enemy HP multiplier at time t (seconds), before sector scaling. */
export function hpMultAt(t: number, mode: GameMode): number {
  const m = t / 60;
  const { a, b } = BALANCE.hpGrowth;
  let mult = 1 + a * m + b * m * m;
  if (mode === 'endless' && t > BALANCE.bossTime) {
    const extra = (t - BALANCE.bossTime) / 60;
    mult *= 1 + BALANCE.endlessHpGrowth * extra + 0.02 * extra * extra;
  }
  return mult;
}

/** Pure description of what the director wants at time t. Used by the spawner and tests. */
export function waveStateAt(t: number, mode: GameMode, sector: SectorDef): WaveState {
  const endless = mode === 'endless' && t >= BALANCE.bossTime;
  let seg: WaveSegment;
  let min: number;
  let rate: number;
  if (endless) {
    // cycle through the late-game rosters while density keeps climbing
    const lateTo = WAVES.length - 2;
    const start = WAVES[ENDLESS_LOOP_FROM].at;
    const span = WAVES[lateTo + 1].at - start;
    const local = start + ((t - BALANCE.bossTime) % span);
    seg = WAVES[Math.min(segmentIndex(local), lateTo)];
    const mins = (t - BALANCE.bossTime) / 60;
    min = WAVES[lateTo].min + ENDLESS_DENSITY_PER_MIN * mins;
    rate = WAVES[lateTo].rate + ENDLESS_RATE_PER_MIN * mins;
  } else {
    const i = segmentIndex(t);
    seg = WAVES[i];
    // never blend into the final (post-boss) segment: the last minute holds its density
    const next = i + 2 < WAVES.length ? WAVES[i + 1] : undefined;
    min = seg.min;
    rate = seg.rate;
    if (next) {
      const f = Math.min(1, Math.max(0, (t - seg.at) / (next.at - seg.at)));
      min = seg.min + (next.min - seg.min) * f;
      rate = seg.rate + (next.rate - seg.rate) * f;
    }
  }
  min *= sector.spawnMult;
  rate *= sector.spawnMult;
  // a virus the sector does not have yet is replaced by a stand-in of similar weight
  const merged = new Map<EnemyId, number>();
  for (const [id, w] of seg.roster) {
    const real = enemyFor(sector.swap?.[id] ?? id, sector.id);
    merged.set(real, (merged.get(real) ?? 0) + w * (sector.weights?.[real] ?? 1));
  }
  const roster = [...merged.entries()] as (readonly [EnemyId, number])[];
  return {
    min: Math.min(min, BALANCE.maxEnemies),
    rate,
    elite: seg.elite + (endless ? 0.01 : 0),
    roster,
    hpMult: hpMultAt(t, mode) * sector.hpMult,
    dmgMult: (1 + BALANCE.dmgGrowth * (t / 60)) * sector.dmgMult,
  };
}

/** Yields scripted events in (prevT, t]. */
export function eventsBetween(prevT: number, t: number, mode: GameMode, out: WaveEvent[]): WaveEvent[] {
  out.length = 0;
  for (const e of WAVE_EVENTS) {
    if (e.at > prevT && e.at <= t) {
      if (mode === 'normal' || e.type !== 'boss' || e.at === BALANCE.bossTime) out.push(e);
    }
  }
  if (mode === 'endless' && t > BALANCE.bossTime) {
    const a = prevT - BALANCE.bossTime;
    const b = t - BALANCE.bossTime;
    const ca = Math.floor(a / ENDLESS_CYCLE_LENGTH);
    const cb = Math.floor(b / ENDLESS_CYCLE_LENGTH);
    for (let c = Math.max(0, ca); c <= cb; c++) {
      for (const e of ENDLESS_EVENT_CYCLE) {
        const at = c * ENDLESS_CYCLE_LENGTH + e.at;
        if (at > a && at <= b) out.push(e);
      }
    }
    // the Chaos Core returns every 10 minutes in endless mode
    const ba = Math.floor(a / BALANCE.bossTime);
    const bb = Math.floor(b / BALANCE.bossTime);
    if (bb > ba && b > 0) out.push({ at: t, type: 'boss', enemy: 'boss_core', count: 1 });
  }
  return out;
}
