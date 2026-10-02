import type { App } from '../../app/App';
import { PASSIVES } from '../../data/passives';
import { EVOLUTIONS, WEAPONS } from '../../data/weapons';
import { t } from '../../i18n';
import { h, hexColor } from '../dom';
import { icon } from '../icons';
import { openSettings } from './settings';

export function openPause(app: App, onResume: () => void): void {
  const w = app.world;
  const build = h('div', { cls: 'items', style: { display: 'flex', 'flex-wrap': 'wrap', gap: '0.35rem', 'justify-content': 'center' } });
  if (w) {
    for (const wp of w.weapons) {
      const color = wp.evo ? EVOLUTIONS[WEAPONS[wp.id].evolution].color : WEAPONS[wp.id].color;
      build.appendChild(
        h('div', { cls: 'li', style: { padding: '0.35rem 0.55rem', gap: '0.35rem', color: hexColor(color) } }, icon(wp.id), h('b', { text: wp.evo ? '★' : String(wp.level), style: { color: '#fff' } })),
      );
    }
    for (const p of w.passives) {
      build.appendChild(
        h('div', { cls: 'li', style: { padding: '0.35rem 0.55rem', gap: '0.35rem', color: hexColor(PASSIVES[p.id].color) } }, icon(p.id), h('b', { text: String(p.level), style: { color: '#fff' } })),
      );
    }
  }
  let closed = false;
  const resume = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    app.ui.closeModal(m);
    onResume();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') resume();
  };
  setTimeout(() => window.addEventListener('keydown', onKey), 50);
  const m = app.ui.openModal(
    h(
      'div',
      null,
      h(
        'div',
        { cls: 'dialog panel' },
        h('h3', { text: t('pause.title') }),
        h('div', { cls: 'section-h', text: t('pause.build') }),
        build,
        h(
          'div',
          { cls: 'btns' },
          h('button', { cls: 'btn primary', attrs: { 'data-test': 'resume' }, onClick: resume }, icon('play'), t('pause.resume')),
          h('button', { cls: 'btn', onClick: () => openSettings(app, true) }, icon('settings'), t('menu.settings')),
          h('button', {
            cls: 'btn danger',
            onClick: async () => {
              const ok = await app.ui.confirm(t('pause.quit'), t('pause.quitConfirm'), t('common.yes'), t('common.no'), true);
              if (ok) {
                closed = true;
                window.removeEventListener('keydown', onKey);
                app.quitRun();
              }
            },
          }, t('pause.quit')),
        ),
      ),
    ),
  );
}
