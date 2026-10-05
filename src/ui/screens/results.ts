import type { App } from '../../app/App';
import { formatTime } from '../../core/math';
import { EVOLUTIONS, WEAPONS } from '../../data/weapons';
import type { WeaponId } from '../../data/types';
import { t } from '../../i18n';
import type { RunSummary } from '../../meta/progress';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';

export function showResults(app: App, s: RunSummary): void {
  const stat = (v: string, label: string) => h('div', { cls: 'stat' }, h('b', { text: v }), h('span', { text: label }));

  // damage per weapon
  // the top weapons only: the screen must fit without scrolling
  const entries = (Object.entries(s.damageBy) as [WeaponId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = entries[0]?.[1] ?? 1;
  const dmg = h('div', { cls: 'dmg-list' });
  if (entries.length) {
    dmg.appendChild(h('div', { cls: 'dl-h', text: t('res.damage') }));
    entries.forEach(([id, v], i) => {
      const evolved = s.evolved.has(id);
      const color = evolved ? EVOLUTIONS[WEAPONS[id].evolution].color : WEAPONS[id].color;
      const name = evolved ? t(`w.${WEAPONS[id].evolution}`) : t(`w.${id}`);
      const bar = h('i', { style: { width: `${Math.max(3, (v / max) * 100)}%`, background: hexColor(color), 'box-shadow': `0 0 8px ${hexColor(color)}`, 'animation-delay': `${0.2 + i * 0.08}s` } });
      dmg.appendChild(
        h('div', { cls: 'dmg-row', style: { color: hexColor(color) } }, icon(id), h('span', { cls: 'nm', text: name, style: { color: '#eaf4ff' } }), h('div', { cls: 'bar' }, bar), h('span', { cls: 'v', text: fmtNum(v) })),
      );
    });
  }

  const amount = h('span', { text: `+${fmtNum(s.bits)}` });
  const doubleBtn = h('button', { cls: 'btn ad', attrs: { 'data-test': 'double' } }, icon('video', 'video'), t('res.double'));
  doubleBtn.addEventListener('click', async () => {
    if (s.doubled) return;
    doubleBtn.disabled = true;
    const ok = await app.rewarded();
    if (!ok) {
      doubleBtn.disabled = false;
      return;
    }
    app.doubleBits();
    app.sfx('coins');
    amount.textContent = `+${fmtNum(s.bits * 2)}`;
    doubleBtn.textContent = '';
    doubleBtn.append(icon('check'), t('res.doubled'));
    renderNews();
  });
  if (s.bits <= 0) doubleBtn.style.display = 'none';

  const news = new Pager([], { minEm: 16, targetEm: 24, gap: 6 });
  news.el.classList.add('news');
  const renderNews = () => {
    const list: HTMLElement[] = [];
    const item = (ico: string, text: string) => list.push(h('div', { cls: 'ni' }, icon(ico), h('span', { text })));
    if (s.newRecord) item('time', t('res.newRecord'));
    if (s.sectorUnlocked) item('star', t('res.sectorUnlocked', { name: t(`s.${s.sectorUnlocked}`) }));
    if (s.endlessUnlocked) item('star', t('res.endlessUnlocked'));
    if (s.questReward > 0) item('daily', t('res.quest', { n: s.questReward }));
    // one line per kind, however many items a single run opened
    const u = s.unlocks;
    if (u.weapons.length) item(u.weapons[0], t('res.newWeapon', { name: u.weapons.map((id) => t(`w.${id}`)).join(', ') }));
    if (u.passives.length) item(u.passives[0], t('res.newPassive', { name: u.passives.map((id) => t(`p.${id}`)).join(', ') }));
    const chars = u.chars.filter((id) => id !== 'spark');
    if (chars.length) item('characters', t('res.newChar', { name: chars.map((id) => t(`c.${id}`)).join(', ') }));
    for (const a of s.achievements) item('achievements', t('ach.unlocked', { name: t(`a.${a}`) }));
    news.setItems(list, news.current);
    news.el.classList.toggle('empty', list.length === 0);
  };
  renderNews();

  // gentle sign-in offer for guests (cloud saves + leaderboard), at most a few times
  const save = app.save.data;
  let auth: HTMLElement | null = null;
  if (app.platform.kind === 'yandex' && !app.platform.isAuthorized() && save.authOffered < 3 && (s.won || save.stats.runs % 3 === 0)) {
    save.authOffered++;
    app.save.save();
    auth = h(
      'div',
      { cls: 'panel res-auth' },
      h('div', { cls: 'ra-text' }, h('b', { text: t('auth.offerTitle') }), h('span', { text: t('auth.offerShort') })),
      h('button', {
        cls: 'btn small',
        onClick: async () => {
          const ok = await app.platform.openAuth();
          if (ok) {
            await app.save.resync();
            auth?.remove();
          }
        },
      }, icon('user'), t('lb.login')),
    );
  }

  const cont = h('button', {
    cls: 'btn primary',
    attrs: { 'data-test': 'continue' },
    onClick: () => {
      cont.disabled = true;
      app.goMenu(true);
    },
  }, t('res.continue'));

  const el = h(
    'div',
    { cls: 'results dim' },
    h('div', { cls: `title fit-text ${s.won ? 'win' : 'lose'}`, text: s.won ? t('res.victory') : t('res.defeat') }),
    s.won ? h('div', { cls: 'dim-text res-sub', text: t('res.victoryText'), style: { 'text-align': 'center', 'margin-top': '0.3rem' } }) : null,
    h('div', { cls: 'stats' }, stat(formatTime(s.time), t('res.time')), stat(fmtNum(s.kills), t('res.kills')), stat(String(s.level), t('res.level'))),
    dmg,
    h('div', { cls: 'reward panel' }, h('div', { cls: 'dim-text', text: t('res.bits') }), h('div', { cls: 'amount' }, icon('bits'), amount), doubleBtn),
    news.el,
    auth,
    h('div', { cls: 'res-actions' }, cont),
  );
  el.setAttribute('data-screen', 'results');
  el.setAttribute('data-fit', '');
  app.ui.show(el);
}
