import { t } from '../i18n';
import type { Game } from '../systems/Game';
import type { Hud } from './hud';

type Step = 'move' | 'slot' | 'hold' | 'paths' | 'night' | 'fight' | 'done';

/** Contextual first-run hints (no walls of text). */
export class Tutorial {
  private step: Step = 'move';
  private t0 = 0;
  private startX: number;
  private startZ: number;
  private choiceSeen = false;
  finished = false;

  constructor(private g: Game, private hud: Hud, private touch: () => boolean, private onDone: () => void) {
    this.startX = g.hero.x;
    this.startZ = g.hero.z;
  }

  update(dt: number): void {
    if (this.finished) return;
    const g = this.g;
    this.t0 += dt;
    if (g.choice && !this.choiceSeen) {
      this.hud.hint(t('tut.choice'));
      return;
    }
    if (!g.choice && this.choiceSeen === false && g.stats.built > 1) this.choiceSeen = true;
    switch (this.step) {
      case 'move':
        this.hud.hint(this.touch() ? t('tut.moveTouch') : t('tut.move'));
        if (Math.hypot(g.hero.x - this.startX, g.hero.z - this.startZ) > 3) this.go('slot');
        break;
      case 'slot':
        this.hud.hint(t('tut.slot'));
        if (g.activeSlot()) this.go('hold');
        if (g.stats.built > 0) this.go('paths');
        break;
      case 'hold':
        this.hud.hint(this.touch() ? t('tut.holdTouch') : t('tut.hold'));
        if (g.stats.built > 0) this.go('paths');
        else if (!g.activeSlot() && this.t0 > 1.5) this.go('slot');
        break;
      case 'paths':
        this.hud.hint(t('tut.paths'));
        if (this.t0 > 5) this.go('night');
        if (g.phase === 'night') this.go('fight');
        break;
      case 'night':
        this.hud.hint(g.stats.built >= 2 || g.coins < 3 ? t('tut.night') : t('tut.slot'));
        if (g.phase === 'night') this.go('fight');
        break;
      case 'fight':
        this.hud.hint(this.touch() ? t('tut.fightTouch') : t('tut.fight'));
        if (this.t0 > 7 || g.phase !== 'night') this.go('done');
        break;
      case 'done':
        this.hud.hint(null);
        this.finished = true;
        this.onDone();
        break;
    }
    if (this.choiceSeen && !g.choice && this.step === 'done') this.hud.hint(null);
  }

  private go(s: Step): void {
    this.step = s;
    this.t0 = 0;
  }
}
