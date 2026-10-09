import { afterEach, describe, expect, it } from 'vitest';
import { getTheme, resolveTheme, setTheme, THEME_STORAGE_KEY } from './theme';

describe('resolveTheme', () => {
  it('без сохранённого выбора следует системе', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('сохранённый выбор важнее системы', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('мусор в хранилище считается отсутствием выбора', () => {
    expect(resolveTheme('blue', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });
});

describe('setTheme', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('применяет тему к документу и запоминает выбор', () => {
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    setTheme('light');
    expect(getTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
