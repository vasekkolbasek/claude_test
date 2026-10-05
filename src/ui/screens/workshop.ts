import type { App } from '../../app/App';
import { PASSIVES } from '../../data/passives';
import { WORKSHOP, WORKSHOP_BY_ID } from '../../data/workshop';
import { t } from '../../i18n';
import { checkAchievements } from '../../meta/achievements';
import { buyNode, nodeAvailable, nodeCost, nodeLevel } from '../../meta/workshop';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';
import { bitsPill, topbar } from './common';
import { showMenu } from './menu';

const PCT = new Set(['might', 'speed', 'haste', 'area', 'crit', 'magnet', 'growth', 'greed', 'luck']);

function perText(id: string): string {
  const n = WORKSHOP_BY_ID[id];
  const v = PCT.has(n.stat) ? Math.round(n.per * 100) : n.per;
  return t(`ws.${id}.desc`, { v });
}

// the single «core» node opens the attack branch, so no tab is nearly empty
const BRANCHES = ['offense', 'defense', 'utility'] as const;
type Branch = (typeof BRANCHES)[number];
const inBranch = (nb: string, tab: Branch) => nb === tab || (tab === 'offense' && nb === 'core');
let branch: Branch = 'offense';

/** Workshop: one tab per branch, the nodes of a branch fit on one screen (pages if needed). */
export function showWorkshop(app: App): void {
  const save = app.save.data;
  const pill = bitsPill(save.bits);
  const tabs = h('div', { cls: 'tabs' });
  let pager: Pager | null = null;
  const render = () => {
    pill.querySelector('span')!.textContent = fmtNum(save.bits);
    tabs.textContent = '';
    for (const b of BRANCHES) {
      const canBuy = WORKSHOP.some((n) => inBranch(n.branch, b) && nodeAvailable(save, n.id) && (nodeCost(save, n.id) ?? Infinity) <= save.bits);
      const tb = h('button', { cls: `tab ${b === branch ? 'on' : ''}`, text: t(`ws.b.${b}`) }, canBuy ? h('i', { cls: 'tab-dot' }) : null);
      tb.addEventListener('click', () => {
        branch = b;
        render();
      });
      tabs.appendChild(tb);
    }
    const cards: HTMLElement[] = [];
    {
      const items = WORKSHOP.filter((n) => inBranch(n.branch, branch));
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
        cards.push(
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
    }
    if (pager) pager.setItems(cards, pager.current);
    else pager = new Pager(cards, { minEm: 23, targetEm: 27 });
  };
  render();
  app.ui.show(
    h('div', { cls: 'dim' }, topbar(app, t('ws.title'), () => showMenu(app), pill), h('div', { cls: 'note', text: t('ws.hint') }), tabs, (pager as unknown as Pager).el),
  );
}
