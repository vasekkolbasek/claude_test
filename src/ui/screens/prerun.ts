import type { App } from '../../app/App';
import { formatTime } from '../../core/math';
import { CHARACTERS } from '../../data/characters';
import { SECTORS, SECTOR_IDS } from '../../data/sectors';
import type { GameModeId, SectorId } from '../../data/types';
import { WEAPONS } from '../../data/weapons';
import { t } from '../../i18n';
import { sectorUnlocked } from '../../meta/progress';
import { unlockStage } from '../../meta/unlocks';
import { h, hexColor } from '../dom';
import { icon } from '../icons';
import { Pager } from '../pager';
import { featureOpen } from '../../meta/features';
import { showCharacters } from './characters';
import { charCanvas, nextUnlockText, topbar } from './common';
import { showMenu } from './menu';

let lastSector: SectorId = 'ram';
let lastMode: GameModeId = 'normal';

export function showPrerun(app: App): void {
  const save = app.save.data;
  if (!sectorUnlocked(save, lastSector)) lastSector = 'ram';
  if (lastMode === 'endless' && !save.endlessUnlocked) lastMode = 'normal';
  // default to the furthest unlocked sector the first time
  if (lastSector === 'ram') {
    for (const id of SECTOR_IDS) if (sectorUnlocked(save, id) && !save.sectorsCleared.includes(id)) lastSector = id;
    if (!sectorUnlocked(save, lastSector)) lastSector = 'ram';
  }

  const pager = new Pager([], { minEm: 19, targetEm: 26, maxCols: 2 });
  const hint = h('div', { cls: 'note' });
  const segN = h('button', { text: t('prerun.normal') });
  const segE = h('button', null, save.endlessUnlocked ? null : icon('lock'), t('prerun.endless'));
  segE.disabled = !save.endlessUnlocked;
  const seg = h('div', { cls: 'seg' }, segN, segE);

  const render = () => {
    segN.classList.toggle('on', lastMode === 'normal');
    segE.classList.toggle('on', lastMode === 'endless');
    hint.textContent = lastMode === 'endless' ? t('prerun.endlessHint') : save.endlessUnlocked ? '' : t('prerun.endlessLocked');
    if (lastMode === 'endless' && save.bestEndless > 0) hint.textContent += ` ${t('prerun.best', { t: formatTime(save.bestEndless) })}`;
    const cards: HTMLElement[] = [];
    SECTOR_IDS.forEach((id, i) => {
      const s = SECTORS[id];
      const unlocked = sectorUnlocked(save, id);
      const cleared = save.sectorsCleared.includes(id);
      const best = save.bestTime[id];
      const card = h(
        'button',
        { cls: `sector ${id === lastSector ? 'on' : ''} ${unlocked ? '' : 'locked'}`, style: { '--sc': hexColor(s.accent) }, attrs: { 'data-sector': id } },
        h('div', { cls: 'snum', text: String(i + 1) }),
        h(
          'div',
          { cls: 'grow' },
          h('div', { cls: 'sname', text: t(`s.${id}`) }),
          h('div', { cls: 'smod', text: unlocked ? t(`s.${id}.mod`) : t('prerun.sectorLocked') }),
          unlocked
            ? h(
                'div',
                { cls: 'smod' },
                `${t('prerun.rewards', { n: s.bitsMult.toFixed(1).replace(/\.0$/, '') })}`,
                best ? ` · ${t('prerun.best', { t: formatTime(best) })}` : '',
              )
            : null,
        ),
        cleared ? h('div', { cls: 'sbadge row' }, icon('check'), t('prerun.cleared')) : unlocked ? null : icon('lock'),
      );
      card.addEventListener('click', () => {
        if (!unlocked) return;
        lastSector = id;
        render();
      });
      cards.push(card);
    });
    pager.setItems(cards, pager.current);
  };
  segN.addEventListener('click', () => {
    lastMode = 'normal';
    render();
  });
  segE.addEventListener('click', () => {
    if (!save.endlessUnlocked) return;
    lastMode = 'endless';
    render();
  });
  render();

  const ch = CHARACTERS[save.char];
  const strip = h(
    'div',
    { cls: 'char-strip panel' },
    charCanvas(ch.color, 56),
    h(
      'div',
      { cls: 'grow' },
      h('div', { cls: 'dim-text', text: t('prerun.program'), style: { 'font-size': '0.75rem' } }),
      h('div', { cls: 'cn', text: t(`c.${ch.id}`) }),
      h('div', { cls: 'row dim-text', style: { 'font-size': '0.8rem', color: hexColor(WEAPONS[ch.weapon].color) } }, icon(ch.weapon), t(`w.${ch.weapon}`)),
    ),
    featureOpen(save, 'characters') ? h('button', { cls: 'btn small', onClick: () => showCharacters(app, () => showPrerun(app)) }, t('prerun.change')) : null,
  );

  const start = h('button', { cls: 'btn primary', attrs: { 'data-test': 'start' }, onClick: () => app.startRun(lastSector, lastMode) }, icon('play'), t('prerun.start'));

  const el = h(
    'div',
    { cls: 'dim' },
    topbar(app, t('prerun.title'), () => showMenu(app)),
    // Endless only appears once it exists for the player (no locked toggle for newcomers)
    save.endlessUnlocked ? seg : null,
    hint,
    pager.el,
    strip,
    nextUnlockText(unlockStage(save)) ? h('div', { cls: 'note', text: nextUnlockText(unlockStage(save)) }) : null,
    h('div', { cls: 'footer-bar' }, start),
  );
  app.ui.show(el);
}
