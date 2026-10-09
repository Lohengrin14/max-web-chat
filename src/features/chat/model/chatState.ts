/**
 * Состояние чатов и чистые функции переходов.
 *
 * Здесь нет ни сети, ни React, ни zustand: каждая функция принимает состояние и возвращает
 * новое. Поэтому вся логика гонок и идемпотентности проверяется обычными unit-тестами,
 * а хранилище (zustand) — лишь тонкая обёртка, которую можно заменить.
 *
 * Ключевые инварианты:
 * - сообщения добавляются только через upsert по id: GREEN-API может доставить одно
 *   уведомление дважды (если DeleteNotification не прошёл), а наше же сообщение
 *   приходит обратно эхом — ни то ни другое не должно создавать дублей;
 * - статус исходящего только растёт (pending → queued → sent → delivered → read),
 *   `failed` финальный — уведомления могут прийти не по порядку;
 * - статус, пришедший раньше самого сообщения, не теряется (orphanStatuses).
 */
import type {
  Chat,
  ChatId,
  ChatInfo,
  ConnectionState,
  Message,
  MessageStatus,
  MessengerEvent,
} from '@/domain/models';

export interface PendingStatus {
  status: MessageStatus;
  error?: string;
}

/** Проблема синхронизации для показа в интерфейсе. */
export interface SyncIssue {
  message: string;
  /** Получение остановлено и само не восстановится. */
  fatal: boolean;
}

export interface ChatState {
  chats: Record<ChatId, Chat>;
  /** Сообщения каждого чата, отсортированные по времени. */
  messages: Record<ChatId, Message[]>;
  /**
   * Статусы, пришедшие раньше, чем мы узнали id сообщения. Ответ SendMessage и
   * уведомление outgoingMessageStatus идут разными каналами, поэтому «delivered» может
   * опередить idMessage. Статус применяется, как только сообщение с этим id появится.
   */
  orphanStatuses: Record<string, PendingStatus>;
  activeChatId: ChatId | null;
  connection: ConnectionState;
  syncIssue: SyncIssue | null;
}

/** Ограничение, чтобы статусы сообщений, отправленных не из этого окна, не копились бесконечно. */
const MAX_ORPHAN_STATUSES = 500;

export function createInitialChatState(): ChatState {
  return {
    chats: {},
    messages: {},
    orphanStatuses: {},
    activeChatId: null,
    connection: 'unknown',
    syncIssue: null,
  };
}

const STATUS_RANK: Record<MessageStatus, number> = {
  pending: 0,
  queued: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
};

/**
 * Слияние статусов: статус не откатывается назад, `failed` финален.
 * Исключение: `failed` не перекрывает уже подтверждённую доставку — если сообщение дошло,
 * поздняя ошибка противоречит факту.
 */
export function mergeStatus(current: MessageStatus | undefined, next: MessageStatus): MessageStatus {
  if (current === undefined) return next;
  if (current === 'failed') return current;
  if (next === 'failed') return current === 'delivered' || current === 'read' ? current : next;
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

/** Открыть чат (создав, если его нет) и сделать активным. */
export function openChat(state: ChatState, info: ChatInfo, now: number): ChatState {
  const withChat = upsertChat(state, info, state.chats[info.id] ? undefined : now);
  return selectChat(withChat, info.id);
}

export function selectChat(state: ChatState, chatId: ChatId | null): ChatState {
  if (chatId === null) return { ...state, activeChatId: null };
  const chat = state.chats[chatId];
  if (!chat) return state;
  return {
    ...state,
    activeChatId: chatId,
    chats: chat.unreadCount ? { ...state.chats, [chatId]: { ...chat, unreadCount: 0 } } : state.chats,
  };
}

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

/**
 * Сервер принял сообщение и выдал настоящий id: временный id заменяется настоящим.
 * Если эхо с этим id уже пришло (гонка), временное сообщение удаляется, а не дублируется.
 */
export function confirmMessage(state: ChatState, input: { chatId: ChatId; tempId: string; id: string }): ChatState {
  const list = state.messages[input.chatId] ?? [];
  const temp = list.find((m) => m.id === input.tempId);
  const echo = findMessage(state, input.chatId, input.id);
  const withoutTemp = list.filter((m) => m.id !== input.tempId);

  if (!temp) return state;

  const next: ChatState = { ...state, messages: { ...state.messages, [input.chatId]: withoutTemp } };
  // Эхо уже в ленте со статусом не ниже `sent` — временная копия просто исчезает.
  if (echo) return next;
  return upsertMessage(next, { ...temp, id: input.id, status: mergeStatus(temp.status, 'queued') });
}

/** Запрос отправки не удался. */
export function failMessage(state: ChatState, input: { chatId: ChatId; tempId: string; error: string }): ChatState {
  return updateMessage(state, input.chatId, input.tempId, (m) => ({ ...m, status: mergeStatus(m.status, 'failed'), error: input.error }));
}

export function setSyncIssue(state: ChatState, issue: SyncIssue | null): ChatState {
  return { ...state, syncIssue: issue };
}

export function setConnection(state: ChatState, connection: ConnectionState): ChatState {
  return { ...state, connection };
}

/** Применение события мессенджера. Идемпотентно: повторное событие не меняет состояние. */
export function applyEvent(state: ChatState, event: MessengerEvent): ChatState {
  switch (event.type) {
    case 'message': {
      const { message } = event;
      const isNew = !findMessage(state, message.chatId, message.id);
      let next = upsertChat(state, event.chat, message.timestamp);
      next = upsertMessage(next, message);
      const countUnread = isNew && message.direction === 'incoming' && next.activeChatId !== message.chatId;
      return touchChat(next, message.chatId, message.timestamp, countUnread);
    }
    case 'status':
      return applyStatus(state, event.chatId, event.messageId, { status: event.status, error: event.error });
    case 'connection':
      return setConnection(state, event.state);
  }
}

/** Чаты по убыванию последней активности. */
export function selectChatList(state: Pick<ChatState, 'chats'>): Chat[] {
  return Object.values(state.chats).sort((a, b) => b.lastActivity - a.lastActivity);
}

export function findChatByPhone(state: ChatState, phone: string): Chat | undefined {
  return Object.values(state.chats).find((c) => c.phone === phone);
}

// ——— внутренние помощники ———

function applyStatus(state: ChatState, chatId: ChatId, messageId: string, pending: PendingStatus): ChatState {
  const located = findMessage(state, chatId, messageId);
  if (located) {
    return updateMessage(state, located.chatId, messageId, (m) => withStatus(m, pending));
  }
  // Сообщения ещё нет — запоминаем статус до его появления.
  const previous = state.orphanStatuses[messageId];
  const status = mergeStatus(previous?.status, pending.status);
  const orphan: PendingStatus = { status };
  const error = status === pending.status ? pending.error : previous?.error;
  if (error) orphan.error = error;

  const orphanStatuses = { ...state.orphanStatuses, [messageId]: orphan };
  const keys = Object.keys(orphanStatuses);
  if (keys.length > MAX_ORPHAN_STATUSES) {
    for (const key of keys.slice(0, keys.length - MAX_ORPHAN_STATUSES)) delete orphanStatuses[key];
  }
  return { ...state, orphanStatuses };
}

function withStatus(message: Message, pending: PendingStatus): Message {
  const status = mergeStatus(message.status, pending.status);
  if (status === message.status) return message;
  const next: Message = { ...message, status };
  if (status === 'failed') next.error = pending.error ?? message.error ?? 'Не удалось отправить сообщение';
  return next;
}

/**
 * Upsert по id. Существующее сообщение сохраняет содержимое и время, статус сливается.
 * Заодно применяется «осиротевший» статус, если он ждал это сообщение.
 */
function upsertMessage(state: ChatState, message: Message): ChatState {
  const list = state.messages[message.chatId] ?? [];
  const index = list.findIndex((m) => m.id === message.id);
  let merged: Message;
  if (index === -1) {
    merged = message;
  } else {
    const existing = list[index]!;
    merged = message.status ? withStatus(existing, { status: message.status, error: message.error }) : existing;
  }

  let orphanStatuses = state.orphanStatuses;
  const orphan = orphanStatuses[message.id];
  if (orphan && merged.direction === 'outgoing') {
    merged = withStatus(merged, orphan);
    orphanStatuses = { ...orphanStatuses };
    delete orphanStatuses[message.id];
  }

  if (index !== -1 && merged === list[index] && orphanStatuses === state.orphanStatuses) return state;

  const nextList = index === -1 ? insertSorted(list, merged) : list.map((m, i) => (i === index ? merged : m));
  return { ...state, orphanStatuses, messages: { ...state.messages, [message.chatId]: nextList } };
}

function updateMessage(state: ChatState, chatId: ChatId, id: string, update: (m: Message) => Message): ChatState {
  const list = state.messages[chatId];
  if (!list) return state;
  let changed = false;
  const nextList = list.map((m) => {
    if (m.id !== id) return m;
    const updated = update(m);
    changed ||= updated !== m;
    return updated;
  });
  return changed ? { ...state, messages: { ...state.messages, [chatId]: nextList } } : state;
}

function findMessage(state: ChatState, chatId: ChatId, id: string): Message | undefined {
  const inChat = state.messages[chatId]?.find((m) => m.id === id);
  if (inChat) return inChat;
  // Статус мог прийти с иным представлением chatId — ищем по всем чатам.
  for (const list of Object.values(state.messages)) {
    const found = list.find((m) => m.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Создаёт чат или дополняет известные сведения, не затирая их пустыми значениями. */
function upsertChat(state: ChatState, info: ChatInfo, activity?: number): ChatState {
  const existing = state.chats[info.id];
  if (existing && (!info.title || info.title === existing.title) && (!info.phone || info.phone === existing.phone)) {
    return state;
  }
  const chat: Chat = existing
    ? { ...existing, ...(info.title ? { title: info.title } : {}), ...(info.phone ? { phone: info.phone } : {}) }
    : { ...info, lastActivity: activity ?? 0, unreadCount: 0 };
  return { ...state, chats: { ...state.chats, [info.id]: chat } };
}

function touchChat(state: ChatState, chatId: ChatId, timestamp: number, countUnread: boolean): ChatState {
  const chat = state.chats[chatId];
  if (!chat) return state;
  const lastActivity = Math.max(chat.lastActivity, timestamp);
  const unreadCount = chat.unreadCount + (countUnread ? 1 : 0);
  if (lastActivity === chat.lastActivity && unreadCount === chat.unreadCount) return state;
  return { ...state, chats: { ...state.chats, [chatId]: { ...chat, lastActivity, unreadCount } } };
}

function insertSorted(list: Message[], message: Message): Message[] {
  let i = list.length;
  while (i > 0 && list[i - 1]!.timestamp > message.timestamp) i--;
  return [...list.slice(0, i), message, ...list.slice(i)];
}
