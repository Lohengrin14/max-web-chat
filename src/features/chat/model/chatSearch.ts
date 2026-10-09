/**
 * Поиск по списку чатов: по имени контакта, номеру телефона и тексту сообщений.
 *
 * Ищем локально, по тому, что уже загружено в хранилище: запросов к API нет, поэтому
 * поиск мгновенный и не расходует лимиты. Сообщения, которых нет в загруженной истории
 * чата, не находятся.
 */
import type { Chat, ChatId, Message } from '@/domain/models';

export interface ChatSearchResult {
  chat: Chat;
  /** Последнее сообщение, в котором нашёлся запрос; нет — совпало имя или номер. */
  message?: Message;
}

/** Регистр и «ё» не важны: «Семён» находится по «семен». */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е');
}

/**
 * Цифры запроса для поиска по номеру, если запрос похож на номер: только цифры, пробелы,
 * «+», скобки и дефисы. Ведущая 8 — российская привычка вместо +7.
 */
function phoneDigits(query: string): string[] {
  if (!/^[\d\s+()-]+$/.test(query)) return [];
  const digits = query.replace(/\D/g, '');
  if (!digits) return [];
  return digits.startsWith('8') ? [digits, `7${digits.slice(1)}`] : [digits];
}

/**
 * Чаты, в которых нашёлся запрос, в порядке списка. Пустой запрос — все чаты без изменений.
 */
export function searchChats(
  chats: readonly Chat[],
  messages: Readonly<Record<ChatId, readonly Message[]>>,
  rawQuery: string,
): ChatSearchResult[] {
  const query = normalizeSearchText(rawQuery.trim());
  if (!query) return chats.map((chat) => ({ chat }));
  const digits = phoneDigits(query);

  const results: ChatSearchResult[] = [];
  for (const chat of chats) {
    const message = findLastMatch(messages[chat.id], query);
    const byName = chat.title !== undefined && normalizeSearchText(chat.title).includes(query);
    const byPhone = chat.phone !== undefined && digits.some((d) => chat.phone!.includes(d));
    if (message) results.push({ chat, message });
    else if (byName || byPhone) results.push({ chat });
  }
  return results;
}

function findLastMatch(list: readonly Message[] | undefined, query: string): Message | undefined {
  if (!list) return undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const { content } = list[i]!;
    if (content.kind === 'text' && normalizeSearchText(content.text).includes(query)) return list[i];
  }
  return undefined;
}
