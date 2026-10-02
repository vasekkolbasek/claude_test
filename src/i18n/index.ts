import { en } from './en';
import { ru } from './ru';
import { tr } from './tr';

export type Lang = 'ru' | 'en' | 'tr';
export type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = { ru, en, tr };

let current: Lang = 'ru';
let dict: Dict = ru;

/**
 * Maps a Yandex Games interface language to one of ours.
 * Fallback per platform docs: be/kk/uk/uz → ru, everything else → en.
 */
export function resolveLang(code: string | undefined | null): Lang {
  const c = (code ?? '').toLowerCase().slice(0, 2);
  if (c === 'ru' || c === 'be' || c === 'kk' || c === 'uk' || c === 'uz') return 'ru';
  if (c === 'tr') return 'tr';
  return 'en';
}

export function setLang(code: string | undefined | null): Lang {
  current = resolveLang(code);
  dict = DICTS[current];
  document.documentElement.lang = current;
  return current;
}

export function getLang(): Lang {
  return current;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let s = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

export function has(key: string): boolean {
  return key in dict || key in en;
}

/** For tests: all dictionaries. */
export const ALL_DICTS = DICTS;
