import type { App } from '../../app/App';
import { CONFIG } from '../../config';
import { CHARACTERS, CHARACTER_IDS } from '../../data/characters';
import { formatTime } from '../../core/math';
import { t } from '../../i18n';
import { chestReward } from '../../meta/progress';
import { currentQuest, dayIndex, ensureDaily, loginRewardState } from '../../meta/daily';
import { nodeAvailable, nodeCost } from '../../meta/workshop';
import { WORKSHOP } from '../../data/workshop';
import { h } from '../dom';
import { icon } from '../icons';
import { bitsPill, setBits } from './common';
import { showAchievements } from './achievements';
import { showCharacters } from './characters';
import { showCodex } from './codex';
import { openDaily } from './daily';
import { showLeaders } from './leaders';
import { showPrerun } from './prerun';
import { openSettings } from './settings';
import { showWorkshop } from './workshop';

function canBuyAnything(app: App): boolean {
  const s = app.save.data;
  return WORKSHOP.some((n) => nodeAvailable(s, n.id) && (nodeCost(s, n.id) ?? Infinity) <= s.bits);
}

function canUnlockChar(app: App): boolean {
  const s = app.save.data;
  return CHARACTER_IDS.some((id) => {
    const u = CHARACTERS[id].unlock;
    return !s.chars.includes(id) && u.type !== 'free' && s.bits >= u.cost;
  });
}

export function showMenu(app: App): void {
  const save = app.save.data;
  const day = dayIndex(app.platform.now());
  ensureDaily(save, day);
  const words = t('game.title').split(' ');
  const pill = bitsPill(save.bits);

  const tile = (ico: string, label: string, onClick: () => void, badge = false) =>
    h('button', { cls: 'tile', onClick }, icon(ico), h('span', { text: label }), badge ? h('i', { cls: 'badge-dot' }) : null);

  const login = loginRewardState(save, day);
  const grid = h(
    'div',
    { cls: 'menu-grid' },
    tile('workshop', t('menu.workshop'), () => showWorkshop(app), canBuyAnything(app)),
    tile('characters', t('menu.characters'), () => showCharacters(app, () => showMenu(app)), canUnlockChar(app)),
    tile('codex', t('menu.codex'), () => showCodex(app)),
    tile('achievements', t('menu.achievements'), () => showAchievements(app)),
    tile('leaders', t('menu.leaders'), () => showLeaders(app)),
    tile('daily', t('daily.title'), () => openDaily(app, () => showMenu(app)), login.can),
  );

  // a brand-new player goes straight into the first sector
  const play = h(
    'button',
    { cls: 'btn primary', attrs: { 'data-test': 'play' }, onClick: () => (save.stats.runs === 0 && !app.testFlow ? app.startRun('ram', 'normal') : showPrerun(app)) },
    icon('play'),
    t('menu.play'),
  );

  // daily quest card
  const q = currentQuest(save);
  const questCard = h('div', { cls: `quest-card ${save.daily.questDone ? 'done' : ''}` });
  if (q) {
    questCard.append(
      h('span', { cls: 'qt', text: `${t('daily.quest')} · ${save.daily.questDone ? t('daily.done') : t('daily.reward', { n: q.reward })}` }),
      h('span', { cls: 'qd', text: t(q.key, { n: q.target(save) }) }),
    );
  }

  // free chest (rewarded video)
  const chest = h('button', { cls: 'btn ad chest-btn' });
  const renderChest = () => {
    const left = save.chestAt - Date.now();
    chest.textContent = '';
    chest.disabled = left > 0;
    chest.append(h('span', { cls: 'row' }, icon('chest'), t('menu.chest')));
    if (left > 0) chest.append(h('small', { text: t('menu.chestIn', { t: formatTime(left / 1000) }) }));
    else chest.append(h('small', { cls: 'row' }, icon('video', 'video'), t('menu.chestOpen')));
  };
  renderChest();
  chest.addEventListener('click', async () => {
    if (save.chestAt > Date.now()) return;
    chest.disabled = true;
    const ok = await app.rewarded();
    if (ok) {
      const n = chestReward(save);
      save.bits += n;
      save.chestAt = Date.now() + CONFIG.chestCooldownMs;
      app.save.save();
      setBits(pill, save.bits);
      app.sfx('coins');
      app.ui.toast(t('menu.chestReward', { n }), 'gold', 'bits');
    }
    renderChest();
  });
  const timer = setInterval(() => {
    if (!el.isConnected) {
      clearInterval(timer);
      return;
    }
    renderChest();
  }, 1000);

  const el = h(
    'div',
    { cls: 'menu' },
    h('div', { cls: 'head' }, pill, h('button', { cls: 'btn icon-only', attrs: { 'aria-label': t('menu.settings') }, onClick: () => openSettings(app, false, () => showMenu(app)) }, icon('settings'))),
    h('div', { cls: 'logo' }, h('span', { cls: 'l1', text: words[0] }), h('span', { cls: 'l2', text: words.slice(1).join(' ') || '' })),
    h('div', { cls: 'center-block' }, play, grid),
    h('div', { cls: 'menu-foot' }, questCard, chest),
  );
  app.ui.show(el);

  if (login.can && save.stats.runs > 0) setTimeout(() => el.isConnected && app.mode === 'menu' && !app.ui.hasModal() && openDaily(app, () => showMenu(app)), 450);
}
