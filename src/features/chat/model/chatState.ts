/**
 * Переходы, затрагивающие сразу несколько частей состояния: события мессенджера,
 * снимки с сервера и оптимистичная отправка.
 *
 * Здесь нет ни сети, ни React, ни zustand: каждая функция принимает состояние и возвращает
 * новое. Поэтому вся логика гонок и идемпотентности проверяется обычными unit-тестами,
 * а хранилище (zustand) — лишь тонкая обёртка, которую можно заменить. Инварианты
 * сообщений и статусов описаны в `messages.ts`.
 */
import type { ChatId, HistoryBatch, Message, MessengerEvent } from '@/domain/models';
import { touchChat, upsertChat } from './chats';
import { applyStatus, findMessage, upsertMessage } from './messages';
import type { ChatState } from './state';
import { hideStatusHint, setConnection } from './sync';

/** Оптимистичное добавление исходящего сообщения до ответа сервера. */
export function addPendingMessage(
  state: ChatState,
  input: { tempId: string; chatId: ChatId; text: string; timestamp: number },
): ChatState {
  const message: Message = {
    id: input.tempId,
    chatId: input.chatId,
    direction: 'outgoing',
    content: { kind: 'text', text: input.text },
    timestamp: input.timestamp,
    status: 'pending',
  };
  return touchChat(upsertMessage(state, message), input.chatId, input.timestamp, false);
}

/** Применение события мессенджера. Идемпотентно: повторное событие не меняет состояние. */
export function applyEvent(state: ChatState, event: MessengerEvent): ChatState {
  switch (event.type) {
    case 'message': {
      const { message } = event;
      const isNew = !findMessage(state, message.chatId, message.id);
      // Эхо исходящего — доказательство, что уведомления о статусах приходят.
      let next = message.direction === 'outgoing' ? hideStatusHint(state) : state;
      next = upsertChat(next, event.chat, message.timestamp);
      next = upsertMessage(next, message);
      const countUnread = isNew && message.direction === 'incoming' && next.activeChatId !== message.chatId;
      return touchChat(next, message.chatId, message.timestamp, countUnread);
    }
    case 'status':
      return applyStatus(hideStatusHint(state), event.chatId, event.messageId, { status: event.status, error: event.error });
    case 'connection':
      return setConnection(state, event.state);
  }
}

/**
 * Слияние снимка с сервера (недавние чаты, история чата) с текущим состоянием.
 *
 * Тот же upsert по id, что и для событий: сообщения, которые уже пришли уведомлениями,
 * не дублируются, а их статусы только растут. В отличие от событий, история не
 * увеличивает счётчик непрочитанных — это прошлое, а не новые сообщения.
 */
export function applyHistory(state: ChatState, batch: HistoryBatch): ChatState {
  let next = state;
  for (const info of batch.chats) next = upsertChat(next, info);
  for (const message of batch.messages) {
    next = upsertChat(next, { id: message.chatId });
    next = upsertMessage(next, message);
    next = touchChat(next, message.chatId, message.timestamp, false);
  }
  return next;
}
