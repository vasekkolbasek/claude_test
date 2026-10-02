import type { App } from '../../app/App';
import { PASSIVES } from '../../data/passives';
import { WORKSHOP, WORKSHOP_BY_ID } from '../../data/workshop';
import { t } from '../../i18n';
import { checkAchievements } from '../../meta/achievements';
import { buyNode, nodeAvailable, nodeCost, nodeLevel } from '../../meta/workshop';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { bitsPill, topbar } from './common';
import { showMenu } from './menu';

const PCT = new Set(['might', 'speed', 'haste', 'area', 'crit', 'magnet', 'growth', 'greed', 'luck']);

function perText(id: string): string {
  const n = WORKSHOP_BY_ID[id];
  const v = PCT.has(n.stat) ? Math.round(n.per * 100) : n.per;
  return t(`ws.${id}.desc`, { v });
}

export function showWorkshop(app: App): void {
  const save = app.save.data;
  const pill = bitsPill(save.bits);
  const body = h('div', { cls: 'col' });
  const render = () => {
    body.textContent = '';
    pill.querySelector('span')!.textContent = fmtNum(save.bits);
    body.appendChild(h('div', { cls: 'note', text: t('ws.hint') }));
    for (const branch of ['core', 'offense', 'defense', 'utility'] as const) {
      const nodes = WORKSHOP.filter((n) => n.branch === branch || (branch === 'core' && n.id === 'core_dmg'));
      const items = WORKSHOP.filter((n) => n.branch === branch);
      if (!items.length && !nodes.length) continue;
      body.appendChild(h('div', { cls: 'section-h', text: t(`ws.b.${branch}`) }));
      const grid = h('div', { cls: 'grid2' });
      for (const n of items) {
        const lv = nodeLevel(save, n.id);
        const avail = nodeAvailable(save, n.id);
        const cost = nodeCost(save, n.id);
        const color = PASSIVES[n.icon as keyof typeof PASSIVES]?.color ?? 0x29f6ff;
        const pips = h('div', { cls: 'pips' });
        for (let i = 0; i < n.max; i++) pips.appendChild(h('i', { cls: i < lv ? 'on' : '' }));
        let action: HTMLElement;
        if (cost === null) action = h('div', { cls: 'row', style: { color: 'var(--cyan)', 'font-weight': '800', 'font-size': '0.85rem' } }, icon('check'), t('ws.maxed'));
        else if (!avail) action = h('div', { cls: 'row dim-text', style: { 'font-size': '0.8rem' } }, icon('lock'));
        else {
          const b = h('button', { cls: 'btn small', attrs: { 'data-node': n.id } }, icon('bits'), fmtNum(cost));
          b.disabled = save.bits < cost;
          b.addEventListener('click', () => {
            if (!buyNode(save, n.id)) return;
            const got = checkAchievements(save, null, false);
            for (const a of got) app.ui.toast(t('ach.unlocked', { name: t(`a.${a}`) }));
            app.save.save();
            app.sfx('coins');
            render();
          });
          action = b;
        }
        grid.appendChild(
          h(
            'div',
            { cls: `li ${avail ? '' : 'locked'} ${cost === null ? 'done' : ''}` },
            h('div', { cls: 'lic', style: { '--ic': hexColor(color) } }, icon(n.icon)),
            h(
              'div',
              { cls: 'lb' },
              h('div', { cls: 'lt', text: t(`ws.${n.id}`) }),
              h('div', { cls: 'ld', text: avail || !n.requires ? perText(n.id) : t('ws.requires', { name: t(`ws.${n.requires}`) }) }),
              pips,
            ),
            action,
          ),
        );
      }
      body.appendChild(grid);
    }
  };
  render();
  app.ui.show(h('div', { cls: 'dim' }, topbar(app, t('ws.title'), () => showMenu(app), pill), h('div', { cls: 'scroll' }, body)));
}
