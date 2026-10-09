/**
 * Связь с сервером: состояние подключения, проблемы получения событий, загрузка снимков
 * и подсказка о выключенных вебхуках статусов.
 */
import type { ChatId, ConnectionState } from '@/domain/models';
import type { ChatState, LoadStatus, SyncIssue } from './state';

/**
 * Через сколько после отправки сообщение, так и не получившее ни эха, ни статуса,
 * считается «зависшим». Обычно эхо приходит за 1–3 с; 10 с — запас на медленную очередь.
 */
export const STALLED_STATUS_TIMEOUT_MS = 10_000;

export function setSyncIssue(state: ChatState, issue: SyncIssue | null): ChatState {
  return { ...state, syncIssue: issue };
}

export function setConnection(state: ChatState, connection: ConnectionState): ChatState {
  return { ...state, connection };
}

export function setRecentStatus(state: ChatState, recentStatus: LoadStatus): ChatState {
  return state.recentStatus === recentStatus ? state : { ...state, recentStatus };
}

export function setHistoryStatus(state: ChatState, chatId: ChatId, status: LoadStatus): ChatState {
  if (state.historyStatus[chatId] === status) return state;
  return { ...state, historyStatus: { ...state.historyStatus, [chatId]: status } };
}

/**
 * Проверка «зависших» статусов. Если исходящее дольше таймаута остаётся в `queued` —
 * сервер принял сообщение, но не прислал ни эха, ни статуса, — значит, у инстанса
 * выключены уведомления об отправленных сообщениях и их статусах. Показываем подсказку.
 *
 * Определяем по поведению, а не по настройкам инстанса: так не нужен лишний запрос
 * GetSettings, и подсказка появляется ровно тогда, когда проблема видна пользователю.
 */
export function checkStalledStatuses(state: ChatState, now: number, timeoutMs = STALLED_STATUS_TIMEOUT_MS): ChatState {
  if (state.statusHint !== 'hidden') return state;
  const stalled = Object.values(state.messages).some((list) =>
    list.some((m) => m.direction === 'outgoing' && m.status === 'queued' && now - m.timestamp >= timeoutMs),
  );
  return stalled ? { ...state, statusHint: 'shown' } : state;
}

export function dismissStatusHint(state: ChatState): ChatState {
  return state.statusHint === 'dismissed' ? state : { ...state, statusHint: 'dismissed' };
}

/** Статусы приходят — подсказка больше не нужна (закрытую пользователем не трогаем). */
export function hideStatusHint(state: ChatState): ChatState {
  return state.statusHint === 'shown' ? { ...state, statusHint: 'hidden' } : state;
}
