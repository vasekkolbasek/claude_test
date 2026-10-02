import type { App } from '../../app/App';
import { CHARACTERS, CHARACTER_IDS } from '../../data/characters';
import { WEAPONS } from '../../data/weapons';
import { t } from '../../i18n';
import { checkAchievements } from '../../meta/achievements';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { charCanvas, topbar } from './common';

export function showCharacters(app: App, back: () => void): void {
  const save = app.save.data;
  const list = h('div', { cls: 'grid2' });
  const bar = topbar(app, t('ch.title'), back);
  const render = () => {
    list.textContent = '';
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      const owned = save.chars.includes(id);
      const sel = save.char === id;
      let action: HTMLElement;
      if (sel) action = h('div', { cls: 'row', style: { color: 'var(--cyan)', 'font-weight': '800' } }, icon('check'), t('ch.selected'));
      else if (owned) {
        action = h('button', {
          cls: 'btn small',
          onClick: () => {
            save.char = id;
            app.save.save();
            render();
          },
        }, t('ch.select'));
      } else {
        const u = c.unlock;
        const cost = u.type === 'free' ? 0 : u.cost;
        action = h('div', { cls: 'col', style: { 'align-items': 'flex-end', gap: '0.25rem' } });
        const b = h('button', { cls: 'btn small' }, icon('bits'), fmtNum(cost));
        b.disabled = save.bits < cost;
        b.addEventListener('click', () => {
          if (save.bits < cost) return;
          save.bits -= cost;
          save.chars.push(id);
          save.char = id;
          checkAchievements(save, null, false);
          app.save.save(true);
          app.sfx('coins');
          showCharacters(app, back);
        });
        action.appendChild(b);
        if (u.type === 'achievement') action.appendChild(h('div', { cls: 'note', style: { 'text-align': 'right', padding: '0' }, text: t('ch.orAch', { name: t(`a.${u.id}`) }) }));
      }
      list.appendChild(
        h(
          'div',
          { cls: `char-card ${sel ? 'sel' : ''} ${owned ? '' : 'locked'}` },
          charCanvas(owned ? c.color : 0x555577),
          h(
            'div',
            { cls: 'cb' },
            h('div', { cls: 'cn', text: t(`c.${id}`) }),
            h('div', { cls: 'cd', text: t(`c.${id}.desc`) }),
            h('div', { cls: 'cw', style: { color: hexColor(WEAPONS[c.weapon].color) } }, icon(c.weapon), h('span', { text: t(`w.${c.weapon}`) })),
            h('div', { cls: 'cbonus', text: t(`c.${id}.bonus`) }),
          ),
          h('div', { cls: 'ca' }, action),
        ),
      );
    }
  };
  render();
  app.ui.show(h('div', { cls: 'dim' }, bar, h('div', { cls: 'scroll' }, list)));
}
