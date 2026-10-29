import { afterEach, describe, expect, it } from 'vitest';
import vi from '../../src/data/locales/vi.json';
import en from '../../src/data/locales/en.json';
import { getLocale, LANGUAGES, setLocale, t } from '../../src/core/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLocale('vi'));

describe('languages', () => {
  it('defaults to Vietnamese and offers Vietnamese and English', () => {
    expect(getLocale()).toBe('vi');
    expect(LANGUAGES.map((l) => l.code)).toEqual(['vi', 'en']);
  });

  it('switches language and translates, with {placeholders} filled', () => {
    expect(t('settings.title')).toBe('Cài đặt');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('settings.title')).toBe('Settings');
    expect(t('save.problem', { status: 'corrupt' })).toBe('The save could not be read (corrupt). It was backed up and a new game started.');
  });

  it('falls back to Vietnamese for a key the English file does not have, then to the key itself', () => {
    setLocale('en');
    const missing = Object.keys(vi).find((k) => !(k in en))!;
    expect(missing).toBeTruthy();
    expect(t(missing)).toBe((vi as Record<string, string>)[missing]);
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('an unknown language code falls back to Vietnamese', () => {
    setLocale('xx');
    expect(getLocale()).toBe('vi');
  });

  it('every English string belongs to a Vietnamese key and keeps its {placeholders}', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(k in vi, `en key ${k} has no Vietnamese original`).toBe(true);
      expect(placeholders(v), `placeholders of ${k}`).toEqual(placeholders((vi as Record<string, string>)[k]!));
    }
  });
});
