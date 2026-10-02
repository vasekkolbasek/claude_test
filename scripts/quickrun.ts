import { World } from '../src/game/World';
import { Bot } from '../src/game/Bot';
import { WEAPON_IDS } from '../src/data/weapons';
import { PASSIVE_IDS } from '../src/data/passives';

const skill = Number(process.argv[2] ?? 0.5);
const seed = Number(process.argv[3] ?? 7);
const w = new World({ mode: 'normal', sector: 'ram', character: 'spark', seed, weaponPool: WEAPON_IDS, passivePool: PASSIVE_IDS });
const bot = new Bot({ skill, seed });
const dt = 1 / 60;
let frames = 0;
const t0 = performance.now();
let maxEnemies = 0;
while (w.t < 720 && frames < 60 * 800) {
  if (w.state === 'levelup') { w.chooseCard(bot.pick(w.choices, w)); continue; }
  if (w.state === 'dead' || w.state === 'won') break;
  bot.steer(w, dt);
  w.update(dt);
  frames++;
  maxEnemies = Math.max(maxEnemies, w.enemies.length);
  if (frames % 3600 === 0) console.log(`t=${w.t.toFixed(0)} lvl=${w.player.level} hp=${w.player.hp.toFixed(0)} enemies=${w.enemies.length} kills=${w.run.kills} weapons=${w.weapons.map(x=>x.id+x.level+(x.evo?'*':'')).join(',')}`);
}
console.log({ state: w.state, t: w.t.toFixed(1), level: w.player.level, kills: w.run.kills, maxEnemies, bits: w.computeBits(w.state==='won'), ms: (performance.now()-t0).toFixed(0), passives: w.passives.map(p=>p.id+p.level).join(','), dmg: w.run.damageBy });
