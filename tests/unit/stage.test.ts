import { describe, expect, it } from 'vitest';
import { computeStage } from '../../src/app/stage';

describe('stage (requirement 1.6.2.2: active field at most 2:1 on desktop)', () => {
  it('letterboxes ultra-wide and ultra-tall desktop windows', () => {
    expect(computeStage(2560, 900, true)).toEqual({ x: 380, y: 0, w: 1800, h: 900 });
    expect(computeStage(500, 1400, true)).toEqual({ x: 0, y: 200, w: 500, h: 1000 });
  });
  it('keeps normal windows and phones full screen', () => {
    expect(computeStage(1920, 1080, true)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(computeStage(915, 412, false)).toEqual({ x: 0, y: 0, w: 915, h: 412 });
  });
});
