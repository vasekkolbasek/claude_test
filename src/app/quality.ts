import type { QualitySetting } from '../meta/save';
import type { QualityLevel } from '../render/GameView';

/**
 * Adaptive quality ("auto" mode). Every 1.5 s it looks at the frame rate *and* at stutter
 * (the share of frames slower than 25 ms): a steady 52 FPS with regular hitches feels worse
 * than the average says. It drops a level on a low rate or frequent hitches and climbs back
 * only after a long smooth stretch; every drop makes the next climb wait longer, so the
 * level does not oscillate.
 */
export class QualityController {
  private setting: QualitySetting;
  level: QualityLevel;
  private acc = 0;
  private frames = 0;
  private slow = 0;
  private good = 0;
  private drops = 0;

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
    // a frame longer than 0.25 s is a tab switch / GC pause of the whole browser, not load
    if (this.setting !== 'auto' || dt <= 0 || dt > 0.25) return;
    this.acc += dt;
    this.frames++;
    if (dt > 0.025) this.slow++;
    if (this.acc < 1.5) return;
    const fps = this.frames / this.acc;
    const stutter = this.slow / this.frames;
    this.acc = 0;
    this.frames = 0;
    this.slow = 0;
    if ((fps < 50 || stutter > 0.1) && this.level > 0) {
      this.level = (this.level - 1) as QualityLevel;
      this.good = 0;
      this.drops++;
      this.apply(this.level);
    } else if (fps > 57 && stutter < 0.02) {
      this.good++;
      if (this.good >= 8 * 2 ** Math.min(3, this.drops) && this.level < 2) {
        this.level = (this.level + 1) as QualityLevel;
        this.good = 0;
        this.apply(this.level);
      }
    } else this.good = 0;
  }
}
