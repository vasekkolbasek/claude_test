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

/** Index of the plural form for `n` (ru: one/few/many, en: one/other, tr: single form). */
export function pluralIndex(n: number, lang: Lang = current): number {
  const a = Math.abs(Math.floor(n));
  if (lang === 'ru') {
    if (a % 10 === 1 && a % 100 !== 11) return 0;
    if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return 1;
    return 2;
  }
  if (lang === 'en') return a === 1 ? 0 : 1;
  return 0;
}

/**
 * Translates `key`. `{name}` is replaced by params.name; `{name|form1|form2|…}` picks the plural
 * form for the number params.name (e.g. «{n|бит|бита|битов}»).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dict[key] ?? en[key] ?? key;
  if (params) {
    s = s.replace(/\{(\w+)\|([^}]*)\}/g, (m, name: string, forms: string) => {
      const v = Number(params[name]);
      if (!Number.isFinite(v)) return m;
      const list = forms.split('|');
      return list[Math.min(list.length - 1, pluralIndex(v))] ?? m;
    });
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

export function has(key: string): boolean {
  return key in dict || key in en;
}

/** For tests: all dictionaries. */
export const ALL_DICTS = DICTS;
