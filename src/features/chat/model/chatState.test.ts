import { describe, expect, it } from 'vitest';
import { toChatId, type Message, type MessengerEvent } from '@/domain/models';
import {
  addPendingMessage,
  applyEvent,
  confirmMessage,
  createInitialChatState,
  failMessage,
  mergeStatus,
  openChat,
  selectChat,
  selectChatList,
  type ChatState,
} from './chatState';

const CHAT = toChatId('10000000');

function messagesOf(state: ChatState, chatId = CHAT): Message[] {
  return state.messages[chatId] ?? [];
}

function echoEvent(id: string, text = 'Привет', timestamp = 1_000_000): MessengerEvent {
  return {
    type: 'message',
    chat: { id: CHAT },
    message: { id, chatId: CHAT, direction: 'outgoing', content: { kind: 'text', text }, timestamp, status: 'sent' },
  };
}

function incomingEvent(id: string, opts: { chatId?: string; title?: string; timestamp?: number; text?: string } = {}): MessengerEvent {
  const chatId = toChatId(opts.chatId ?? CHAT);
  return {
    type: 'message',
    chat: { id: chatId, ...(opts.title ? { title: opts.title } : {}) },
    message: {
      id,
      chatId,
      direction: 'incoming',
      content: { kind: 'text', text: opts.text ?? 'Ответ' },
      timestamp: opts.timestamp ?? 2_000_000,
    },
  };
}

const statusEvent = (messageId: string, status: 'delivered' | 'read' | 'failed', error?: string): MessengerEvent => ({
  type: 'status',
  chatId: CHAT,
  messageId,
  status,
  ...(error ? { error } : {}),
});

/** Чат, созданный по номеру (как после CheckAccount), с одним неподтверждённым сообщением. */
function withPending(): ChatState {
  let state = openChat(createInitialChatState(), { id: CHAT, phone: '79991234567' }, 500_000);
  state = addPendingMessage(state, { tempId: 'tmp-1', chatId: CHAT, text: 'Привет', timestamp: 1_000_000 });
  return state;
}

describe('chatState: исходящие сообщения', () => {
  it('оптимистичное сообщение получает статус pending, затем настоящий id и queued', () => {
    let state = withPending();
    expect(messagesOf(state)).toMatchObject([{ id: 'tmp-1', status: 'pending' }]);

    state = confirmMessage(state, { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    expect(messagesOf(state)).toMatchObject([{ id: 'srv-1', status: 'queued', content: { text: 'Привет' } }]);
  });

  it('эхо после подтверждения не создаёт дубль и повышает статус до sent', () => {
    let state = confirmMessage(withPending(), { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    state = applyEvent(state, echoEvent('srv-1'));
    expect(messagesOf(state)).toHaveLength(1);
    expect(messagesOf(state)[0]).toMatchObject({ id: 'srv-1', status: 'sent' });
  });

  it('гонка эха: эхо раньше ответа SendMessage — временный id удаляется, а не дублируется', () => {
    let state = applyEvent(withPending(), echoEvent('srv-1'));
    expect(messagesOf(state)).toHaveLength(2);

    state = confirmMessage(state, { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    expect(messagesOf(state)).toHaveLength(1);
    expect(messagesOf(state)[0]).toMatchObject({ id: 'srv-1', status: 'sent' });
  });

  it('гонка статуса: delivered до получения id сохраняется и применяется позже', () => {
    let state = applyEvent(withPending(), statusEvent('srv-1', 'delivered'));
    expect(state.orphanStatuses['srv-1']).toEqual({ status: 'delivered' });

    state = confirmMessage(state, { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    expect(messagesOf(state)[0]).toMatchObject({ id: 'srv-1', status: 'delivered' });
    expect(state.orphanStatuses).toEqual({});
  });

  it('статус не откатывается: read не сменяется на delivered или sent', () => {
    let state = confirmMessage(withPending(), { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    state = applyEvent(state, statusEvent('srv-1', 'read'));
    state = applyEvent(state, statusEvent('srv-1', 'delivered'));
    state = applyEvent(state, echoEvent('srv-1'));
    expect(messagesOf(state)[0]?.status).toBe('read');
  });

  it('failed финальный и хранит причину', () => {
    let state = confirmMessage(withPending(), { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    state = applyEvent(state, statusEvent('srv-1', 'failed', 'На этом номере не зарегистрирован MAX'));
    state = applyEvent(state, statusEvent('srv-1', 'delivered'));
    expect(messagesOf(state)[0]).toMatchObject({ status: 'failed', error: 'На этом номере не зарегистрирован MAX' });
  });

  it('ошибка запроса отправки помечает сообщение failed', () => {
    const state = failMessage(withPending(), { chatId: CHAT, tempId: 'tmp-1', error: 'Нет связи' });
    expect(messagesOf(state)[0]).toMatchObject({ id: 'tmp-1', status: 'failed', error: 'Нет связи' });
  });

  it('mergeStatus: рост статусов и финальность failed', () => {
    expect(mergeStatus('pending', 'queued')).toBe('queued');
    expect(mergeStatus('delivered', 'sent')).toBe('delivered');
    expect(mergeStatus('sent', 'failed')).toBe('failed');
    expect(mergeStatus('failed', 'read')).toBe('failed');
    // Подтверждённая доставка не перечёркивается поздней ошибкой.
    expect(mergeStatus('read', 'failed')).toBe('read');
  });
});

describe('chatState: входящие сообщения', () => {
  it('ответ попадает в чат, созданный по номеру, и имя из chatName заменяет номер', () => {
    let state = confirmMessage(withPending(), { chatId: CHAT, tempId: 'tmp-1', id: 'srv-1' });
    state = applyEvent(state, incomingEvent('in-1', { title: 'Ходабрыш Пробешёлов' }));

    expect(Object.keys(state.chats)).toEqual([CHAT]);
    expect(state.chats[CHAT]).toMatchObject({ title: 'Ходабрыш Пробешёлов', phone: '79991234567' });
    expect(messagesOf(state).map((m) => m.id)).toEqual(['srv-1', 'in-1']);
  });

  it('повторная доставка того же уведомления не создаёт дубль', () => {
    let state = applyEvent(createInitialChatState(), incomingEvent('in-1'));
    const once = state;
    state = applyEvent(state, incomingEvent('in-1'));
    expect(messagesOf(state)).toHaveLength(1);
    expect(state).toBe(once);
    expect(state.chats[CHAT]?.unreadCount).toBe(1);
  });

  it('входящее от нового собеседника создаёт чат', () => {
    const state = applyEvent(createInitialChatState(), incomingEvent('in-1', { chatId: '20000000', title: 'Новый контакт' }));
    expect(state.chats[toChatId('20000000')]).toMatchObject({ title: 'Новый контакт', unreadCount: 1 });
  });

  it('пустое имя не затирает уже известное', () => {
    let state = applyEvent(createInitialChatState(), incomingEvent('in-1', { title: 'Анна' }));
    state = applyEvent(state, incomingEvent('in-2', { timestamp: 3_000_000 }));
    expect(state.chats[CHAT]?.title).toBe('Анна');
  });

  it('непрочитанные считаются только для неактивного чата и сбрасываются при открытии', () => {
    let state = applyEvent(createInitialChatState(), incomingEvent('in-1'));
    state = applyEvent(state, incomingEvent('in-2', { timestamp: 2_500_000 }));
    expect(state.chats[CHAT]?.unreadCount).toBe(2);

    state = selectChat(state, CHAT);
    expect(state.chats[CHAT]?.unreadCount).toBe(0);
    state = applyEvent(state, incomingEvent('in-3', { timestamp: 2_600_000 }));
    expect(state.chats[CHAT]?.unreadCount).toBe(0);
  });

  it('сообщения упорядочены по времени, даже если уведомления пришли не по порядку', () => {
    let state = applyEvent(createInitialChatState(), incomingEvent('late', { timestamp: 3_000 }));
    state = applyEvent(state, incomingEvent('early', { timestamp: 1_000 }));
    expect(messagesOf(state).map((m) => m.id)).toEqual(['early', 'late']);
  });
});

describe('chatState: список чатов', () => {
  it('сортируется по последней активности', () => {
    let state = createInitialChatState();
    state = applyEvent(state, incomingEvent('a', { chatId: '1', timestamp: 1_000 }));
    state = applyEvent(state, incomingEvent('b', { chatId: '2', timestamp: 2_000 }));
    state = applyEvent(state, incomingEvent('c', { chatId: '3', timestamp: 1_500 }));
    expect(selectChatList(state).map((c) => c.id)).toEqual(['2', '3', '1']);

    state = addPendingMessage(state, { tempId: 't', chatId: toChatId('1'), text: 'x', timestamp: 5_000 });
    expect(selectChatList(state).map((c) => c.id)).toEqual(['1', '2', '3']);
  });

  it('открытие существующего чата не меняет его активность', () => {
    let state = applyEvent(createInitialChatState(), incomingEvent('a', { timestamp: 1_000 }));
    state = openChat(state, { id: CHAT }, 99_000);
    expect(state.chats[CHAT]?.lastActivity).toBe(1_000);
    expect(state.activeChatId).toBe(CHAT);
  });

  it('событие подключения обновляет состояние', () => {
    const state = applyEvent(createInitialChatState(), { type: 'connection', state: 'notAuthorized' });
    expect(state.connection).toBe('notAuthorized');
  });
});
