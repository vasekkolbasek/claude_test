import { en } from './en';
import { ru, type Dict, type LangKey } from './ru';

export type Lang = 'ru' | 'en';
const DICTS: Record<Lang, Dict> = { ru, en };
let dict: Dict = ru;
let current: Lang = 'ru';

/** Russian-speaking regions get Russian, everyone else English. */
export function normalizeLang(code: string | undefined | null): Lang {
  const c = (code || '').toLowerCase().slice(0, 2);
  return ['ru', 'be', 'kk', 'uk', 'uz', 'ky', 'tg', 'hy', 'az', 'tt'].includes(c) ? 'ru' : 'en';
}

export function setLang(l: Lang): void {
  current = l;
  dict = DICTS[l];
  document.documentElement.lang = l;
}
export function getLang(): Lang { return current; }

function fill(s: string, p?: Record<string, string | number>): string {
  if (!p) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (p[k] !== undefined ? String(p[k]) : `{${k}}`));
}

export function t(key: LangKey, p?: Record<string, string | number>): string {
  return fill(dict[key] ?? ru[key] ?? key, p);
}

/** Dynamic key lookup (data-driven ids). */
export function tk(key: string, p?: Record<string, string | number>): string {
  const d = dict as Record<string, string>;
  const r = ru as Record<string, string>;
  return fill(d[key] ?? r[key] ?? key, p);
}

export function hasKey(key: string): boolean { return key in dict; }
