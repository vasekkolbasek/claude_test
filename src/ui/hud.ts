import * as THREE from 'three';
import { BNODES, nodeNameKey, type BNode } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { EnemyId } from '../data/units';
import type { Building } from '../entities/entities';
import { getLang, t, tk } from '../i18n';
import type { Game } from '../systems/Game';
import type { IconRenderer } from '../world/icons';
import type { Stage } from '../world/stage';
import { h, icon } from './dom';

export interface HudCallbacks {
  pause(): void;
  startNight(): void;
  rally(): void;
  ability(): void;
  coinsAd(): void;
  respawnAd(): void;
  choose(i: number): void;
  holdButton(on: boolean): void;
  speed(): void;
}

const _v = new THREE.Vector3();
const _p = { x: 0, y: 0, behind: false };

/** Statistic lines for an upgrade card, highlighting improvements over the current node. */
export function nodeStatLines(n: BNode, prev: BNode | null): { s: string; up: boolean }[] {
  const out: { s: string; up: boolean }[] = [];
  const a = n.stats, b = prev?.stats;
  if (a.income) out.push({ s: t('stat.income', { n: a.income }), up: a.income > (b?.income ?? 0) });
  if (a.attack) {
    const at = a.attack, bt = b?.attack;
    out.push({ s: t('stat.dmg', { n: Math.round(at.damage) }), up: !!bt && at.damage > bt.damage });
    out.push({ s: t('stat.rate', { n: (1 / at.cooldown).toFixed(1) }), up: !!bt && at.cooldown < bt.cooldown });
    if ((at.multishot ?? 1) > 1) out.push({ s: t('stat.multi', { n: at.multishot! }), up: (at.multishot ?? 1) > (bt?.multishot ?? 1) });
    if (at.splash) out.push({ s: t('stat.splash'), up: !bt?.splash });
    if (at.slow) out.push({ s: t('stat.slow'), up: !bt?.slow });
    if (at.burn) out.push({ s: t('stat.burn'), up: !bt?.burn });
    if (at.pierce) out.push({ s: t('stat.pierce', { n: at.pierce }), up: !bt?.pierce });
    if (bt && at.range > bt.range) out.push({ s: t('stat.range', { n: at.range.toFixed(1) }), up: true });
  }
  if (a.troops) out.push({ s: t('stat.troops', { n: a.troops.count }), up: a.troops.count > (b?.troops?.count ?? 0) });
  const buff = Math.round(((a.buffTroops ?? 0) + (a.buffTowers ?? 0) + (a.buffHero ?? 0)) / 3 * 100);
  if (n.kind === 'forge') out.push({ s: t('stat.buff', { n: buff }), up: !!b });
  if (a.hpTroops) out.push({ s: t('stat.hpTroops', { n: Math.round(a.hpTroops * 100) }), up: a.hpTroops > (b?.hpTroops ?? 0) });
  if (a.thorns) out.push({ s: t('stat.thorns', { n: a.thorns }), up: a.thorns > (b?.thorns ?? 0) });
  if (a.troopBurn) out.push({ s: t('stat.burn'), up: true });
  if (a.cleanBonus) out.push({ s: t('stat.clean', { n: a.cleanBonus }), up: a.cleanBonus > (b?.cleanBonus ?? 0) });
  out.push({ s: t('stat.hp', { n: a.hp }), up: !!b && a.hp > b.hp });
  return out;
}

export function nodeName(n: BNode): string { return tk(nodeNameKey(n.id)); }
export function nodeDesc(n: BNode): string { return tk(nodeNameKey(n.id) + '.d'); }

interface Label { el: HTMLDivElement; tag: HTMLSpanElement; num: HTMLSpanElement; name: HTMLDivElement; desc: HTMLDivElement; ring: HTMLDivElement; arc: SVGCircleElement; kh: HTMLSpanElement; state: string }

export class Hud {
  readonly root: HTMLDivElement;
  private coinsEl: HTMLDivElement;
  private coinsNum: HTMLSpanElement;
  private nightEl: HTMLDivElement;
  private nightTxt: HTMLSpanElement;
  private nightIcon: HTMLSpanElement;
  private startBtn: HTMLButtonElement;
  private adBtn: HTMLButtonElement;
  private buildBtn: HTMLButtonElement;
  private buildCost: HTMLSpanElement;
  private abilityBtn: HTMLButtonElement;
  private abilityCd: HTMLDivElement;
  private rallyBtn: HTMLButtonElement;
  private labels = new Map<Building, Label>();
  private labelLayer: HTMLDivElement;
  private waveLayer: HTMLDivElement;
  private waveEls: HTMLDivElement[] = [];
  private toasts: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private bossEl: HTMLDivElement;
  private bossFill: HTMLDivElement;
  private bossName: HTMLDivElement;
  private respawnEl: HTMLDivElement;
  private respawnTxt: HTMLDivElement;
  private respawnBtn: HTMLButtonElement;
  private choiceEl: HTMLDivElement | null = null;
  private lastCoins = -1;
  private lastNightTxt = '';
  private wavePlanNight = -1;
  coinsAdUsed = false;
  fast = false;
  private speedBtn: HTMLButtonElement;
  private rallyIcon: HTMLSpanElement;
  private troopMode = 'hold';
  private introEl: HTMLDivElement | null = null;
  respawnAdUsed = false;
  touch = false;
  private bigHold = false;

  constructor(parent: HTMLElement, private g: Game, private stage: Stage, private icons: IconRenderer, private cb: HudCallbacks) {
    this.root = h('div', { class: 'layer', id: 'hud' });
    this.labelLayer = h('div', { class: 'layer' });
    this.waveLayer = h('div', { class: 'layer' });
    this.coinsNum = h('span', null, '0');
    this.coinsEl = h('div', { class: 'pill coins' }, icon('coin'), this.coinsNum);
    this.nightIcon = icon('sun');
    this.nightTxt = h('span', null, '');
    this.nightEl = h('div', { class: 'pill night' }, this.nightIcon, this.nightTxt);
    const tl = h('div', { class: 'hud-tl' }, this.coinsEl, this.nightEl);
    const pauseBtn = h('button', { class: 'btn round', 'aria-label': 'pause', onclick: () => cb.pause() }, icon('pause'));
    this.speedBtn = h('button', { class: 'btn round speed hidden', 'aria-label': 'speed', onclick: () => cb.speed() }, '×2');
    const tr = h('div', { class: 'hud-tr' }, this.speedBtn, pauseBtn);
    this.startBtn = h('button', { class: 'btn night-btn', onclick: () => cb.startNight() }, icon('moon'), t('hud.startNight'), h('span', { class: 'kbd' }, 'Enter'));
    this.adBtn = h('button', { class: 'btn gold small', onclick: () => cb.coinsAd() }, h('span', { class: 'ad' }, icon('video')), icon('coin'), t('hud.coinsAd', { n: CONFIG.rewardCoins }));
    const bc = h('div', { class: 'hud-bc' }, this.adBtn, this.startBtn);

    this.buildCost = h('span', { class: 'cost' });
    this.buildBtn = h('button', { class: 'act big', 'aria-label': 'build' }, icon('hammer'), this.buildCost);
    const hold = (on: boolean) => (e: Event) => { e.preventDefault(); this.bigHold = on; cb.holdButton(on); this.buildBtn.classList.toggle('pressed', on); };
    this.buildBtn.addEventListener('pointerdown', (e) => { try { this.buildBtn.setPointerCapture(e.pointerId); } catch { /* */ } hold(true)(e); });
    this.buildBtn.addEventListener('pointerup', hold(false));
    this.buildBtn.addEventListener('pointercancel', hold(false));
    this.buildBtn.addEventListener('lostpointercapture', hold(false));
    this.abilityCd = h('div', { class: 'cd' });
    const abIcon = g.hero.weapon.id === 'bow' ? 'bow' : g.hero.weapon.id === 'spear' ? 'spear' : g.hero.weapon.id === 'staff' ? 'staff' : 'sword';
    this.abilityBtn = h('button', { class: 'act', 'aria-label': 'ability', onpointerdown: (e: Event) => { e.preventDefault(); cb.ability(); } }, icon(abIcon), this.abilityCd, h('span', { class: 'key' }, 'Q'));
    this.rallyIcon = icon('flag');
    this.rallyBtn = h('button', { class: 'act small', 'aria-label': 'troops', onpointerdown: (e: Event) => { e.preventDefault(); cb.rally(); } }, this.rallyIcon, h('span', { class: 'key' }, 'R'));
    const br = h('div', { class: 'hud-br' }, this.rallyBtn, h('div'), this.abilityBtn, this.buildBtn);

    this.toasts = h('div', { class: 'toasts' });
    this.hintEl = h('div', { class: 'hint hidden' });
    this.bossName = h('div');
    this.bossFill = h('div', { class: 'fill' });
    this.bossEl = h('div', { class: 'bossbar hidden' }, this.bossName, h('div', { class: 'bar' }, this.bossFill));
    this.respawnTxt = h('div', { class: 't' });
    this.respawnBtn = h('button', { class: 'btn gold', onclick: () => cb.respawnAd() }, h('span', { class: 'ad' }, icon('video')), t('hud.respawnAd'));
    this.respawnEl = h('div', { class: 'respawn hidden' }, this.respawnTxt, this.respawnBtn);

    this.root.append(this.waveLayer, this.labelLayer, tl, tr, this.bossEl, this.hintEl, this.toasts, this.respawnEl, bc, br);
    for (const el of [tl, this.labelLayer, this.waveLayer, this.toasts, this.hintEl, this.bossEl]) el.style.pointerEvents = 'none';
    parent.appendChild(this.root);
  }

  setTouch(on: boolean): void {
    this.touch = on;
    this.root.querySelectorAll('.act .key, .kbd').forEach((k) => ((k as HTMLElement).style.display = on ? 'none' : ''));
  }

  get holding(): boolean { return this.bigHold; }

  // ------------------------------------------------------------ messages
  toast(text: string, kind: '' | 'good' | 'ach' = ''): void {
    const el = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2300);
    while (this.toasts.children.length > 4) this.toasts.firstChild!.remove();
  }

  banner(big: string, sub = ''): void {
    this.root.querySelectorAll('.banner').forEach((b) => b.remove());
    const el = h('div', { class: 'banner' }, h('div', { class: 'big' }, big), sub ? h('div', { class: 'sub' }, sub) : null);
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  floatText(x: number, y: number, z: number, text: string): void {
    _v.set(x, y, z);
    this.stage.project(_v, _p);
    if (_p.behind) return;
    const el = h('div', { class: 'float-text', style: { left: `${_p.x}px`, top: `${_p.y}px` } }, text);
    this.labelLayer.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  hint(text: string | null): void {
    if (!text) { this.hintEl.classList.add('hidden'); return; }
    if (this.hintEl.textContent !== text || this.hintEl.classList.contains('hidden')) {
      this.hintEl.textContent = text;
      this.hintEl.classList.remove('hidden');
    }
  }

  /** "New enemy" cards shown at the start of a day. */
  showIntro(items: { icon: string; name: string; desc: string; boss: boolean }[]): void {
    this.introEl?.remove();
    const el = h('div', { class: 'intro', onclick: () => el.remove() },
      items.map((it) => h('div', { class: 'row' },
        it.icon ? h('img', { src: it.icon, alt: '' }) : null,
        h('div', null, h('div', { class: 'k' }, it.boss ? t('hud.newBoss') : t('hud.newEnemy')), h('div', { class: 'n' }, it.name), h('div', { class: 'd' }, it.desc)),
      )),
    );
    this.introEl = el;
    this.root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 9000);
  }

  hideIntro(): void { this.introEl?.remove(); this.introEl = null; }

  // ------------------------------------------------------------ choice
  showChoice(b: Building, options: BNode[]): void {
    this.hideChoice();
    const cards = options.map((n, i) =>
      h('div', { class: 'card', onclick: () => this.cb.choose(i) },
        h('span', { class: 'key' }, this.touch ? '' : String(i + 1)),
        h('div', { class: 'img' }, h('img', { src: this.icons.building(n), alt: '' })),
        h('div', { class: 't' }, nodeName(n)),
        h('div', { class: 'd' }, nodeDesc(n)),
        h('div', { class: 'stats' }, nodeStatLines(n, b.node).map((l) => h('span', { class: l.up ? 'up' : '' }, l.s))),
      ),
    );
    this.choiceEl = h('div', { class: 'screen dim' },
      h('div', { class: 'panel', style: { maxWidth: '680px' } },
        h('h2', null, t('choice.title')),
        h('div', { class: 'sub' }, t('choice.sub')),
        h('div', { class: 'scroll' }, h('div', { class: 'choice' }, cards)),
      ),
    );
    this.root.appendChild(this.choiceEl);
  }

  hideChoice(): void {
    this.choiceEl?.remove();
    this.choiceEl = null;
  }

  get choiceOpen(): boolean { return !!this.choiceEl; }

  // ------------------------------------------------------------ per-frame
  update(): void {
    const g = this.g;
    // Coins
    const shown = g.coins;
    if (shown !== this.lastCoins) {
      if (this.lastCoins >= 0 && shown > this.lastCoins) {
        this.coinsEl.classList.remove('bump');
        void this.coinsEl.offsetWidth;
        this.coinsEl.classList.add('bump');
      }
      this.lastCoins = shown;
      this.coinsNum.textContent = String(shown);
    }
    // Night label
    const night = g.phase === 'night';
    let nt = night || g.phase === 'defeat'
      ? (g.cfg.endless ? t('hud.nightEndless', { n: g.night }) : t('hud.night', { n: g.night, m: g.map.nights }))
      : (g.cfg.endless ? t('hud.dayEndless', { n: g.night }) : t('hud.dayN', { n: g.night, m: g.map.nights }));
    if (night && g.enemiesAlive > 0) nt += ` · ${g.enemiesAlive}`;
    if (nt !== this.lastNightTxt) {
      this.lastNightTxt = nt;
      this.nightTxt.textContent = nt;
      this.nightIcon.innerHTML = (night ? icon('moon') : icon('sun')).innerHTML;
    }
    const day = g.phase === 'day';
    this.startBtn.classList.toggle('hidden', !day || this.choiceOpen);
    this.adBtn.classList.toggle('hidden', !day || this.coinsAdUsed || this.choiceOpen);

    // Build button
    const slot = g.activeSlot();
    const act = slot ? g.actionFor(slot) : null;
    this.buildBtn.classList.toggle('hidden', !this.touch || !act);
    if (act) {
      this.buildCost.replaceChildren(icon('coin'), String(act.cost));
      this.buildBtn.classList.toggle('off', act.cost > g.coins);
    }
    // Ability
    const h0 = g.hero;
    const cdFrac = h0.abilityCd > 0 ? h0.abilityCd / (h0.weapon.abilityCd * g.mods.abilityCd) : 0;
    this.abilityCd.style.background = cdFrac > 0 ? `conic-gradient(rgba(20,10,30,.6) ${cdFrac * 360}deg, transparent 0)` : 'none';
    this.abilityBtn.classList.toggle('cooling', cdFrac > 0);
    this.abilityBtn.classList.toggle('ready', cdFrac === 0 && night && h0.alive);
    const hasTroops = g.units.some((u) => u.team === 0 && u.alive);
    this.rallyBtn.classList.toggle('hidden', !hasTroops);
    this.rallyBtn.classList.toggle('on', g.troopMode === 'charge');
    if (this.troopMode !== g.troopMode) {
      this.troopMode = g.troopMode;
      this.rallyIcon.innerHTML = icon(g.troopMode === 'charge' ? 'sword' : 'flag').innerHTML;
    }
    this.speedBtn.classList.toggle('hidden', !night);
    this.speedBtn.classList.toggle('on', this.fast);

    // Respawn
    const dead = !h0.alive;
    this.respawnEl.classList.toggle('hidden', !dead);
    if (dead) {
      this.respawnTxt.textContent = t('hud.respawnIn', { n: Math.ceil(h0.deadT) });
      this.respawnBtn.classList.toggle('hidden', this.respawnAdUsed || h0.deadT < 1.5);
    }

    // Boss bar
    const boss = g.bossUnit;
    this.bossEl.classList.toggle('hidden', !boss || !boss.alive);
    if (boss && boss.alive) {
      this.bossName.textContent = tk(`unit.${boss.def.id}`);
      this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }

    this.updateLabels(slot);
    this.updateWaves();
  }

  private makeLabel(): Label {
    const num = h('span');
    const tag = h('span', { class: 'tag' }, icon('coin'), num);
    const name = h('div', { class: 'name' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    const bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('cx', '32'); bg.setAttribute('cy', '32'); bg.setAttribute('r', '27');
    bg.setAttribute('fill', 'rgba(30,20,50,.35)'); bg.setAttribute('stroke', 'rgba(255,255,255,.55)'); bg.setAttribute('stroke-width', '6');
    const arc = document.createElementNS(svgNS, 'circle');
    arc.setAttribute('cx', '32'); arc.setAttribute('cy', '32'); arc.setAttribute('r', '27');
    arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', '#ffd34d'); arc.setAttribute('stroke-width', '6'); arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', `${2 * Math.PI * 27}`);
    svg.append(bg, arc);
    const kh = h('span', { class: 'kh' });
    const ring = h('div', { class: 'ring' }, svg, kh);
    const desc = h('div', { class: 'desc' });
    const el = h('div', { class: 'slot-label' }, name, desc, tag, ring);
    this.labelLayer.appendChild(el);
    return { el, tag, num, name, desc, ring, arc, kh, state: '' };
  }

  private updateLabels(active: Building | null): void {
    const g = this.g;
    const day = g.phase === 'day' && !this.choiceOpen;
    for (const b of g.buildings) {
      const act = day ? g.actionFor(b) : null;
      const isActive = b === active && !!act;
      const near = Math.hypot(b.x - g.hero.x, b.z - g.hero.z) < 16;
      const upgradable = !!act && !!b.node && act.cost <= g.coins && Math.hypot(b.x - g.hero.x, b.z - g.hero.z) < 14;
      const show = !!act && (isActive || (!b.node && near) || upgradable);
      let lab = this.labels.get(b);
      if (!show) {
        if (lab && lab.state !== 'hide') { lab.el.style.display = 'none'; lab.state = 'hide'; }
        continue;
      }
      if (!lab) { lab = this.makeLabel(); this.labels.set(b, lab); }
      const yOff = b.node ? (b.kind === 'castle' ? 8.6 : b.kind === 'wall' ? 2.8 : 4.6) : 0.6;
      _v.set(b.x, g.heightAt(b.x, b.z) + yOff, b.z);
      this.stage.project(_v, _p);
      if (_p.behind) { lab.el.style.display = 'none'; lab.state = 'hide'; continue; }
      const state = isActive ? 'active' : 'far';
      if (lab.state !== state) {
        lab.el.style.display = '';
        lab.el.classList.toggle('far', !isActive);
        lab.ring.style.display = isActive && !this.touch ? '' : 'none';
        lab.name.style.display = isActive ? '' : 'none';
        lab.desc.style.display = isActive ? '' : 'none';
        lab.state = state;
      }
      lab.el.style.transform = `translate(${_p.x}px, ${_p.y}px) translate(-50%, -100%)`;
      lab.el.style.left = '0';
      lab.el.style.top = '0';
      const cost = act!.cost;
      if (lab.num.textContent !== String(cost)) lab.num.textContent = String(cost);
      lab.tag.classList.toggle('poor', cost > g.coins);
      lab.el.classList.toggle('up', !!b.node);
      if (isActive) {
        const nm = b.node ? `${nodeName(b.node)} → ${t('hud.upgrade')}` : nodeName(BNODES[b.kind]);
        if (lab.name.textContent !== nm) lab.name.textContent = nm;
        const ds = b.node ? t('hud.upgradeHint') : nodeDesc(BNODES[b.kind]);
        if (lab.desc.textContent !== ds) lab.desc.textContent = ds;
        const prog = g.hold && g.hold.b === b ? g.hold.t / g.hold.need : 0;
        const L = 2 * Math.PI * 27;
        lab.arc.setAttribute('stroke-dashoffset', String(L * (1 - prog)));
        const kh = this.touch ? '' : getLang() === 'ru' ? 'Пробел' : 'Space';
        if (lab.kh.textContent !== kh) lab.kh.textContent = kh;
      }
    }
  }

  private updateWaves(): void {
    const g = this.g;
    const day = g.phase === 'day' && !this.choiceOpen;
    if (!day) {
      for (const el of this.waveEls) el.style.display = 'none';
      return;
    }
    if (this.wavePlanNight !== g.plan.night) {
      this.wavePlanNight = g.plan.night;
      this.waveLayer.replaceChildren();
      this.waveEls = [];
      for (const path of g.plan.paths) {
        const m = g.plan.preview.get(path);
        if (!m) continue;
        const items = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        const el = h('div', { class: 'wave-ind' }, h('div', { class: 'arrow' }),
          items.map(([u, n]: [EnemyId, number]) => [h('img', { src: this.icons.unit(u), alt: '' }), h('span', { class: 'cnt' }, `×${n}`)]).flat(),
        );
        el.dataset.path = String(path);
        this.waveLayer.appendChild(el);
        this.waveEls.push(el);
      }
    }
    const W = window.innerWidth, H = window.innerHeight;
    const margin = 70;
    for (const el of this.waveEls) {
      const path = Number(el.dataset.path);
      const line = g.paths[path];
      const pt = line.sample(Math.min(6, line.length * 0.15), { x: 0, z: 0, tx: 0, tz: 0 });
      _v.set(pt.x, g.heightAt(pt.x, pt.z) + 1.5, pt.z);
      this.stage.project(_v, _p);
      let x = _p.x, y = _p.y;
      const cx = W / 2, cy = H / 2;
      if (_p.behind) { x = cx + (cx - x) * 10; y = cy + (cy - y) * 10; }
      const off = x < margin || x > W - margin || y < margin + 40 || y > H - margin - 60;
      const arrow = el.firstChild as HTMLDivElement;
      if (off) {
        const dx = x - cx, dy = y - cy;
        const kx = dx !== 0 ? (W / 2 - margin) / Math.abs(dx) : Infinity;
        const ky = dy !== 0 ? (H / 2 - margin - 50) / Math.abs(dy) : Infinity;
        const k = Math.min(kx, ky, 1);
        x = cx + dx * k;
        y = cy + dy * k;
        const ang = Math.atan2(dy, dx);
        arrow.style.display = '';
        arrow.style.transform = `rotate(${ang}rad) translate(46px)`;
      } else arrow.style.display = 'none';
      el.style.display = '';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }

  dispose(): void {
    this.root.remove();
    this.labels.clear();
  }
}
