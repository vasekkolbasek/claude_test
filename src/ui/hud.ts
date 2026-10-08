import { formatTime } from '../core/math';
import { PASSIVES } from '../data/passives';
import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type { Enemy } from '../game/entities';
import type { World } from '../game/World';
import { t } from '../i18n';
import { h, hexColor } from './dom';
import { icon } from './icons';

/** at most this many boss bars at once (endless can stack mini-bosses) */
const MAX_BOSS_BARS = 3;

interface BossSlot {
  uid: number;
  frac: number;
  bar: HTMLElement;
  name: HTMLElement;
  fill: HTMLElement;
  ptr: HTMLElement;
  ptrOn: boolean;
}

export class Hud {
  readonly el: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpBox: HTMLElement;
  private readonly lvl: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly items: HTMLElement;
  /** one bar per alive boss (a slot keeps its boss until it dies, so bars do not jump) */
  private readonly bossBox: HTMLElement;
  private readonly bossSlots: BossSlot[] = [];
  private readonly danger: HTMLElement;
  private readonly hpRow: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpTrail: HTMLElement;
  private readonly hpText: HTMLElement;
  private lastHpText = '';
  private hpFrac = 1;
  private trailFrac = 1;
  private lastHpT = 0;
  private readonly banners: HTMLElement;
  private hintEl: HTMLElement | null = null;
  private lastXp = -1;
  private lastLvl = -1;
  private lastSec = -1;
  private lastKills = -1;
  /** last rendered loadout: id, level, evolved flag per item (compared without building strings) */
  private readonly seenItems: (string | number | boolean)[] = [];
  private dangerOn = false;

  constructor(onPause: () => void) {
    this.xpFill = h('i');
    this.xpBox = h('div', { cls: 'xp' }, this.xpFill);
    this.lvl = h('div', { cls: 'lvl' });
    this.timer = h('div', { cls: 'timer' });
    this.kills = h('div', { cls: 'kills' });
    const pauseBtn = h('button', { cls: 'btn icon-only pause-btn', attrs: { 'aria-label': t('hud.pause') }, onClick: () => onPause() }, icon('pause'));
    pauseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.items = h('div', { cls: 'items' });
    for (let i = 0; i < MAX_BOSS_BARS; i++) {
      const name = h('div', { cls: 'nm' });
      const fill = h('i');
      this.bossSlots.push({
        uid: 0,
        frac: -1,
        bar: h('div', { cls: 'bossbar' }, name, h('div', { cls: 'bb' }, fill)),
        name,
        fill,
        ptr: h('div', { cls: 'boss-ptr' }, h('i')),
        ptrOn: false,
      });
    }
    this.bossBox = h('div', { cls: 'bossbars' }, ...this.bossSlots.map((x) => x.bar));
    this.banners = h('div');
    this.danger = h('div', { cls: 'danger-vignette' });
    // health: heart + bar (with a short white «just lost» trail) + numbers
    this.hpFill = h('i');
    this.hpTrail = h('s');
    this.hpText = h('b');
    this.hpRow = h('div', { cls: 'hp-row' }, icon('maxhp'), h('div', { cls: 'hp-bar' }, this.hpTrail, this.hpFill), this.hpText);
    this.el = h(
      'div',
      { cls: 'hud' },
      this.xpBox,
      h('div', { cls: 'bar2' }, this.lvl, this.timer, this.kills, pauseBtn),
      this.hpRow,
      this.items,
      this.bossBox,
      this.banners,
      ...this.bossSlots.map((x) => x.ptr),
    );
    document.body.appendChild(this.danger);
  }

  reset(): void {
    this.lastXp = this.lastLvl = this.lastSec = this.lastKills = -1;
    this.seenItems.length = 0;
    this.lastHpText = '';
    this.hpFrac = this.trailFrac = 1;
    this.lastHpT = 0;
    this.hpRow.classList.remove('low');
    // boss bars / pointers only change when a boss comes or goes, so a run that ended mid-fight
    // would otherwise leave them on screen for the next run
    for (const slot of this.bossSlots) this.freeSlot(slot);
    this.bossBox.classList.remove('multi');
    this.banners.textContent = '';
    this.hideHint();
    this.setDanger(false);
  }

  update(w: World): void {
    const p = w.player;
    const xp = Math.min(1, p.xp / p.xpNext);
    if (Math.abs(xp - this.lastXp) > 0.002) {
      this.lastXp = xp;
      this.xpFill.style.transform = `scaleX(${xp.toFixed(3)})`;
    }
    if (p.level !== this.lastLvl) {
      this.lastLvl = p.level;
      this.lvl.textContent = t('hud.lv', { n: p.level });
    }
    const sec = Math.floor(w.t);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.timer.textContent = formatTime(w.t);
    }
    if (w.run.kills !== this.lastKills) {
      this.lastKills = w.run.kills;
      this.kills.textContent = '';
      this.kills.append(icon('kills'), String(w.run.kills));
    }
    if (this.loadoutChanged(w)) this.renderItems(w);
    this.updateBosses(w);
    this.updateHp(p.hp, w.stats.maxHp);
    this.setDanger(p.hp / w.stats.maxHp < 0.3 && w.state === 'playing');
  }

  /** True (and remembered) when a weapon or module was added, upgraded or evolved. */
  private loadoutChanged(w: World): boolean {
    const seen = this.seenItems;
    let i = 0;
    let changed = false;
    const check = (v: string | number | boolean) => {
      if (seen[i] !== v) {
        seen[i] = v;
        changed = true;
      }
      i++;
    };
    for (const x of w.weapons) {
      check(x.id);
      check(x.level);
      check(x.evo);
    }
    check('|');
    for (const x of w.passives) {
      check(x.id);
      check(x.level);
    }
    if (seen.length !== i) {
      seen.length = i;
      changed = true;
    }
    return changed;
  }

  /**
   * A bar for every alive boss (up to MAX_BOSS_BARS): a mini-boss that outlives the next one's
   * arrival keeps its own bar. A slot stays with its boss until it dies; the final boss is
   * shown on top (CSS order).
   */
  private updateBosses(w: World): void {
    for (const slot of this.bossSlots) {
      if (slot.uid && !w.bosses.some((b) => b.uid === slot.uid)) this.freeSlot(slot);
    }
    for (const b of w.bosses) {
      let slot = this.bossSlots.find((x) => x.uid === b.uid);
      if (!slot) {
        slot = this.bossSlots.find((x) => x.uid === 0);
        if (!slot) continue;
        slot.uid = b.uid;
        slot.frac = -1;
        slot.name.textContent = t(`e.${b.def.id}`);
        slot.bar.classList.toggle('final', b.def.boss === 'final');
        slot.bar.classList.add('on');
      }
      const f = Math.max(0, b.hp / b.maxHp);
      if (Math.abs(f - slot.frac) > 0.002) {
        slot.frac = f;
        slot.fill.style.transform = `scaleX(${f.toFixed(3)})`;
      }
      this.updateBossPointer(w, b, slot);
    }
    this.bossBox.classList.toggle('multi', this.bossSlots.filter((x) => x.uid).length > 1);
  }

  private freeSlot(slot: BossSlot): void {
    slot.uid = 0;
    slot.frac = -1;
    slot.bar.classList.remove('on', 'final');
    slot.fill.style.transform = 'scaleX(1)';
    if (slot.ptrOn) {
      slot.ptrOn = false;
      slot.ptr.classList.remove('on');
    }
  }

  /** Edge arrow towards an off-screen boss. */
  private updateBossPointer(w: World, b: Enemy, slot: BossSlot): void {
    const dx = b.x - w.player.x;
    const dy = b.y - w.player.y;
    const { hw, hh } = w.view;
    const on = Math.abs(dx) > hw + b.r * 0.5 || Math.abs(dy) > hh + b.r * 0.5;
    if (on) {
      const k = Math.min((hw * 0.9) / Math.max(1e-6, Math.abs(dx)), (hh * 0.84) / Math.max(1e-6, Math.abs(dy)));
      const x = 50 + ((dx * k) / hw) * 50;
      const y = 50 + ((dy * k) / hh) * 50;
      slot.ptr.style.left = `${x.toFixed(2)}%`;
      slot.ptr.style.top = `${y.toFixed(2)}%`;
      slot.ptr.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
    }
    if (on !== slot.ptrOn) {
      slot.ptrOn = on;
      slot.ptr.classList.toggle('on', on);
    }
  }

  private updateHp(hp: number, max: number): void {
    const now = performance.now();
    const dt = this.lastHpT ? Math.min(0.1, (now - this.lastHpT) / 1000) : 0;
    this.lastHpT = now;
    const f = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    // the trail lingers for a moment, then slides down to the current value
    this.trailFrac = f >= this.trailFrac ? f : Math.max(f, this.trailFrac - dt * 0.6);
    if (Math.abs(f - this.hpFrac) > 0.002 || dt === 0) {
      this.hpFrac = f;
      this.hpFill.style.transform = `scaleX(${f.toFixed(3)})`;
    }
    this.hpTrail.style.transform = `scaleX(${this.trailFrac.toFixed(3)})`;
    const text = `${Math.ceil(Math.max(0, hp))} / ${Math.round(max)}`;
    if (text !== this.lastHpText) {
      this.lastHpText = text;
      this.hpText.textContent = text;
    }
    this.hpRow.classList.toggle('low', f < 0.3);
  }

  private setDanger(on: boolean): void {
    if (on === this.dangerOn) return;
    this.dangerOn = on;
    this.danger.classList.toggle('on', on);
  }

  private renderItems(w: World): void {
    this.items.textContent = '';
    for (const wp of w.weapons) {
      const color = wp.evo ? EVOLUTIONS[WEAPONS[wp.id].evolution].color : WEAPONS[wp.id].color;
      const el = h('div', { cls: `item ${wp.evo ? 'evo' : ''}`, style: { color: hexColor(color), 'border-color': hexColor(color) } }, icon(wp.id), h('b', { text: wp.evo ? '★' : String(wp.level) }));
      this.items.appendChild(el);
    }
    for (const ps of w.passives) {
      const color = PASSIVES[ps.id].color;
      this.items.appendChild(h('div', { cls: 'item', style: { color: hexColor(color) } }, icon(ps.id), h('b', { text: String(ps.level) })));
    }
  }

  banner(text: string, kind: 'boss' | 'info' | 'gold'): void {
    // banners share one spot on screen: a new one replaces the one still showing
    this.banners.textContent = '';
    const el = h('div', { cls: `banner ${kind}`, text });
    this.banners.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  flashXp(): void {
    this.xpBox.classList.add('flash');
    setTimeout(() => this.xpBox.classList.remove('flash'), 120);
  }

  showHint(text: string, hand = false): void {
    this.hideHint();
    const el = h('div', { cls: 'hint' }, hand ? h('i', { cls: 'hand' }) : null, h('span', { text }));
    this.el.appendChild(el);
    this.hintEl = el;
  }

  hideHint(): void {
    const el = this.hintEl;
    if (!el) return;
    this.hintEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }

  get hasHint(): boolean {
    return this.hintEl !== null;
  }

  destroy(): void {
    this.setDanger(false);
  }
}
