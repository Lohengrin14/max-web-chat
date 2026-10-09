/**
 * Светлая или тёмная тема.
 *
 * По умолчанию тема следует системной настройке. Выбор пользователя (кнопка в навигационной
 * колонке) сохраняется в localStorage и с этого момента важнее системы — как в мессенджерах.
 *
 * Тема — атрибут data-theme на <html>, цвета под него задаёт `styles/tokens.css`. Первый раз
 * атрибут ставит inline-скрипт в index.html, ещё до загрузки бандла: иначе страница на миг
 * отрисовалась бы светлой. Здесь — то же правило плюс переключение и слежение за системой.
 */
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/** Тот же ключ читает скрипт в index.html. */
export const THEME_STORAGE_KEY = 'max-web-chat:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Сохранённый выбор важнее системной темы; мусор в хранилище — «выбора нет». */
export function resolveTheme(saved: unknown, systemDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') return saved;
  return systemDark ? 'dark' : 'light';
}

const listeners = new Set<() => void>();

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Хранилище недоступно (приватный режим, запрет cookies) — живём по системной теме.
    return null;
  }
}

function systemDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

function apply(theme: Theme): void {
  if (document.documentElement.dataset.theme === theme) return;
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Явный выбор пользователя: применяется сразу и переживает перезагрузку. */
export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Не сохранится — тема всё равно сменится до перезагрузки.
  }
  apply(theme);
}

/**
 * Вызывается один раз при старте: выставляет тему (если скрипт в index.html не сработал)
 * и, пока пользователь ничего не выбрал, следует за сменой системной темы на лету.
 */
export function initTheme(): void {
  apply(resolveTheme(readSaved(), systemDark()));
  window.matchMedia?.(DARK_QUERY).addEventListener('change', (event) => {
    if (readSaved() === null) apply(event.matches ? 'dark' : 'light');
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getTheme);
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
