import type { App } from '../../app/App';
import { CHARACTERS, CHARACTER_IDS } from '../../data/characters';
import type { CharacterId } from '../../data/types';
import { WEAPONS } from '../../data/weapons';
import { t } from '../../i18n';
import { checkAchievements } from '../../meta/achievements';
import { charAvailable, charStage } from '../../meta/unlocks';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';
import { charCanvas, setBits, topbar, unlockCond } from './common';

/** Characters: one card per program, flipped page by page (no scrolling). */
export function showCharacters(app: App, back: () => void): void {
  const save = app.save.data;
  const bar = topbar(app, t('ch.title'), back);
  const pill = bar.querySelector('.bits-pill') as HTMLElement | null;
  let pager: Pager | null = null;

  const own = (id: CharacterId) => {
    if (!save.chars.includes(id)) save.chars.push(id);
    save.char = id;
    checkAchievements(save, null, false);
    app.save.save(true);
    app.ui.toast(t('ch.unlocked', { name: t(`c.${id}`) }), 'gold', 'characters');
  };

  const action = (id: CharacterId): HTMLElement => {
    const c = CHARACTERS[id];
    if (save.char === id) return h('div', { cls: 'row ch-sel' }, icon('check'), t('ch.selected'));
    if (save.chars.includes(id)) {
      return h('button', {
        cls: 'btn small',
        onClick: () => {
          save.char = id;
          app.save.save();
          render();
        },
      }, t('ch.select'));
    }
    if (!charAvailable(save, id)) {
      return h('div', { cls: 'ch-lock' }, icon('lock'), h('span', { text: t('unl.opens', { cond: unlockCond(charStage(id)) }) }));
    }
    const u = c.unlock;
    if (u.type === 'ads') {
      const seen = Math.min(u.count, save.adUnlock[id] ?? 0);
      const b = h('button', { cls: 'btn small ad', attrs: { 'data-test': `ad-unlock-${id}` } }, icon('video', 'video'), t('ch.adUnlock', { a: seen, b: u.count }));
      b.addEventListener('click', async () => {
        b.disabled = true;
        const ok = await app.rewarded();
        if (ok) {
          save.adUnlock[id] = Math.min(u.count, (save.adUnlock[id] ?? 0) + 1);
          if (save.adUnlock[id] >= u.count) {
            own(id);
            app.sfx('coins');
          } else app.save.save(true);
        }
        render();
      });
      return h('div', { cls: 'col ch-buy' }, b, h('div', { cls: 'prog' }, h('i', { style: { width: `${(seen / u.count) * 100}%` } })));
    }
    const cost = u.type === 'bits' ? u.cost : 0;
    const b = h('button', { cls: 'btn small' }, icon('bits'), fmtNum(cost));
    b.disabled = save.bits < cost;
    b.addEventListener('click', () => {
      if (save.bits < cost) return;
      save.bits -= cost;
      own(id);
      app.sfx('coins');
      if (pill) setBits(pill, save.bits);
      render();
    });
    return b;
  };

  const card = (id: CharacterId): HTMLElement => {
    const c = CHARACTERS[id];
    const owned = save.chars.includes(id);
    return h(
      'div',
      { cls: `char-card ${save.char === id ? 'sel' : ''} ${owned ? '' : 'locked'}`, attrs: { 'data-char': id } },
      charCanvas(owned ? c.color : 0x555577),
      h(
        'div',
        { cls: 'cb' },
        h('div', { cls: 'cn', text: t(`c.${id}`) }),
        h('div', { cls: 'cd', text: t(`c.${id}.desc`) }),
        h('div', { cls: 'cw', style: { color: hexColor(WEAPONS[c.weapon].color) } }, icon(c.weapon), h('span', { text: t(`w.${c.weapon}`) })),
        h('div', { cls: 'cbonus', text: t(`c.${id}.bonus`) }),
      ),
      h('div', { cls: 'ca' }, action(id)),
    );
  };

  const render = () => {
    const items = CHARACTER_IDS.map(card);
    if (pager) pager.setItems(items, pager.current);
    else pager = new Pager(items, { minItemW: 300, maxCols: 3 });
  };
  render();
  app.ui.show(h('div', { cls: 'dim' }, bar, (pager as unknown as Pager).el));
}
