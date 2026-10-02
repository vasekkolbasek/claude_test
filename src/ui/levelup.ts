import { PASSIVES } from '../data/passives';
import { EVOLUTIONS, WEAPONS } from '../data/weapons';
import type { EvolutionId, PassiveId, UpgradeCard, WeaponId, WeaponStats } from '../data/types';
import { t } from '../i18n';
import { h, hexColor } from './dom';
import { icon } from './icons';

const PCT_STATS = new Set(['might', 'haste', 'speed', 'magnet', 'crit', 'area', 'duration', 'luck', 'growth']);

export function passiveValueText(id: PassiveId, value: number): string {
  if (PCT_STATS.has(id)) return t(`p.${id}.desc`, { v: Math.round(value * 100) });
  if (id === 'regen') return t(`p.${id}.desc`, { v: value.toFixed(1).replace(/\.0$/, '') });
  return t(`p.${id}.desc`, { v: Math.round(value) });
}

function weaponDiff(a: WeaponStats, b: WeaponStats, id: WeaponId): string {
  const parts: string[] = [];
  if (b.dmg > a.dmg) parts.push(t('up.dmg', { n: Math.round(b.dmg - a.dmg) }));
  if (b.count > a.count) parts.push(t('up.count', { n: b.count - a.count }));
  if (b.pierce > a.pierce) parts.push(t('up.pierce', { n: b.pierce - a.pierce }));
  if (b.cd < a.cd) parts.push(t('up.rate', { n: Math.round((a.cd / b.cd - 1) * 100) }));
  if (id === 'chain' && b.extra > a.extra) parts.push(t('up.jumps', { n: b.extra - a.extra }));
  else if (b.size > a.size * 1.01) parts.push(t('up.area', { n: Math.round((b.size / a.size - 1) * 100) }));
  if (b.dur > a.dur * 1.01 && a.dur > 0) parts.push(t('up.dur', { n: Math.round((b.dur / a.dur - 1) * 100) }));
  if (id === 'orbit' && b.extra > a.extra && parts.length < 3) parts.push(t('up.area', { n: Math.round((b.extra / a.extra - 1) * 100) }));
  return parts.slice(0, 3).join(', ');
}

export interface CardInfo {
  name: string;
  desc: string;
  icon: string;
  color: number;
  level: string;
  isNew: boolean;
}

export function describeCard(c: UpgradeCard): CardInfo {
  switch (c.kind) {
    case 'weapon_new':
    case 'weapon_up': {
      const id = c.id as WeaponId;
      const def = WEAPONS[id];
      let desc: string;
      if (c.kind === 'weapon_new') desc = t(`w.${id}.desc`);
      else desc = weaponDiff(def.levels[c.levelFrom - 1], def.levels[Math.min(4, c.levelTo - 1)], id) || t(`w.${id}.desc`);
      if (c.value > 0) desc += ` ${t('card.dmgBonus', { n: Math.round(c.value * 100) })}`;
      return {
        name: t(`w.${id}`),
        desc,
        icon: id,
        color: def.color,
        level: c.kind === 'weapon_new' ? '' : t('card.levels', { a: c.levelFrom, b: c.levelTo }),
        isNew: c.kind === 'weapon_new',
      };
    }
    case 'passive_new':
    case 'passive_up': {
      const id = c.id as PassiveId;
      return {
        name: t(`p.${id}`),
        desc: passiveValueText(id, c.value),
        icon: id,
        color: PASSIVES[id].color,
        level: c.kind === 'passive_new' ? '' : t('card.levels', { a: c.levelFrom, b: c.levelTo }),
        isNew: c.kind === 'passive_new',
      };
    }
    case 'evolution': {
      const id = c.id as EvolutionId;
      return { name: t(`w.${id}`), desc: t(`w.${id}.desc`), icon: EVOLUTIONS[id].from, color: 0xffb52e, level: '', isNew: false };
    }
    case 'heal':
      return { name: t('card.heal.name'), desc: t('card.heal.desc', { n: Math.round(c.value * 100) }), icon: 'heal', color: 0x6dff8a, level: '', isNew: false };
    case 'bits':
    default:
      return { name: t('card.bits.name'), desc: t('card.bits.desc', { n: c.value }), icon: 'bits', color: 0xffd23d, level: '', isNew: false };
  }
}

export interface LevelUpOptions {
  chest: boolean;
  getCards: () => UpgradeCard[];
  pick: (index: number) => void;
  /** returns true if more levels are pending and the dialog should re-render */
  hasMore: () => boolean;
  rerollsLeft: () => number;
  reroll: () => void;
  canAdReroll: () => boolean;
  adReroll: () => Promise<boolean>;
  onClose: () => void;
  sound: (id: 'cardIn' | 'cardPick') => void;
}

/** Builds the level-up modal contents. Returns the modal root. */
export function buildLevelUp(o: LevelUpOptions): HTMLElement {
  const root = h('div', { cls: `levelup ${o.chest ? 'chest' : ''}` });
  const title = h('h3', { text: o.chest ? t('lvl.chest') : t('lvl.title') });
  const sub = h('div', { cls: 'sub', text: t('lvl.choose') });
  const cardsBox = h('div', { cls: 'cards' });
  const actions = h('div', { cls: 'lvl-actions' });
  root.append(title, sub, cardsBox, actions);
  let busy = false;

  const keyHandler = (e: KeyboardEvent) => {
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(e.code);
    if (n >= 0) {
      const btn = cardsBox.children[n % 4] as HTMLElement | undefined;
      btn?.click();
    }
  };
  window.addEventListener('keydown', keyHandler);

  const render = () => {
    busy = false;
    cardsBox.textContent = '';
    const cards = o.getCards();
    cards.forEach((c, i) => {
      const info = describeCard(c);
      const el = h(
        'button',
        { cls: `card r${c.rarity} locked`, style: { 'animation-delay': `${i * 90}ms`, '--ic': hexColor(info.color) } },
        h('div', { cls: 'cicon' }, icon(info.icon)),
        h(
          'div',
          { cls: 'cbody' },
          h('div', { cls: 'crar', text: c.kind === 'evolution' ? t('card.evolution') : t(`rarity.${c.rarity}`) }),
          h('div', { cls: 'ctop' }, h('span', { cls: 'cname', text: info.name }), info.isNew ? h('span', { cls: 'cnew', text: t('card.new') }) : null, info.level ? h('span', { cls: 'clvl', text: info.level }) : null),
          h('div', { cls: 'cdesc', text: info.desc }),
        ),
      );
      el.addEventListener('click', () => {
        if (busy || el.classList.contains('locked')) return;
        busy = true;
        o.sound('cardPick');
        el.classList.add('picked');
        for (const other of Array.from(cardsBox.children)) if (other !== el) other.classList.add('fade');
        setTimeout(() => {
          o.pick(i);
          if (o.hasMore()) render();
          else close();
        }, 300);
      });
      cardsBox.appendChild(el);
      setTimeout(() => o.sound('cardIn'), i * 90);
    });
    // guard against the finger that was steering when the dialog popped up
    setTimeout(() => {
      for (const c of Array.from(cardsBox.children)) c.classList.remove('locked');
    }, 480);
    renderActions();
  };

  const renderActions = () => {
    actions.textContent = '';
    const left = o.rerollsLeft();
    if (left > 0) {
      actions.appendChild(
        h('button', {
          cls: 'btn small',
          onClick: () => {
            if (busy) return;
            o.reroll();
            render();
          },
        }, icon('reroll'), t('lvl.reroll', { n: left })),
      );
    }
    if (o.canAdReroll()) {
      const b = h('button', { cls: 'btn small ad' }, icon('video', 'video'), t('lvl.rerollAd'));
      b.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        b.disabled = true;
        const ok = await o.adReroll();
        busy = false;
        if (ok) render();
        else renderActions();
      });
      actions.appendChild(b);
    }
  };

  const close = () => {
    window.removeEventListener('keydown', keyHandler);
    o.onClose();
  };

  render();
  return root;
}
