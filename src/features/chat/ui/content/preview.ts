/**
 * Текстовые подписи содержимого сообщения: превью в списке чатов и названия типов,
 * которые интерфейс пока не умеет показывать. Новый вид содержимого добавляется сюда
 * и в {@link MessageContent} — других мест, знающих о видах содержимого, в UI нет.
 */
import type { MessageContent, UnsupportedContentKind } from '@/domain/models';

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
  switch (content.kind) {
    case 'text':
      return content.text.replace(/\s+/g, ' ');
    case 'unsupported':
      return unsupportedLabel(content.contentKind);
  }
}
