import type { App } from '../../app/App';
import { ACHIEVEMENTS } from '../../data/achievements';
import { t } from '../../i18n';
import { totalWorkshopLevels } from '../../meta/workshop';
import { fmtNum, h } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';
import { topbar } from './common';
import { showMenu } from './menu';

export function showAchievements(app: App): void {
  const save = app.save.data;
  const ctx = { save, w: null, won: false, workshopLevels: totalWorkshopLevels(save) };
  const got = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
  const items: HTMLElement[] = [];
  // unlocked first, then by progress
  const sorted = ACHIEVEMENTS.slice().sort((a, b) => Number(!!save.ach[b.id]) - Number(!!save.ach[a.id]));
  for (const a of sorted) {
    const done = !!save.ach[a.id];
    const pr = !done && a.progress ? a.progress(ctx) : null;
    items.push(
      h(
        'div',
        { cls: `li ${done ? 'done' : ''}` },
        h('div', { cls: 'lic', style: { '--ic': done ? '#ffb52e' : '#667' } }, icon(a.icon)),
        h(
          'div',
          { cls: 'lb' },
          h('div', { cls: 'lt', text: t(`a.${a.id}`) }),
          h('div', { cls: 'ld', text: t(`a.${a.id}.desc`) }),
          pr
            ? h('div', { cls: 'prog' }, h('i', { style: { width: `${Math.min(100, (pr[0] / pr[1]) * 100)}%` } }))
            : null,
          pr ? h('div', { cls: 'ld', text: `${fmtNum(Math.min(pr[0], pr[1]))} / ${fmtNum(pr[1])}` }) : null,
        ),
        h('div', { cls: 'row', style: { color: done ? 'var(--r3)' : 'var(--dim)', 'font-weight': '800', 'font-size': '0.85rem' } }, done ? icon('check') : icon('bits'), done ? '' : String(a.reward)),
      ),
    );
  }
  app.ui.show(
    h(
      'div',
      { cls: 'dim' },
      topbar(app, t('ach.title'), () => showMenu(app)),
      h('div', { cls: 'note', text: t('ach.progress', { a: got, b: ACHIEVEMENTS.length }) }),
      new Pager(items, { minItemW: 240 }).el,
    ),
  );
}
