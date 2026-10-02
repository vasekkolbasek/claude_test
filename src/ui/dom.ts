type Child = Node | string | number | null | undefined | false;

export interface Props {
  cls?: string;
  text?: string;
  style?: Partial<Record<string, string>>;
  attrs?: Record<string, string>;
  onClick?: (e: MouseEvent) => void;
}

/** Tiny element factory. Text is always set via textContent (never HTML). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.cls) el.className = props.cls;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.style) for (const k in props.style) el.style.setProperty(k, props.style[k] ?? '');
    if (props.attrs) for (const k in props.attrs) el.setAttribute(k, props.attrs[k]);
    if (props.onClick) {
      const fn = props.onClick;
      (el as HTMLElement).addEventListener('click', (e: MouseEvent) => {
        if ((el as HTMLButtonElement).disabled) return;
        fn(e);
      });
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function fmtNum(n: number): string {
  const v = Math.floor(n);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function hexColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
