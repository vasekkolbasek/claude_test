/** Keyboard, mouse and touch input. Keys are read by `code`, so layouts don't matter. */
export class Input {
  readonly keys = new Set<string>();
  private edges = new Set<string>();
  joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  mouse = { down: false, x: 0, y: 0 };
  /** Build button (touch / mouse) held. */
  holdButton = false;
  touchMode = false;
  enabled = true;
  onGesture: (() => void) | null = null;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private offs: (() => void)[] = [];
  readonly radius = 56;

  constructor(surface: HTMLElement, joyLayer: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    joyLayer.appendChild(this.base);

    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.offs.push(() => t.removeEventListener(type, fn, opts));
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      this.gesture();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
      this.touchMode = false;
    });
    on(window, 'keyup', (e: KeyboardEvent) => { this.keys.delete(e.code); });
    on(window, 'blur', () => this.reset());
    on(surface, 'pointerdown', (e: PointerEvent) => {
      this.gesture();
      if (!this.enabled) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        this.touchMode = true;
        if (this.joy.active) return;
        this.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        this.base.style.transform = `translate(${e.clientX - this.radius}px, ${e.clientY - this.radius}px)`;
        this.base.classList.add('on');
        this.knob.style.transform = 'translate(0px, 0px)';
      } else if (e.button === 0) {
        this.touchMode = false;
        this.mouse = { down: true, x: e.clientX, y: e.clientY };
      }
      try { surface.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    on(surface, 'pointermove', (e: PointerEvent) => {
      if (this.joy.active && e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const d = Math.hypot(dx, dy);
        // Drag the base along when the finger goes too far (floating joystick).
        if (d > this.radius * 1.4) {
          const k = (d - this.radius * 1.4) / d;
          this.joy.ox += dx * k;
          this.joy.oy += dy * k;
          dx = e.clientX - this.joy.ox; dy = e.clientY - this.joy.oy;
          this.base.style.transform = `translate(${this.joy.ox - this.radius}px, ${this.joy.oy - this.radius}px)`;
        }
        const dd = Math.hypot(dx, dy);
        const cl = Math.min(dd, this.radius);
        const nx = dd > 0 ? (dx / dd) * cl : 0, ny = dd > 0 ? (dy / dd) * cl : 0;
        this.joy.dx = nx / this.radius;
        this.joy.dy = ny / this.radius;
        this.knob.style.transform = `translate(${nx}px, ${ny}px)`;
      } else if (this.mouse.down) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }
    });
    const up = (e: PointerEvent) => {
      if (this.joy.active && e.pointerId === this.joy.id) this.endJoy();
      if (e.pointerType === 'mouse') this.mouse.down = false;
    };
    on(surface, 'pointerup', up);
    on(surface, 'pointercancel', up);
    on(surface, 'lostpointercapture', up);
  }

  private endJoy(): void {
    this.joy.active = false;
    this.joy.dx = 0;
    this.joy.dy = 0;
    this.base.classList.remove('on');
  }

  private gesture(): void { this.onGesture?.(); }

  /** True once per key press. */
  pressed(...codes: string[]): boolean {
    let hit = false;
    for (const c of codes) if (this.edges.delete(c)) hit = true;
    return hit;
  }

  down(...codes: string[]): boolean { for (const c of codes) if (this.keys.has(c)) return true; return false; }

  /** Screen-space movement vector (x right, y down), length ≤ 1. */
  screenMove(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (this.joy.active) { x += this.joy.dx; y += this.joy.dy; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    // Small dead zone for touch
    if (l < 0.12) { x = 0; y = 0; }
    return { x, y };
  }

  get hold(): boolean { return this.down('Space') || this.holdButton; }

  /** Clears edges that were not consumed this frame. */
  endFrame(): void { this.edges.clear(); }

  reset(): void {
    this.keys.clear();
    this.edges.clear();
    this.holdButton = false;
    this.mouse.down = false;
    this.endJoy();
  }

  destroy(): void {
    for (const o of this.offs) o();
    this.offs = [];
    this.base.remove();
  }
}
