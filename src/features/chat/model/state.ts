/**
 * Форма состояния чатов сессии и его начальное значение.
 *
 * Переходы разложены по темам: `messages.ts` — сообщения и их статусы, `chats.ts` — список
 * чатов, `sync.ts` — связь с сервером. События и снимки, затрагивающие сразу несколько
 * тем, сводит `chatState.ts`. Все переходы — чистые функции: состояние на входе, новое на выходе.
 */
import type { Chat, ChatId, ConnectionState, Message, MessageStatus } from '@/domain/models';

export interface PendingStatus {
  status: MessageStatus;
  error?: string;
}

/** Состояние загрузки данных с сервера. */
export type LoadStatus = 'loading' | 'loaded' | 'failed';

/**
 * Подсказка «включите вебхуки»: hidden — не нужна, shown — показана,
 * dismissed — пользователь закрыл её и в этой сессии она больше не появляется.
 */
export type StatusHint = 'hidden' | 'shown' | 'dismissed';

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
  /** Загрузка недавних чатов при открытии экрана; null — ещё не запускалась. */
  recentStatus: LoadStatus | null;
  /** Загрузка истории по чатам: отсутствие ключа — история ещё не запрашивалась. */
  historyStatus: Record<ChatId, LoadStatus>;
  /** Подсказка о выключенных вебхуках статусов (см. checkStalledStatuses). */
  statusHint: StatusHint;
}

export function createInitialChatState(): ChatState {
  return {
    chats: {},
    messages: {},
    orphanStatuses: {},
    activeChatId: null,
    connection: 'unknown',
    syncIssue: null,
    recentStatus: null,
    historyStatus: {},
    statusHint: 'hidden',
  };
}
