import type { App } from '../../app/App';
import { CONFIG } from '../../config';
import { formatTime } from '../../core/math';
import { t } from '../../i18n';
import { h } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';
import { topbar } from './common';
import { showMenu } from './menu';

export function showLeaders(app: App): void {
  const save = app.save.data;
  const body = h('div', { cls: 'col' });
  const status = h('div', { cls: 'note', text: t('lb.loading') });
  body.append(h('div', { cls: 'note', text: t('lb.subtitle') }));
  if (save.bestEndless > 0) body.append(h('div', { cls: 'li' }, icon('time'), h('div', { cls: 'lt', text: t('lb.yourBest', { t: formatTime(save.bestEndless) }) })));
  else if (!save.endlessUnlocked) body.append(h('div', { cls: 'note', text: t('lb.locked') }));
  if (!app.platform.isAuthorized()) {
    body.append(
      h(
        'div',
        { cls: 'panel', style: { padding: '0.8rem', display: 'flex', 'flex-direction': 'column', gap: '0.5rem' } },
        h('div', { cls: 'note', text: t('lb.loginHint') }),
        h('button', {
          cls: 'btn small',
          onClick: async () => {
            const ok = await app.platform.openAuth();
            if (ok) {
              await app.save.resync();
              if (app.save.data.bestEndless > 0) await app.platform.setScore(CONFIG.leaderboard, Math.round(app.save.data.bestEndless * 1000));
              showLeaders(app);
            }
          },
        }, icon('user'), t('lb.login')),
      ),
    );
  }
  body.append(status);
  const pager = new Pager([], { minEm: 16, targetEm: 22, maxCols: 2, gap: 6 });
  app.ui.show(h('div', { cls: 'dim' }, topbar(app, t('lb.title'), () => showMenu(app)), body, pager.el));

  app.platform
    .getLeaderboard(CONFIG.leaderboard)
    .then((res) => {
      status.remove();
      if (!res.entries.length) {
        body.appendChild(h('div', { cls: 'note', text: t('lb.empty') }));
        return;
      }
      const rows: HTMLElement[] = [];
      for (const e of res.entries) {
        const name = e.isPlayer ? t('lb.you') : e.name || t('lb.anon');
        rows.push(
          h(
            'div',
            { cls: `lb-row ${e.rank <= 3 ? `top${e.rank}` : ''} ${e.isPlayer ? 'me' : ''}` },
            h('div', { cls: 'rk', text: `#${e.rank}` }),
            h('div', { cls: 'av', text: name.slice(0, 1).toUpperCase() }),
            h('div', { cls: 'nm', text: name }),
            h('div', { cls: 'sc', text: formatTime(e.score / 1000) }),
          ),
        );
      }
      pager.setItems(rows);
    })
    .catch(() => {
      status.textContent = t('lb.error');
    });
}
