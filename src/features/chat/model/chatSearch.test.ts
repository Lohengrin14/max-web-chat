import { describe, expect, it } from 'vitest';
import { toChatId, type Chat, type ChatId, type Message } from '@/domain/models';
import { searchChats } from './chatSearch';

const SEMEN = toChatId('1');
const UNNAMED = toChatId('2');

const chats: Chat[] = [
  { id: SEMEN, title: 'Семён Петров', phone: '79991234567', lastActivity: 2, unreadCount: 0 },
  { id: UNNAMED, phone: '375291234567', lastActivity: 1, unreadCount: 0 },
];

function text(id: string, chatId: ChatId, value: string, timestamp: number): Message {
  return { id, chatId, direction: 'incoming', content: { kind: 'text', text: value }, timestamp };
}

const messages: Record<ChatId, Message[]> = {
  [SEMEN]: [text('a', SEMEN, 'Встреча в пятницу', 1), text('b', SEMEN, 'Перенесли встречу', 2), text('c', SEMEN, 'Ок', 3)],
  [UNNAMED]: [
    text('d', UNNAMED, 'Привет', 1),
    { id: 'e', chatId: UNNAMED, direction: 'incoming', content: { kind: 'unsupported', contentKind: 'image' }, timestamp: 2 },
  ],
};

const ids = (query: string) => searchChats(chats, messages, query).map((r) => r.chat.id);

describe('searchChats', () => {
  it('пустой запрос возвращает все чаты', () => {
    expect(ids('  ')).toEqual([SEMEN, UNNAMED]);
  });

  it('ищет по имени без учёта регистра и «ё»', () => {
    expect(searchChats(chats, messages, 'семен')).toEqual([{ chat: chats[0] }]);
  });

  it.each(['375 29', '+7 999 123-45', '8999123', '99912'])('ищет по номеру «%s»', (query) => {
    expect(ids(query)).toHaveLength(1);
  });

  it('не ищет по номеру, если в запросе есть буквы', () => {
    expect(ids('9 мая')).toEqual([]);
  });

  it('ищет по сообщениям и возвращает последнее совпавшее', () => {
    const [result] = searchChats(chats, messages, 'встреч');
    expect(result?.message?.id).toBe('b');
  });

  it('ничего не находит', () => {
    expect(ids('отпуск')).toEqual([]);
  });
});
