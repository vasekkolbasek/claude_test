import { Rng, hashString } from '../core/rng';
import type { MapDef } from '../data/maps';
import { UNITS, type EnemyId } from '../data/units';

export interface SpawnGroup {
  unit: EnemyId;
  count: number;
  path: number;
  /** Seconds after night start when the group starts spawning. */
  delay: number;
  interval: number;
}

export interface WavePlan {
  night: number;
  groups: SpawnGroup[];
  paths: number[];
  boss: EnemyId | null;
  budget: number;
  /** Per path summary for the day-time preview: unit -> count. */
  preview: Map<number, Map<EnemyId, number>>;
  /** Health multiplier (endless scaling). */
  hpMul: number;
}

export function isBossNight(map: MapDef, night: number, endless: boolean): boolean {
  if (night === map.nights) return true;
  return endless && night > map.nights && (night - map.nights) % 5 === 0;
}

export function waveBudget(map: MapDef, night: number): number {
  const { base, growth, pow } = map.budget;
  const n = Math.min(night, map.nights);
  let b = base * Math.pow(1 + growth * (n - 1), pow);
  if (night > map.nights) b *= Math.pow(1.11, night - map.nights);
  return Math.round(b);
}

export function activePaths(map: MapDef, night: number): number[] {
  if (night <= map.nights) return map.schedule[night - 1];
  return map.paths.map((_, i) => i);
}

/** Deterministic wave generator. Same (map, night, seed) → same wave. */
export function generateWave(map: MapDef, night: number, seed: number, endless = false): WavePlan {
  const rng = new Rng(hashString(`${map.id}:${night}:${seed}`));
  const paths = activePaths(map, night);
  let budget = waveBudget(map, night);
  const boss = isBossNight(map, night, endless) ? map.boss : null;
  const groups: SpawnGroup[] = [];
  const roster = map.roster.filter((r) => r.from <= night);
  const fresh = roster.filter((r) => r.from === night).map((r) => r.unit);

  if (boss) {
    groups.push({ unit: boss, count: 1, path: paths[0], delay: 14, interval: 1 });
    budget = Math.max(budget * 0.55, 6);
  }

  // Split the budget between active paths with a little jitter.
  const weights = paths.map(() => rng.range(0.85, 1.15));
  const wsum = weights.reduce((a, b) => a + b, 0);
  paths.forEach((path, pi) => {
    let left = Math.round((budget * weights[pi]) / wsum);
    let t = rng.range(0, 3) + pi * 1.5;
    // Introduce newly unlocked units first so the player meets them.
    const intro = fresh.length ? fresh[pi % fresh.length] : null;
    let first = true;
    while (left > 0) {
      let unit: EnemyId;
      if (first && intro && UNITS[intro].threat <= left) unit = intro;
      else {
        const affordable = roster.filter((r) => UNITS[r.unit].threat <= left && (UNITS[r.unit].threat <= 3 || left >= UNITS[r.unit].threat * 2));
        if (!affordable.length) break;
        unit = rng.weighted(affordable, (r) => r.weight).unit;
      }
      first = false;
      const th = UNITS[unit].threat;
      const maxCount = Math.max(1, Math.floor(left / th));
      const count = th >= 5 ? 1 : Math.min(maxCount, rng.int(3, 7));
      groups.push({ unit, count, path, delay: t, interval: UNITS[unit].speed > 4 ? 0.35 : 0.6 });
      left -= count * th;
      t += count * 0.6 + rng.range(2.5, 6);
    }
  });

  const preview = new Map<number, Map<EnemyId, number>>();
  for (const g of groups) {
    let m = preview.get(g.path);
    if (!m) preview.set(g.path, (m = new Map()));
    m.set(g.unit, (m.get(g.unit) ?? 0) + g.count);
  }
  const hpMul = night > map.nights ? 1 + 0.05 * (night - map.nights) : 1;
  return { night, groups, paths, boss, budget: waveBudget(map, night), preview, hpMul };
}

/** Flattened spawn schedule sorted by time. */
export function spawnSchedule(plan: WavePlan): { t: number; unit: EnemyId; path: number }[] {
  const out: { t: number; unit: EnemyId; path: number }[] = [];
  for (const g of plan.groups) for (let i = 0; i < g.count; i++) out.push({ t: g.delay + i * g.interval, unit: g.unit, path: g.path });
  out.sort((a, b) => a.t - b.t);
  return out;
}
