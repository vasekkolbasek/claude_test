import { formatTime } from '../core/math';
import { PASSIVES } from '../data/passives';
import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type { World } from '../game/World';
import { t } from '../i18n';
import { h, hexColor } from './dom';
import { icon } from './icons';

export class Hud {
  readonly el: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpBox: HTMLElement;
  private readonly lvl: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly items: HTMLElement;
  private readonly boss: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly danger: HTMLElement;
  private readonly banners: HTMLElement;
  private readonly bossPtr: HTMLElement;
  private bossPtrOn = false;
  private hintEl: HTMLElement | null = null;
  private lastXp = -1;
  private lastLvl = -1;
  private lastSec = -1;
  private lastKills = -1;
  private lastItems = '';
  private lastBoss = '';
  private lastBossFrac = -1;
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
    this.bossName = h('div', { cls: 'nm' });
    this.bossFill = h('i');
    this.boss = h('div', { cls: 'bossbar' }, this.bossName, h('div', { cls: 'bb' }, this.bossFill));
    this.banners = h('div');
    this.bossPtr = h('div', { cls: 'boss-ptr' }, h('i'));
    this.danger = h('div', { cls: 'danger-vignette' });
    this.el = h(
      'div',
      { cls: 'hud' },
      this.xpBox,
      h('div', { cls: 'bar2' }, this.lvl, this.timer, this.kills, pauseBtn),
      this.items,
      this.boss,
      this.banners,
      this.bossPtr,
    );
    document.body.appendChild(this.danger);
  }

  reset(): void {
    this.lastXp = this.lastLvl = this.lastSec = this.lastKills = -1;
    this.lastItems = '';
    this.lastBoss = '';
    this.lastBossFrac = -1;
    // the boss bar / pointer only change on a boss switch, so a run that ended mid-fight would
    // otherwise leave them on screen for the next run
    this.boss.classList.remove('on');
    this.bossFill.style.transform = 'scaleX(1)';
    this.bossPtrOn = false;
    this.bossPtr.classList.remove('on');
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
    const sig = w.weapons.map((x) => `${x.id}${x.level}${x.evo ? 'e' : ''}`).join(',') + '|' + w.passives.map((x) => `${x.id}${x.level}`).join(',');
    if (sig !== this.lastItems) {
      this.lastItems = sig;
      this.renderItems(w);
    }
    // boss bar: the strongest alive boss
    const b = w.boss ?? w.bosses[0] ?? null;
    const key = b ? `${b.uid}` : '';
    if (key !== this.lastBoss) {
      this.lastBoss = key;
      this.boss.classList.toggle('on', !!b);
      if (b) this.bossName.textContent = t(`e.${b.def.id}`);
    }
    if (b) {
      const f = Math.max(0, b.hp / b.maxHp);
      if (Math.abs(f - this.lastBossFrac) > 0.002) {
        this.lastBossFrac = f;
        this.bossFill.style.transform = `scaleX(${f.toFixed(3)})`;
      }
    }
    this.setDanger(p.hp / w.stats.maxHp < 0.3 && w.state === 'playing');
    this.updateBossPointer(w, b);
  }

  /** Edge arrow towards an off-screen boss. */
  private updateBossPointer(w: World, b: World['boss']): void {
    let on = false;
    if (b) {
      const dx = b.x - w.player.x;
      const dy = b.y - w.player.y;
      const { hw, hh } = w.view;
      if (Math.abs(dx) > hw + b.r * 0.5 || Math.abs(dy) > hh + b.r * 0.5) {
        on = true;
        const k = Math.min((hw * 0.9) / Math.max(1e-6, Math.abs(dx)), (hh * 0.84) / Math.max(1e-6, Math.abs(dy)));
        const x = 50 + ((dx * k) / hw) * 50;
        const y = 50 + ((dy * k) / hh) * 50;
        this.bossPtr.style.left = `${x.toFixed(2)}%`;
        this.bossPtr.style.top = `${y.toFixed(2)}%`;
        this.bossPtr.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
      }
    }
    if (on !== this.bossPtrOn) {
      this.bossPtrOn = on;
      this.bossPtr.classList.toggle('on', on);
    }
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
