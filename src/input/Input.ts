/**
 * Movement input: WASD / arrows (layout independent via KeyboardEvent.code) and a
 * floating virtual joystick that appears wherever the finger (or mouse) goes down.
 */
export class Input {
  readonly move = { x: 0, y: 0 };
  enabled = false;
  /** true once the player has produced any movement (tutorial) */
  moved = false;
  onPause: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;

  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private curX = 0;
  private curY = 0;
  private readonly radius = 56;
  private readonly joy: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(surface: HTMLElement) {
    this.joy = document.createElement('div');
    this.joy.className = 'joy';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.joy.appendChild(this.knob);
    document.body.appendChild(this.joy);

    surface.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMoveEv, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.reset());
  }

  reset(): void {
    this.keys.clear();
    this.pointerId = null;
    this.joy.classList.remove('on');
    this.move.x = 0;
    this.move.y = 0;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
  }

  private onDown = (e: PointerEvent): void => {
    this.onAnyInput?.();
    if (!this.enabled || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.baseX = this.curX = e.clientX;
    this.baseY = this.curY = e.clientY;
    this.joy.style.transform = `translate(${this.baseX}px, ${this.baseY}px)`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.joy.classList.add('on');
  };

  private onMoveEv = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.curX = e.clientX;
    this.curY = e.clientY;
    let dx = this.curX - this.baseX;
    let dy = this.curY - this.baseY;
    const d = Math.hypot(dx, dy);
    // drag the base along when the finger goes past the rim (feels better on phones)
    if (d > this.radius * 1.4) {
      const k = (d - this.radius * 1.4) / d;
      this.baseX += dx * k;
      this.baseY += dy * k;
      dx = this.curX - this.baseX;
      dy = this.curY - this.baseY;
      this.joy.style.transform = `translate(${this.baseX}px, ${this.baseY}px)`;
    }
    const l = Math.min(this.radius, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    this.knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * l}px), calc(-50% + ${Math.sin(a) * l}px))`;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.joy.classList.remove('on');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.onAnyInput?.();
    const c = e.code;
    if (c === 'Escape' || c === 'KeyP') {
      if (this.enabled) this.onPause?.();
      return;
    }
    if (c.startsWith('Arrow') || c === 'Space') e.preventDefault();
    this.keys.add(c);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  update(): void {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      x /= l;
      y /= l;
    } else if (this.pointerId !== null) {
      const dx = this.curX - this.baseX;
      const dy = this.curY - this.baseY;
      const d = Math.hypot(dx, dy);
      const dead = 6;
      if (d > dead) {
        const m = Math.min(1, (d - dead) / (this.radius - dead));
        x = (dx / d) * m;
        y = (dy / d) * m;
      }
    }
    if (!this.enabled) {
      x = 0;
      y = 0;
    }
    this.move.x = x;
    this.move.y = y;
    if (x !== 0 || y !== 0) this.moved = true;
  }

  /** Whether the last input device looked like touch (for hints). */
  static isTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}
