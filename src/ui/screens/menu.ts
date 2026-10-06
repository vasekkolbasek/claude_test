import type { App } from '../../app/App';
import { CONFIG } from '../../config';
import { CHARACTERS, CHARACTER_IDS } from '../../data/characters';
import { formatTime } from '../../core/math';
import { t } from '../../i18n';
import { chestReward } from '../../meta/progress';
import { currentQuest, dayIndex, ensureDaily, loginRewardState } from '../../meta/daily';
import { charAvailable } from '../../meta/unlocks';
import { featureNew, featureOpen, freshFeatures, markSeen, type FeatureId } from '../../meta/features';
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

/** menu label of each feature (for the hint when several open at once) */
const FEATURE_LABEL: Record<FeatureId, string> = {
  workshop: 'menu.workshop',
  achievements: 'menu.achievements',
  characters: 'menu.characters',
  codex: 'menu.codex',
  daily: 'daily.title',
  chest: 'menu.chest',
  leaders: 'menu.leaders',
};

function canBuyAnything(app: App): boolean {
  const s = app.save.data;
  return WORKSHOP.some((n) => nodeAvailable(s, n.id) && (nodeCost(s, n.id) ?? Infinity) <= s.bits);
}

function canUnlockChar(app: App): boolean {
  const s = app.save.data;
  return CHARACTER_IDS.some((id) => {
    const u = CHARACTERS[id].unlock;
    return !s.chars.includes(id) && u.type === 'bits' && charAvailable(s, id) && s.bits >= u.cost;
  });
}

export function showMenu(app: App): void {
  const save = app.save.data;
  const day = dayIndex(app.platform.now());
  ensureDaily(save, day);
  const words = t('game.title').split(' ');
  const pill = bitsPill(save.bits);

  const login = loginRewardState(save, day);
  /** gated tiles: hidden until the feature opens, «NEW» until first visited */
  const tile = (id: FeatureId, ico: string, label: string, onClick: () => void, badge = false) => {
    if (!featureOpen(save, id)) return null;
    const isNew = featureNew(save, id);
    return h(
      'button',
      {
        cls: `tile ${isNew ? 'is-new' : ''}`,
        attrs: { 'data-feature': id },
        onClick: () => {
          if (markSeen(save, id)) app.save.save();
          onClick();
        },
      },
      icon(ico),
      h('span', { text: label }),
      isNew ? h('b', { cls: 'new-tag', text: t('feat.new') }) : badge ? h('i', { cls: 'badge-dot' }) : null,
    );
  };
  const tiles = [
    tile('workshop', 'workshop', t('menu.workshop'), () => showWorkshop(app), canBuyAnything(app)),
    tile('characters', 'characters', t('menu.characters'), () => showCharacters(app, () => showMenu(app)), canUnlockChar(app)),
    tile('codex', 'codex', t('menu.codex'), () => showCodex(app)),
    tile('daily', 'daily', t('daily.title'), () => openDaily(app, () => showMenu(app)), login.can),
    tile('achievements', 'achievements', t('menu.achievements'), () => showAchievements(app)),
    tile('leaders', 'leaders', t('menu.leaders'), () => showLeaders(app)),
  ].filter((x): x is HTMLButtonElement => x !== null);
  const grid = tiles.length ? h('div', { cls: `menu-grid n${tiles.length}` }, ...tiles) : null;
  // one short line about the new features, so the player knows why buttons appeared:
  // what a single one is for, or just their names when several open at once
  const fresh = freshFeatures(save);
  const names = fresh.map((id) => t(FEATURE_LABEL[id]));
  const hintText = fresh.length === 1 ? t(`feat.${fresh[0]}`) : t('feat.many', { list: names.slice(0, -1).join(', ') + t('feat.and') + names[names.length - 1] });
  const featHint = fresh.length ? h('div', { cls: 'feat-hint', text: hintText }) : null;

  // a brand-new player goes straight into the first sector
  const play = h(
    'button',
    { cls: 'btn primary', attrs: { 'data-test': 'play' }, onClick: () => (save.stats.runs === 0 && !app.testFlow ? app.startRun('ram', 'normal') : showPrerun(app)) },
    icon('play'),
    t('menu.play'),
  );

  // daily quest card
  const q = featureOpen(save, 'daily') ? currentQuest(save) : null;
  const questCard = q ? h('div', { cls: `quest-card ${save.daily.questDone ? 'done' : ''}` }) : null;
  if (q && questCard) {
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

  const showChest = featureOpen(save, 'chest');
  const el = h(
    'div',
    { cls: `menu ${tiles.length ? '' : 'first'}` },
    h('div', { cls: 'head' }, featureOpen(save, 'workshop') ? pill : h('span'), h('button', { cls: 'btn icon-only', attrs: { 'aria-label': t('menu.settings') }, onClick: () => openSettings(app, false, () => showMenu(app)) }, icon('settings'))),
    h('div', { cls: 'logo' }, h('span', { cls: 'l1', text: words[0] }), h('span', { cls: 'l2', text: words.slice(1).join(' ') || '' })),
    h('div', { cls: 'center-block' }, play, featHint, grid),
    questCard || showChest ? h('div', { cls: 'menu-foot' }, questCard, showChest ? chest : null) : null,
  );
  app.ui.show(el);

  if (login.can && featureOpen(save, 'daily')) {
    setTimeout(() => {
      if (!el.isConnected || app.mode !== 'menu' || app.ui.hasModal()) return;
      if (markSeen(save, 'daily')) app.save.save();
      openDaily(app, () => showMenu(app));
    }, 450);
  }
}
