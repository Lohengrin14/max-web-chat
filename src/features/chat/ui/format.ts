/**
 * Форматирование для интерфейса чатов: время, дни, превью, заголовки.
 * Чистые функции — их легко переиспользовать и менять локаль в одном месте.
 */
import type { Chat, MessageContent, UnsupportedContentKind } from '@/domain/models';
import { formatPhone } from '@/shared/phone';

const LOCALE = 'ru-RU';
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' });
const dayYearFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const shortDateFormat = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: '2-digit' });

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatTime(ts: number): string {
  return timeFormat.format(ts);
}

/** Подпись разделителя в ленте: «Сегодня», «Вчера», «5 марта», «5 марта 2025 г.». */
export function formatDay(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return new Date(ts).getFullYear() === new Date(now).getFullYear() ? dayFormat.format(ts) : dayYearFormat.format(ts);
}

/** Время в списке чатов: сегодня — часы, на этой неделе — день недели, иначе — дата. */
export function formatListTime(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (diffDays === 0) return formatTime(ts);
  if (diffDays < 7) return weekdayFormat.format(ts);
  return shortDateFormat.format(ts);
}

const UNSUPPORTED_LABELS: Record<UnsupportedContentKind, string> = {
  image: 'Фото',
  video: 'Видео',
  audio: 'Аудио',
  document: 'Документ',
  sticker: 'Стикер',
  location: 'Геолокация',
  contact: 'Контакт',
  reaction: 'Реакция',
  other: 'Сообщение',
};

export function unsupportedLabel(kind: UnsupportedContentKind): string {
  return UNSUPPORTED_LABELS[kind];
}

/** Одна строка для превью в списке чатов. */
export function contentPreview(content: MessageContent): string {
  if (content.kind === 'text') return content.text.replace(/\s+/g, ' ');
  return unsupportedLabel(content.contentKind);
}

/** Имя чата: имя контакта → номер → id. */
export function chatTitle(chat: Pick<Chat, 'id' | 'title' | 'phone'>): string {
  if (chat.title) return chat.title;
  if (chat.phone) return formatPhone(chat.phone);
  return `Чат ${chat.id}`;
}
