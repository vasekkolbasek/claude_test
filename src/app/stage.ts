/**
 * The game stage: the whole window, except on desktop where the active field is kept within a
 * 2:1 aspect ratio (Yandex Games requirement 1.6.2.2) and centred, letterboxed on the long side.
 * Phones and tablets always get the full screen (requirement 1.6.1.1).
 */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_ASPECT = 2;

export function computeStage(winW: number, winH: number, clamp: boolean): StageRect {
  let w = winW;
  let h = winH;
  if (clamp) {
    if (w > h * MAX_ASPECT) w = Math.floor(h * MAX_ASPECT);
    else if (h > w * MAX_ASPECT) h = Math.floor(w * MAX_ASPECT);
  }
  return { x: Math.floor((winW - w) / 2), y: Math.floor((winH - h) / 2), w, h };
}

/** Publishes the stage rectangle as CSS variables used by the layers in styles.css. */
export function applyStage(clamp: boolean): StageRect {
  const r = computeStage(window.innerWidth, window.innerHeight, clamp);
  const s = document.documentElement.style;
  s.setProperty('--sx', `${r.x}px`);
  s.setProperty('--sy', `${r.y}px`);
  s.setProperty('--sw', `${r.w}px`);
  s.setProperty('--sh', `${r.h}px`);
  return r;
}
