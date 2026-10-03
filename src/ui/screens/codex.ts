import type { App } from '../../app/App';
import { CODEX_ENEMIES, ENEMIES } from '../../data/enemies';
import { PASSIVES, PASSIVE_IDS } from '../../data/passives';
import { EVOLUTIONS, EVOLUTION_IDS, WEAPONS, WEAPON_IDS } from '../../data/weapons';
import { drawShapeIcon } from '../../render/textures';
import { t } from '../../i18n';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { passiveAvailable, passiveStage, weaponAvailable, weaponStage } from '../../meta/unlocks';
import { passiveValueText } from '../levelup';
import { topbar, unlockCond } from './common';
import { showMenu } from './menu';

type Tab = 'enemies' | 'weapons' | 'evolutions' | 'passives';
let tab: Tab = 'enemies';

export function showCodex(app: App): void {
  const save = app.save.data;
  const tabs = h('div', { cls: 'tabs' });
  const list = h('div', { cls: 'grid2' });
  const progress = h('div', { cls: 'note' });

  const unknown = (ico: HTMLElement | SVGElement, cond = '') =>
    h(
      'div',
      { cls: 'li locked' },
      h('div', { cls: 'lic', style: { '--ic': '#556' } }, ico),
      h('div', { cls: 'lb' }, h('div', { cls: 'lt', text: t('codex.unknown') }), h('div', { cls: 'ld', text: cond ? t('unl.opens', { cond }) : t('codex.unknownText') })),
    );

  const render = () => {
    tabs.textContent = '';
    for (const k of ['enemies', 'weapons', 'evolutions', 'passives'] as Tab[]) {
      const b = h('button', { cls: `tab ${k === tab ? 'on' : ''}`, text: t(`codex.${k}`) });
      b.addEventListener('click', () => {
        tab = k;
        render();
      });
      tabs.appendChild(b);
    }
    list.textContent = '';
    let found = 0;
    let total = 0;
    if (tab === 'enemies') {
      for (const id of CODEX_ENEMIES) {
        total++;
        const def = ENEMIES[id];
        const seen = save.codex.e[id] !== undefined;
        const cv = document.createElement('canvas');
        cv.width = 96;
        cv.height = 96;
        if (!seen) {
          drawShapeIcon(cv, def.shape, 0x333355);
          list.appendChild(unknown(cv));
          continue;
        }
        found++;
        drawShapeIcon(cv, def.shape, def.color);
        const tag = def.boss === 'final' ? t('codex.boss') : def.boss === 'mini' ? t('codex.miniboss') : '';
        list.appendChild(
          h(
            'div',
            { cls: 'li' },
            h('div', { cls: 'lic', style: { '--ic': hexColor(def.color) } }, cv),
            h(
              'div',
              { cls: 'lb' },
              h('div', { cls: 'lt' }, t(`e.${id}`), tag ? h('span', { cls: 'clvl', text: ` · ${tag}`, style: { color: 'var(--red)', 'font-size': '0.75rem' } }) : null),
              h('div', { cls: 'ld', text: t(`e.${id}.desc`) }),
              h('div', { cls: 'ld', text: t('codex.kills', { n: fmtNum(save.codex.e[id] ?? 0) }) }),
            ),
          ),
        );
      }
    } else if (tab === 'weapons') {
      for (const id of WEAPON_IDS) {
        total++;
        const def = WEAPONS[id];
        if (!save.codex.w.includes(id)) {
          list.appendChild(unknown(icon(id), weaponAvailable(save, id) ? '' : unlockCond(weaponStage(id))));
          continue;
        }
        found++;
        const evo = EVOLUTIONS[def.evolution];
        list.appendChild(
          h(
            'div',
            { cls: 'li' },
            h('div', { cls: 'lic', style: { '--ic': hexColor(def.color) } }, icon(id)),
            h(
              'div',
              { cls: 'lb' },
              h('div', { cls: 'lt', text: t(`w.${id}`) }),
              h('div', { cls: 'ld', text: t(`w.${id}.desc`) }),
              h('div', { cls: 'ld', style: { color: 'var(--r3)' } }, `${t('codex.recipeTitle')}: `, t('codex.recipe', { weapon: t(`w.${id}`), passive: t(`p.${evo.passive}`) })),
            ),
          ),
        );
      }
    } else if (tab === 'evolutions') {
      for (const id of EVOLUTION_IDS) {
        total++;
        const evo = EVOLUTIONS[id];
        const known = save.codex.w.includes(id);
        const baseKnown = save.codex.w.includes(evo.from);
        if (known) found++;
        list.appendChild(
          h(
            'div',
            { cls: `li ${known ? 'done' : 'locked'}` },
            h('div', { cls: 'lic', style: { '--ic': known ? '#ffb52e' : '#556' } }, icon(evo.from)),
            h(
              'div',
              { cls: 'lb' },
              h('div', { cls: 'lt', text: known ? t(`w.${id}`) : t('codex.unknown') }),
              h('div', { cls: 'ld', text: known ? t(`w.${id}.desc`) : t('codex.unknownText') }),
              baseKnown || known
                ? h('div', { cls: 'ld', style: { color: 'var(--r3)' }, text: t('codex.recipe', { weapon: t(`w.${evo.from}`), passive: t(`p.${evo.passive}`) }) })
                : null,
            ),
          ),
        );
      }
    } else {
      for (const id of PASSIVE_IDS) {
        total++;
        const def = PASSIVES[id];
        if (!save.codex.p.includes(id)) {
          list.appendChild(unknown(icon(id), passiveAvailable(save, id) ? '' : unlockCond(passiveStage(id))));
          continue;
        }
        found++;
        list.appendChild(
          h(
            'div',
            { cls: 'li' },
            h('div', { cls: 'lic', style: { '--ic': hexColor(def.color) } }, icon(id)),
            h('div', { cls: 'lb' }, h('div', { cls: 'lt', text: t(`p.${id}`) }), h('div', { cls: 'ld', text: passiveValueText(id, def.per) })),
          ),
        );
      }
    }
    progress.textContent = t('codex.progress', { a: found, b: total });
  };
  render();
  app.ui.show(h('div', { cls: 'dim' }, topbar(app, t('codex.title'), () => showMenu(app)), tabs, progress, h('div', { cls: 'scroll' }, list)));
}
