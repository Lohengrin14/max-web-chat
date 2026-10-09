/**
 * Доменные модели чата.
 *
 * Модуль описывает предметную область «переписка» без привязки к React и к конкретному
 * провайдеру (GREEN-API). Имена полей выбраны доменные (`id`, `text`, `timestamp`),
 * а не те, что приходят в API (`idMessage`, `textMessage`): перевод между ними делают
 * адаптеры в `infrastructure`. Благодаря этому смена провайдера или формата API не
 * затрагивает состояние, хуки и UI.
 */

/**
 * Идентификатор чата у провайдера.
 *
 * Branded type: строку нельзя случайно передать туда, где ожидается chatId (например,
 * номер телефона вместо chatId — частая ошибка с MAX, где это разные значения).
 * Получить ChatId можно только явно — через {@link toChatId} в адаптере.
 */
export type ChatId = string & { readonly __brand: 'ChatId' };

export function toChatId(raw: string): ChatId {
  return raw as ChatId;
}

/**
 * Жизненный цикл исходящего сообщения:
 * pending → queued → sent → delivered → read, либо failed (финальный).
 * Входящие сообщения статуса не имеют.
 */
export type MessageStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageDirection = 'incoming' | 'outgoing';

/** Виды вложений, которые интерфейс пока не умеет показывать. */
export type UnsupportedContentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'other';

/**
 * Содержимое сообщения — размеченное объединение, чтобы новые типы (файлы, геолокация)
 * добавлялись новым вариантом, а не набором необязательных полей.
 */
export type MessageContent =
  | { kind: 'text'; text: string }
  | { kind: 'unsupported'; contentKind: UnsupportedContentKind };

export interface Message {
  /** Id у провайдера; для ещё не подтверждённых исходящих — временный локальный id. */
  id: string;
  chatId: ChatId;
  direction: MessageDirection;
  content: MessageContent;
  /** Unix-время в миллисекундах. */
  timestamp: number;
  /** Только у исходящих. */
  status?: MessageStatus;
  /** Причина ошибки для статуса `failed`. */
  error?: string;
  /** Автор сообщения в групповом чате (в личном чате автор очевиден). */
  senderName?: string;
}

/** Сведения о чате, которые могут прийти вместе с событием; все поля, кроме id, необязательны. */
export interface ChatInfo {
  id: ChatId;
  /** Имя контакта или группы. */
  title?: string;
  /** Номер телефона в виде цифр с кодом страны, если известен. */
  phone?: string;
}

export interface Chat extends ChatInfo {
  /** Время последней активности (мс) — по нему сортируется список чатов. */
  lastActivity: number;
  unreadCount: number;
}

/**
 * Состояние подключения аккаунта мессенджера.
 * Нейтральные имена: адаптер переводит в них состояния конкретного провайдера.
 */
export type ConnectionState =
  | 'ready'
  | 'starting'
  | 'notAuthorized'
  | 'blocked'
  /** Временные ограничения: отправка возможна только контактам. */
  | 'restricted'
  | 'unknown';

/** События, которые шлюз доставляет приложению из мессенджера. */
export type MessengerEvent =
  | { type: 'message'; chat: ChatInfo; message: Message }
  | { type: 'status'; chatId: ChatId; messageId: string; status: MessageStatus; error?: string }
  | { type: 'connection'; state: ConnectionState };

/** Учётные данные инстанса провайдера: адрес API, номер инстанса и токен доступа. */
export interface Credentials {
  apiUrl: string;
  instanceId: string;
  apiToken: string;
}

/**
 * Конфигурация сессии. Демо-режим — равноправный вариант, а не флаг внутри компонентов:
 * какую реализацию шлюза создать, решает только composition root.
 */
export type SessionConfig = { mode: 'live'; credentials: Credentials } | { mode: 'demo' };
