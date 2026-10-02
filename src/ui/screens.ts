import { ACHIEVEMENTS } from '../data/achievements';
import { MAP_IDS, MAPS, type MapId } from '../data/maps';
import { MUTATORS, MUTATOR_UNLOCK_LEVEL, PERKS, gloryForLevel, levelForGlory, mutatorMultiplier, perkSlots, type MutatorId, type PerkId } from '../data/perks';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../data/weapons';
import { getLang, t, tk } from '../i18n';
import type { Platform } from '../platform/Platform';
import type { SaveManager } from '../save/save';
import { isMapUnlocked } from '../systems/meta';
import type { IconRenderer } from '../world/icons';
import { h, icon } from './dom';

export interface UiHost {
  save: SaveManager;
  platform: Platform;
  icons: IconRenderer;
  startRun(map: MapId, endless: boolean): void;
  continueRun(): void;
  applySettings(): void;
  resetProgress(): void;
  click(): void;
}

export interface ResultsData {
  victory: boolean;
  endless: boolean;
  map: MapId;
  nights: number;
  kills: number;
  lost: number;
  glory: number;
  mult: number;
  levelBefore: number;
  levelAfter: number;
  unlocks: string[];
  achievements: string[];
  record: boolean;
  mapUnlocked: boolean;
  canDouble: boolean;
}

const WEAPON_ICON: Record<WeaponId, 'sword' | 'bow' | 'spear' | 'staff'> = { sword: 'sword', bow: 'bow', spear: 'spear', staff: 'staff' };

export class Screens {
  readonly root: HTMLDivElement;
  private current: HTMLElement | null = null;
  private modal: HTMLElement | null = null;

  constructor(parent: HTMLElement, private host: UiHost) {
    this.root = h('div', { class: 'layer', id: 'screens' });
    parent.appendChild(this.root);
  }

  private get save() { return this.host.save.data; }

  private set(el: HTMLElement | null): void {
    this.current?.remove();
    this.current = el;
    if (el) this.root.appendChild(el);
  }

  clear(): void { this.set(null); this.closeModal(); }
  get open(): boolean { return !!this.current || !!this.modal; }

  private btn(label: (Node | string)[] | string, cls: string, fn: () => void): HTMLButtonElement {
    return h('button', { class: `btn ${cls}`, onclick: () => { this.host.click(); fn(); } }, ...(Array.isArray(label) ? label : [label]));
  }

  private head(title: string, back: () => void): HTMLElement {
    return h('div', { class: 'panel-head' },
      h('button', { class: 'btn ghost round', 'aria-label': t('back'), onclick: () => { this.host.click(); back(); } }, icon('back')),
      h('h2', null, title),
      h('div', { class: 'spacer' }),
    );
  }

  // ------------------------------------------------------------ main menu
  showMenu(): void {
    const s = this.save;
    const lvl = levelForGlory(s.glory);
    const cur = gloryForLevel(lvl), next = gloryForLevel(lvl + 1);
    const frac = Math.min(1, (s.glory - cur) / Math.max(1, next - cur));
    const run = s.run;
    const items: HTMLElement[] = [];
    if (run) {
      items.push(this.btn([icon('play'), h('span', null, t('menu.continue'), h('div', { class: 'cont-info' }, t('menu.continueInfo', { map: tk(`map.${run.map}`), n: run.night })))], 'gold play', () => this.host.continueRun()));
      items.push(this.btn([icon('flag'), t('menu.newRun')], 'small', () => this.confirm(t('menu.newRunConfirm'), () => this.showMaps())));
    } else {
      items.push(this.btn([icon('play'), t('menu.play')], 'gold play', () => this.quickPlay()));
    }
    const grid = h('div', { class: 'grid2' },
      this.btn([icon('map'), t('menu.maps')], '', () => this.showMaps()),
      this.btn([icon('sword'), t('menu.armory')], '', () => this.showArmory(() => this.showMenu())),
      this.btn([icon('skull'), t('menu.mutators')], 'violet', () => this.showMutators(() => this.showMenu())),
      this.btn([icon('star'), t('menu.achievements')], 'violet', () => this.showAchievements()),
      this.btn([icon('trophy'), t('menu.leaders')], 'green', () => this.showLeaders()),
      this.btn([icon('gear'), t('menu.settings')], 'ghost', () => this.showSettings(() => this.showMenu())),
    );
    const title = t('title');
    const words = title.split(' ');
    const logo = h('div', { class: 'logo' },
      h('span', { class: 'l1' }, words[0]),
      h('span', { class: 'l2' }, words.slice(1).join(' ')),
      h('span', { class: 'tag' }, t('subtitle')),
    );
    const ruler = h('div', { class: 'ruler' }, icon('crown'), h('span', null, t('ruler.level', { n: lvl })), h('div', { class: 'xp' }, h('div', { style: { width: `${frac * 100}%` } })));
    this.set(h('div', { class: 'menu' }, h('div', { class: 'side' }, logo, ruler, ...items, grid)));
  }

  private quickPlay(): void {
    // Start on the first map that is unlocked but not yet won (or the last one).
    let pick: MapId = 'valley';
    for (const id of MAP_IDS) if (isMapUnlocked(this.save, id)) { pick = id; if (!this.save.maps[id].won) break; }
    this.host.startRun(pick, false);
  }

  // ------------------------------------------------------------ maps
  showMaps(): void {
    const s = this.save;
    const cards = MAP_IDS.map((id) => {
      const m = MAPS[id];
      const unlocked = isMapUnlocked(s, id);
      const p = s.maps[id];
      return h('div', { class: `card ${unlocked ? '' : 'locked'}` },
        p.won ? h('span', { class: 'badge done' }, icon('check'), t('map.won')) : null,
        h('div', { class: 't' }, tk(`map.${id}`)),
        h('div', { class: 'd' }, tk(`map.${id}.d`)),
        h('div', { class: 'stats' }, h('span', null, t('map.nights', { n: m.nights })), p.best ? h('span', null, t('map.best', { n: p.best })) : null, p.endlessBest ? h('span', null, t('map.endlessBest', { n: p.endlessBest })) : null),
        unlocked
          ? h('div', { class: 'row', style: { marginTop: 'auto' } },
            this.btn([icon('flag'), t('map.start')], 'gold small', () => this.host.startRun(id, false)),
            p.won ? this.btn([icon('moon'), t('map.endless')], 'violet small', () => this.host.startRun(id, true)) : null,
          )
          : h('div', { class: 'd' }, icon('lock'), ' ', t('map.locked')),
        unlocked && !p.won ? h('div', { class: 'd', style: { fontSize: '12px' } }, icon('moon'), ' ', t('map.endlessLocked')) : null,
      );
    });
    const perks = s.perks.length ? s.perks.map((p) => tk(`perk.${p}`)).join(', ') : t('map.none');
    const muts = s.mutators.length ? `×${mutatorMultiplier(s.mutators)}` : t('map.none');
    const loadout = h('div', { class: 'item' }, icon(WEAPON_ICON[s.weapon], 'big'),
      h('div', { class: 'grow' }, h('div', { class: 'd' }, t('map.loadout', { w: tk(`weapon.${s.weapon}`), p: perks, m: muts }))),
      this.btn([icon('gear')], 'small ghost', () => this.showArmory(() => this.showMaps())),
    );
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      this.head(t('map.title'), () => this.showMenu()),
      h('div', { class: 'scroll' }, h('div', { class: 'cards' }, cards)),
      loadout,
    )));
  }

  // ------------------------------------------------------------ armory
  showArmory(back: () => void): void {
    const s = this.save;
    const lvl = levelForGlory(s.glory);
    const wcards = WEAPON_IDS.map((id) => {
      const w = WEAPONS[id];
      const locked = lvl < w.unlockLevel;
      return h('div', {
        class: `card ${s.weapon === id ? 'sel' : ''} ${locked ? 'locked' : ''}`,
        onclick: () => { if (locked) return; this.host.click(); this.host.save.change((d) => { d.weapon = id; }); this.showArmory(back); },
      },
      locked ? h('span', { class: 'badge' }, icon('lock'), t('armory.level', { n: w.unlockLevel })) : s.weapon === id ? h('span', { class: 'badge done' }, icon('check')) : null,
      h('div', { class: 'img' }, h('img', { src: this.host.icons.weapon(id), alt: '' })),
      h('div', { class: 't' }, tk(`weapon.${id}`)),
      h('div', { class: 'd' }, tk(`weapon.${id}.d`)),
      h('div', { class: 'd' }, h('b', null, tk(`ability.${w.ability}`)), ' — ', tk(`ability.${w.ability}.d`)),
      );
    });
    const slots = perkSlots(lvl);
    const perkItems = PERKS.map((p) => {
      const locked = lvl < p.unlockLevel;
      const on = s.perks.includes(p.id);
      const tog = h('button', { class: `toggle ${on ? 'on' : ''}`, 'aria-label': tk(`perk.${p.id}`) });
      const toggle = () => {
        if (locked) return;
        this.host.click();
        this.host.save.change((d) => {
          if (d.perks.includes(p.id)) d.perks = d.perks.filter((x) => x !== p.id);
          else {
            d.perks.push(p.id as PerkId);
            while (d.perks.length > slots) d.perks.shift();
          }
        });
        this.showArmory(back);
      };
      return h('div', { class: `item ${locked ? 'locked' : ''}`, onclick: toggle },
        icon(locked ? 'lock' : 'star', 'big'),
        h('div', { class: 'grow' }, h('div', { class: 't' }, tk(`perk.${p.id}`)), h('div', { class: 'd' }, locked ? t('armory.level', { n: p.unlockLevel }) : tk(`perk.${p.id}.d`))),
        locked ? null : tog,
      );
    });
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel' },
      this.head(t('armory.title'), back),
      h('div', { class: 'scroll' },
        h('div', { class: 't', style: { margin: '2px 0 8px', fontSize: '18px' } }, t('armory.weapons')),
        h('div', { class: 'cards' }, wcards),
        h('div', { class: 't', style: { margin: '16px 0 8px', fontSize: '18px' } }, `${t('armory.perks')} · ${t('armory.slots', { n: s.perks.length, m: slots })}`),
        h('div', { class: 'list' }, perkItems),
      ),
    )));
  }

  // ------------------------------------------------------------ mutators
  showMutators(back: () => void): void {
    const s = this.save;
    const lvl = levelForGlory(s.glory);
    const locked = lvl < MUTATOR_UNLOCK_LEVEL;
    const items = MUTATORS.map((m) => {
      const on = s.mutators.includes(m.id);
      return h('div', {
        class: `item ${locked ? 'locked' : ''}`,
        onclick: () => {
          if (locked) return;
          this.host.click();
          this.host.save.change((d) => { d.mutators = on ? d.mutators.filter((x) => x !== m.id) : [...d.mutators, m.id as MutatorId]; });
          this.showMutators(back);
        },
      },
      icon('skull', 'big'),
      h('div', { class: 'grow' }, h('div', { class: 't' }, `${tk(`mut.${m.id}`)} ×${m.mult}`), h('div', { class: 'd' }, tk(`mut.${m.id}.d`))),
      locked ? null : h('button', { class: `toggle ${on ? 'on' : ''}`, 'aria-label': tk(`mut.${m.id}`) }),
      );
    });
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel narrow', style: { maxWidth: '560px' } },
      this.head(t('mut.title'), back),
      h('div', { class: 'sub' }, locked ? t('mut.locked', { n: MUTATOR_UNLOCK_LEVEL }) : t('mut.sub')),
      h('div', { class: 'scroll' }, h('div', { class: 'list' }, items)),
      h('div', { class: 'sub', style: { marginTop: 0, fontSize: '18px', color: 'var(--ink)' } }, t('mut.mult', { n: mutatorMultiplier(s.mutators) })),
    )));
  }

  // ------------------------------------------------------------ achievements
  showAchievements(): void {
    const s = this.save;
    const items = ACHIEVEMENTS.map((id) => {
      const got = s.ach.includes(id);
      return h('div', { class: `item ${got ? '' : 'locked'}` }, icon(got ? 'trophy' : 'lock', 'big'),
        h('div', { class: 'grow' }, h('div', { class: 't' }, tk(`ach.${id}`)), h('div', { class: 'd' }, tk(`ach.${id}.d`))));
    });
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel', style: { maxWidth: '620px' } },
      this.head(t('ach.title'), () => this.showMenu()),
      h('div', { class: 'sub' }, t('ach.count', { n: s.ach.length, m: ACHIEVEMENTS.length })),
      h('div', { class: 'scroll' }, h('div', { class: 'list' }, items)),
    )));
  }

  // ------------------------------------------------------------ leaderboard
  showLeaders(): void {
    const body = h('div', { class: 'list' }, h('div', { class: 'sub' }, t('lb.loading')));
    const panel = h('div', { class: 'panel narrow', style: { maxWidth: '520px' } },
      this.head(t('lb.title'), () => this.showMenu()),
      h('div', { class: 'sub' }, t('lb.sub')),
      h('div', { class: 'scroll' }, body),
    );
    this.set(h('div', { class: 'screen dim' }, panel));
    const el = this.current;
    void this.host.platform.getLeaderboard().then((res) => {
      if (this.current !== el) return;
      body.replaceChildren();
      const best = this.save.endlessBest;
      if (!res) {
        body.append(h('div', { class: 'sub' }, t('lb.unavailable')), h('div', { class: 'item me' }, icon('moon', 'big'), h('div', { class: 'grow t' }, t('lb.local', { n: best }))));
        return;
      }
      if (!res.entries.length) body.append(h('div', { class: 'sub' }, t('lb.empty')));
      for (const e of res.entries) {
        body.append(h('div', { class: `item ${e.me ? 'me' : ''}` },
          h('div', { class: 't', style: { width: '34px', textAlign: 'center' } }, String(e.rank)),
          h('div', { class: 'grow t' }, e.me ? t('lb.you') : e.name || t('lb.player')),
          h('div', { class: 't' }, icon('moon'), ' ', String(e.score)),
        ));
      }
      if (!res.entries.some((e) => e.me)) body.append(h('div', { class: 'item me' }, icon('moon', 'big'), h('div', { class: 'grow t' }, t('lb.local', { n: best }))));
      if (!res.authorized && this.host.platform.id === 'yandex') {
        body.append(h('div', { class: 'item' }, h('div', { class: 'grow d' }, t('lb.auth')),
          this.btn(t('lb.authBtn'), 'small', () => {
            void this.host.platform.requestAuth().then((ok) => {
              if (ok && best > 0) void this.host.platform.submitScore(best);
              this.showLeaders();
            });
          })));
      }
    });
  }

  // ------------------------------------------------------------ settings
  showSettings(back: () => void): void {
    const s = this.save.settings;
    const slider = (val: number, fn: (v: number) => void) => {
      const r = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(val * 100)) }) as HTMLInputElement;
      r.addEventListener('input', () => { fn(Number(r.value) / 100); this.host.save.change(); this.host.applySettings(); });
      return r;
    };
    const seg = <T extends string>(opts: [T, string][], cur: T, fn: (v: T) => void) =>
      h('div', { class: 'seg' }, opts.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => { this.host.click(); fn(v); } }, label)));
    const vib = h('button', { class: `toggle ${s.vibration ? 'on' : ''}`, 'aria-label': t('set.vibration'), onclick: () => { this.host.save.change((d) => { d.settings.vibration = !d.settings.vibration; }); this.host.applySettings(); this.showSettings(back); } });
    const row = (ic: Parameters<typeof icon>[0], label: string, ctl: HTMLElement) =>
      h('div', { class: 'item' }, icon(ic, 'big'), h('div', { class: 't', style: { minWidth: '92px' } }, label), h('div', { class: 'grow', style: { display: 'flex', justifyContent: 'flex-end' } }, ctl));
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel narrow', style: { maxWidth: '560px' } },
      this.head(t('set.title'), back),
      h('div', { class: 'scroll' }, h('div', { class: 'list' },
        row('music', t('set.music'), slider(s.music, (v) => { this.save.settings.music = v; })),
        row('sound', t('set.sfx'), slider(s.sfx, (v) => { this.save.settings.sfx = v; })),
        row('heart', t('set.vibration'), vib),
        row('gear', t('set.quality'), seg([['auto', t('set.q.auto')], ['high', t('set.q.high')], ['medium', t('set.q.medium')], ['low', t('set.q.low')]], s.quality, (v) => { this.host.save.change((d) => { d.settings.quality = v; }); this.host.applySettings(); this.showSettings(back); })),
        row('globe', t('set.language'), seg([['auto', t('set.q.auto')], ['ru', 'Русский'], ['en', 'English']], s.lang, (v) => { this.host.save.change((d) => { d.settings.lang = v; }); this.host.applySettings(); this.showSettings(back); })),
        h('div', { class: 'row', style: { marginTop: '8px' } }, this.btn(t('set.reset'), 'red small', () => this.confirm(t('set.resetConfirm'), () => { this.host.resetProgress(); }, () => this.showSettings(back)))),
      )),
    )));
  }

  // ------------------------------------------------------------ in-run modals
  showPause(onResume: () => void, onSettings: () => void, onExit: () => void, touch: boolean): void {
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel narrow' },
      h('h2', null, t('pause.title')),
      this.btn([icon('play'), t('pause.resume')], 'gold wide', onResume),
      this.btn([icon('gear'), t('menu.settings')], 'ghost wide', onSettings),
      this.btn([icon('castle'), t('pause.exit')], 'wide', () => this.confirm(t('pause.exitConfirm'), onExit, () => this.showPause(onResume, onSettings, onExit, touch))),
      h('div', { class: 'sub', style: { marginTop: '4px', fontSize: '13px' } }, h('b', null, t('pause.controls')), h('br'), touch ? t('pause.controlsTouch') : t('pause.controlsPc')),
    )));
  }

  showDefeat(canSecond: boolean, onSecond: () => void, onResults: () => void): void {
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel narrow results' },
      h('div', { class: 'big-title lose' }, t('defeat.title')),
      canSecond ? h('div', { class: 'sub', style: { marginTop: 0 } }, t('defeat.secondDesc')) : null,
      canSecond ? this.btn([h('span', { class: 'ad' }, icon('video'), t('video')), t('defeat.second')], 'gold wide', onSecond) : null,
      this.btn(t('defeat.results'), 'wide', onResults),
    )));
  }

  showResults(r: ResultsData, onDouble: () => void, onContinue: () => void): void {
    const title = r.endless ? t('results.endless') : r.victory ? t('results.victory') : t('results.defeat');
    const extras: HTMLElement[] = [];
    if (r.mult > 1) extras.push(h('div', { class: 'extra' }, t('results.mult', { n: r.mult })));
    if (r.record) extras.push(h('div', { class: 'extra' }, h('b', null, t('results.record'))));
    if (r.levelAfter > r.levelBefore) extras.push(h('div', { class: 'extra' }, icon('crown'), ' ', h('b', null, t('results.levelUp', { n: r.levelAfter }))));
    if (r.unlocks.length) extras.push(h('div', { class: 'extra' }, t('results.unlocked', { s: r.unlocks.map((k) => tk(k)).join(', ') })));
    if (r.mapUnlocked) extras.push(h('div', { class: 'extra' }, h('b', null, t('results.mapUnlocked'))));
    if (r.achievements.length) extras.push(h('div', { class: 'extra' }, icon('trophy'), ' ', r.achievements.map((a) => tk(`ach.${a}`)).join(', ')));
    const gloryEl = h('div', { class: 'glory' }, icon('crown'), h('span', { class: 'gv' }, `+${r.glory}`), h('span', { style: { fontSize: '16px', color: 'var(--ink2)' } }, t('glory')));
    const dbl = r.canDouble ? this.btn([h('span', { class: 'ad' }, icon('video'), t('video')), t('results.double')], 'gold', () => { dbl!.disabled = true; onDouble(); }) : null;
    this.set(h('div', { class: 'screen dim' }, h('div', { class: 'panel results', style: { maxWidth: '620px' } },
      h('div', { class: `big-title ${r.victory ? 'win' : 'lose'}` }, title),
      h('div', { class: 'sub', style: { marginTop: '-4px' } }, tk(`map.${r.map}`)),
      h('div', { class: 'scroll' },
        h('div', { class: 'statrow' },
          h('div', { class: 'stat' }, h('div', { class: 'v' }, String(r.nights)), h('div', { class: 'k' }, t('results.nights'))),
          h('div', { class: 'stat' }, h('div', { class: 'v' }, String(r.kills)), h('div', { class: 'k' }, t('results.kills'))),
          h('div', { class: 'stat' }, h('div', { class: 'v' }, String(r.lost)), h('div', { class: 'k' }, t('results.lost'))),
        ),
        h('div', { style: { height: '10px' } }),
        gloryEl,
        ...extras,
      ),
      h('div', { class: 'row' }, dbl, this.btn(t('results.continue'), 'green', onContinue)),
    )));
  }

  updateGlory(v: number): void {
    const el = this.current?.querySelector('.gv');
    if (el) el.textContent = `+${v}`;
    const toast = this.current?.querySelector('.glory');
    if (toast) toast.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 500 });
  }

  // ------------------------------------------------------------ dialogs
  confirm(text: string, yes: () => void, no?: () => void): void {
    this.closeModal();
    const close = () => this.closeModal();
    this.modal = h('div', { class: 'screen dim', style: { zIndex: '5' } }, h('div', { class: 'panel narrow confirm' },
      h('p', null, text),
      h('div', { class: 'row' },
        this.btn(t('no'), 'ghost', () => { close(); no?.(); }),
        this.btn(t('yes'), 'red', () => { close(); yes(); }),
      ),
    ));
    this.root.appendChild(this.modal);
  }

  closeModal(): void { this.modal?.remove(); this.modal = null; }

  /** Language-dependent glyphs for keyboard hints. */
  static spaceKey(): string { return getLang() === 'ru' ? 'Пробел' : 'Space'; }
}
