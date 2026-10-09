/**
 * Сообщения и их статусы.
 *
 * Инварианты:
 * - сообщения добавляются только через upsert по id: GREEN-API может доставить одно
 *   уведомление дважды (если DeleteNotification не прошёл), а наше же сообщение
 *   приходит обратно эхом — ни то ни другое не должно создавать дублей;
 * - статус исходящего только растёт (pending → queued → sent → delivered → read),
 *   `failed` финальный — уведомления могут прийти не по порядку;
 * - статус, пришедший раньше самого сообщения, не теряется (orphanStatuses).
 */
import type { ChatId, Message, MessageStatus } from '@/domain/models';
import type { ChatState, PendingStatus } from './state';

/** Ограничение, чтобы статусы сообщений, отправленных не из этого окна, не копились бесконечно. */
const MAX_ORPHAN_STATUSES = 500;

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

/** Статус исходящего: применяется к сообщению или ждёт его появления среди «осиротевших». */
export function applyStatus(state: ChatState, chatId: ChatId, messageId: string, pending: PendingStatus): ChatState {
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

/**
 * Upsert по id. Существующее сообщение сохраняет содержимое и время, статус сливается.
 * Заодно применяется «осиротевший» статус, если он ждал это сообщение.
 */
export function upsertMessage(state: ChatState, message: Message): ChatState {
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

export function findMessage(state: ChatState, chatId: ChatId, id: string): Message | undefined {
  const inChat = state.messages[chatId]?.find((m) => m.id === id);
  if (inChat) return inChat;
  // Статус мог прийти с иным представлением chatId — ищем по всем чатам.
  for (const list of Object.values(state.messages)) {
    const found = list.find((m) => m.id === id);
    if (found) return found;
  }
  return undefined;
}

// ——— внутренние помощники ———

function withStatus(message: Message, pending: PendingStatus): Message {
  const status = mergeStatus(message.status, pending.status);
  if (status === message.status) return message;
  const next: Message = { ...message, status };
  if (status === 'failed') next.error = pending.error ?? message.error ?? 'Не удалось отправить сообщение';
  return next;
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

function insertSorted(list: Message[], message: Message): Message[] {
  let i = list.length;
  while (i > 0 && list[i - 1]!.timestamp > message.timestamp) i--;
  return [...list.slice(0, i), message, ...list.slice(i)];
}
