import type { App } from '../../app/App';
import { formatTime } from '../../core/math';
import { EVOLUTIONS, WEAPONS } from '../../data/weapons';
import type { WeaponId } from '../../data/types';
import { t } from '../../i18n';
import type { RunSummary } from '../../meta/progress';
import { fmtNum, h, hexColor } from '../dom';
import { icon } from '../icons';

export function showResults(app: App, s: RunSummary): void {
  const stat = (v: string, label: string) => h('div', { cls: 'stat' }, h('b', { text: v }), h('span', { text: label }));

  // damage per weapon
  const entries = (Object.entries(s.damageBy) as [WeaponId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
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

  const news = h('div', { cls: 'news' });
  const renderNews = () => {
    news.textContent = '';
    const item = (ico: string, text: string) => news.appendChild(h('div', { cls: 'ni' }, icon(ico), h('span', { text })));
    if (s.newRecord) item('time', t('res.newRecord'));
    if (s.sectorUnlocked) item('star', t('res.sectorUnlocked', { name: t(`s.${s.sectorUnlocked}`) }));
    if (s.endlessUnlocked) item('star', t('res.endlessUnlocked'));
    if (s.questReward > 0) item('daily', t('res.quest', { n: s.questReward }));
    for (const id of s.unlocks.weapons) item(id, t('res.newWeapon', { name: t(`w.${id}`) }));
    for (const id of s.unlocks.passives) item(id, t('res.newPassive', { name: t(`p.${id}`) }));
    for (const id of s.unlocks.chars) if (id !== 'spark') item('characters', t('res.newChar', { name: t(`c.${id}`) }));
    for (const a of s.achievements) item('achievements', t('ach.unlocked', { name: t(`a.${a}`) }));
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
      { cls: 'panel', style: { padding: '0.8rem', width: 'min(100%, 28rem)', 'margin-top': '0.6rem', display: 'flex', 'flex-direction': 'column', gap: '0.45rem', 'text-align': 'center' } },
      h('b', { text: t('auth.offerTitle') }),
      h('div', { cls: 'note', text: t('auth.offerText') }),
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
    h('div', { cls: `title ${s.won ? 'win' : 'lose'}`, text: s.won ? t('res.victory') : t('res.defeat') }),
    s.won ? h('div', { cls: 'dim-text', text: t('res.victoryText'), style: { 'text-align': 'center', 'margin-top': '0.3rem' } }) : null,
    h('div', { cls: 'stats' }, stat(formatTime(s.time), t('res.time')), stat(fmtNum(s.kills), t('res.kills')), stat(String(s.level), t('res.level'))),
    dmg,
    h('div', { cls: 'reward panel' }, h('div', { cls: 'dim-text', text: t('res.bits') }), h('div', { cls: 'amount' }, icon('bits'), amount), doubleBtn),
    news,
    auth,
    h('div', { cls: 'res-actions' }, cont),
  );
  el.setAttribute('data-screen', 'results');
  app.ui.show(el);
}
