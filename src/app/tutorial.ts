import type { World } from '../game/World';
import { t } from '../i18n';
import { Input } from '../input/Input';
import type { App } from './App';

/** First-run interactive hints: move → auto attack → crystals → upgrades. */
export class Tutorial {
  private step = 0;
  private t = 0;
  private movedT = 0;
  private leveled = false;

  constructor(private readonly app: App) {
    const touch = Input.isTouch();
    app.hud.showHint(t(touch ? 'tut.moveTouch' : 'tut.moveKeys'), touch);
  }

  update(w: World, dt: number): void {
    this.t += dt;
    const hud = this.app.hud;
    switch (this.step) {
      case 0:
        if (w.player.moving) this.movedT += dt;
        if (this.movedT > 1.2 || this.t > 9) this.next(() => hud.showHint(t('tut.auto')));
        break;
      case 1:
        if (this.t > 3.5) {
          if (w.gems.length > 0 || this.t > 8) this.next(() => hud.showHint(t('tut.gems')));
        }
        break;
      case 2:
        if (w.run.gems >= 4 || this.t > 7) this.next(() => hud.hideHint());
        break;
      case 3:
        if (this.leveled && w.state === 'playing') this.next(() => hud.showHint(t('tut.levelup')));
        break;
      case 4:
        if (this.t > 4.5) this.next(() => hud.hideHint());
        break;
      default:
        break;
    }
  }

  private next(fn: () => void): void {
    this.step++;
    this.t = 0;
    fn();
  }

  onLevelUp(): void {
    this.leveled = true;
    if (this.step < 3) {
      this.step = 3;
      this.app.hud.hideHint();
    }
  }

  dispose(): void {
    this.app.hud.hideHint();
  }
}
