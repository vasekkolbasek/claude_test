import type { QualitySetting } from '../meta/save';
import type { QualityLevel } from '../render/GameView';

/**
 * Adaptive quality: in "auto" mode drops a level when the frame rate stays under ~47 FPS
 * and climbs back after a sustained period above 58 FPS.
 */
export class QualityController {
  private setting: QualitySetting;
  level: QualityLevel;
  private acc = 0;
  private frames = 0;
  private good = 0;

  constructor(
    setting: QualitySetting,
    private readonly apply: (q: QualityLevel) => void,
  ) {
    this.setting = setting;
    const forced = new URLSearchParams(location.search).get('q');
    if (forced === '0' || forced === '1' || forced === '2') this.setting = Number(forced) as QualityLevel;
    this.level = this.setting === 'auto' ? 2 : this.setting;
    apply(this.level);
  }

  setSetting(s: QualitySetting): void {
    const forced = new URLSearchParams(location.search).get('q');
    if (forced) return;
    this.setting = s;
    if (s !== 'auto') this.level = s;
    this.apply(this.level);
  }

  sample(dt: number): void {
    if (this.setting !== 'auto' || dt <= 0 || dt >= 0.1) return;
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 47 && this.level > 0) {
      this.level = (this.level - 1) as QualityLevel;
      this.good = 0;
      this.apply(this.level);
    } else if (fps > 58) {
      this.good++;
      if (this.good >= 6 && this.level < 2) {
        this.level = (this.level + 1) as QualityLevel;
        this.good = 0;
        this.apply(this.level);
      }
    } else this.good = 0;
  }
}
