import { describe, expect, it } from 'vitest';
import { pluralIndex, setLang, t } from '../../src/i18n';

describe('plural forms', () => {
  it('Russian one/few/many', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 52, 111].map((n) => pluralIndex(n, 'ru'))).toEqual([0, 1, 1, 2, 2, 2, 2, 0, 1, 2, 1, 2]);
  });
  it('picks the form inside a string', () => {
    setLang('ru');
    expect(t('menu.chestReward', { n: 52 })).toBe('Сундук открыт: +52 бита!');
    expect(t('quest.elites', { n: 3 })).toBe('Уничтожьте 3 элитных вируса за один забег');
    expect(t('quest.kills', { n: 1200 })).toBe('Уничтожьте 1200 вирусов за один забег');
    setLang('en');
    expect(t('ach.reward', { n: 1 })).toBe('+1 bit');
    setLang('ru');
  });
});
