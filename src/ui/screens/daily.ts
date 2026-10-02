import type { App } from '../../app/App';
import { t } from '../../i18n';
import { claimLoginReward, currentQuest, DAILY_REWARDS, dayIndex, loginRewardState } from '../../meta/daily';
import { h } from '../dom';
import { icon } from '../icons';

export function openDaily(app: App, after: () => void): void {
  const save = app.save.data;
  const day = dayIndex(app.platform.now());
  const st = loginRewardState(save, day);
  const days = h('div', { cls: 'days' });
  DAILY_REWARDS.forEach((r, i) => {
    const n = i + 1;
    const got = st.can ? n < st.streakDay : n <= st.streakDay;
    const today = st.can && n === st.streakDay;
    days.appendChild(h('div', { cls: `day ${got ? 'got' : ''} ${today ? 'today' : ''}` }, h('span', { text: t('daily.day', { n }) }), h('b', { text: String(r) }), got ? icon('check') : icon('bits')));
  });
  const q = currentQuest(save);
  const claim = h('button', { cls: 'btn primary', attrs: { 'data-test': 'claim' } }, icon('bits'), st.can ? `${t('daily.claim')} +${DAILY_REWARDS[st.streakDay - 1]}` : t('common.close'));
  claim.addEventListener('click', () => {
    if (st.can) {
      const n = claimLoginReward(save, day);
      app.save.save(true);
      app.sfx('coins');
      app.ui.toast(`+${n}`, 'gold', 'bits');
    }
    app.ui.closeModal(m);
    after();
  });
  const m = app.ui.openModal(
    h(
      'div',
      null,
      h(
        'div',
        { cls: 'dialog panel' },
        h('h3', { text: t('daily.title') }),
        h('p', { text: t('daily.streak') }),
        days,
        q
          ? h(
              'div',
              { cls: `quest-card ${save.daily.questDone ? 'done' : ''}`, style: { 'text-align': 'left' } },
              h('span', { cls: 'qt', text: `${t('daily.quest')} · ${save.daily.questDone ? t('daily.done') : t('daily.reward', { n: q.reward })}` }),
              h('span', { cls: 'qd', text: t(q.key, { n: q.target(save) }) }),
            )
          : null,
        h('div', { cls: 'btns' }, claim),
      ),
    ),
  );
}
