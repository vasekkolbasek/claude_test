/** CPU benchmark of the simulation with a saturated arena: npm run bench */
import { PASSIVE_IDS } from '../src/data/passives';
import { WEAPON_IDS } from '../src/data/weapons';
import { World } from '../src/game/World';
import type { EnemyId } from '../src/data/types';

const w = new World({ mode: 'endless', sector: 'ram', character: 'spark', seed: 3, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
w.view.hw = 300;
w.view.hh = 600;
for (const id of ['pulse', 'orbit', 'chain', 'laser', 'mines', 'missiles'] as const) {
  const wp = w.weapons.find((x) => x.id === id) ?? w.addWeapon(id, 0);
  wp.level = 5;
}
const kinds: EnemyId[] = ['byte', 'worm', 'trojan', 'dasher', 'spammer', 'shielded', 'nano'];
function fill(n: number): void {
  while (w.enemies.length < n) {
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 600;
    const e = w.spawnEnemy(kinds[w.enemies.length % kinds.length], w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
    e.maxHp = e.hp = 1e9; // keep the arena full
  }
}
const frames = 600;
for (const n of [300, 600]) {
  fill(n);
  const t0 = performance.now();
  let worst = 0;
  for (let i = 0; i < frames; i++) {
    const f0 = performance.now();
    w.player.hp = w.stats.maxHp;
    if (w.state !== 'playing') w.state = 'playing';
    w.input.x = Math.cos(i / 40);
    w.input.y = Math.sin(i / 50);
    w.update(1 / 60);
    fill(n);
    worst = Math.max(worst, performance.now() - f0);
  }
  const avg = (performance.now() - t0) / frames;
  console.log(`${n} enemies: avg ${avg.toFixed(2)} ms/frame, worst ${worst.toFixed(2)} ms, bullets ${w.bullets.length}, gems ${w.gems.length}`);
}
