/**
 * Порты — интерфейсы, через которые приложение общается с внешним миром.
 *
 * Фичи и UI зависят только от этих контрактов. Реализации (GREEN-API, мок, будущий
 * собственный бэкенд) живут в `infrastructure` и подключаются в `app/composition.ts`.
 * Так новый мессенджер или новый транспорт уведомлений — это новый адаптер, а не правка
 * существующего кода.
 */
import type {
  ChatId,
  ConnectionState,
  HistoryBatch,
  MessengerEvent,
  SessionConfig,
} from './models';

export type Unsubscribe = () => void;

/** Возможности и ограничения конкретного провайдера — UI не хардкодит лимиты. */
export interface GatewayCapabilities {
  /** Максимальная длина текстового сообщения в символах. */
  readonly maxTextLength: number;
}

export interface ContactLookupResult {
  exists: boolean;
  /** Заполнен, только если `exists === true`. */
  chatId?: ChatId;
}

/** Обработчики подписки на события мессенджера. */
export interface SubscriptionHandlers {
  /** Новое событие. Может вызываться повторно для одного и того же события — потребитель обязан быть идемпотентным. */
  onEvent: (event: MessengerEvent) => void;
  /**
   * Временная проблема получения событий (сеть, лимиты); подписка продолжает работать
   * и сама повторит попытку. `null` — проблема ушла.
   */
  onIssue?: (error: Error | null) => void;
  /** Неустранимая ошибка (неверный токен, неверная настройка); подписка остановлена. */
  onFatal?: (error: Error) => void;
}

/**
 * Шлюз к мессенджеру — единственная точка, через которую фичи отправляют и получают данные.
 *
 * Все методы бросают ошибки из `domain/errors.ts`, а не HTTP-ответы, чтобы вызывающий код
 * не знал о транспорте.
 */
export interface MessengerGateway {
  readonly capabilities: GatewayCapabilities;

  /** Текущее состояние аккаунта мессенджера. Используется при входе и для индикатора в UI. */
  getConnectionState(signal?: AbortSignal): Promise<ConnectionState>;

  /**
   * Ищет аккаунт мессенджера по номеру телефона.
   * @param phone только цифры с кодом страны, например `79991234567`.
   * Вызов может быть платным по лимитам провайдера — не вызывать на каждое нажатие клавиши.
   */
  findContactByPhone(phone: string): Promise<ContactLookupResult>;

  /**
   * Ставит текстовое сообщение в очередь на отправку.
   * Успех означает «принято провайдером», а не «доставлено»: итог придёт событием `status`.
   * @returns id сообщения у провайдера — по нему сопоставляются последующие статусы.
   */
  sendText(input: { chatId: ChatId; text: string }): Promise<{ id: string }>;

  /**
   * Недавние чаты аккаунта с их последними сообщениями — чтобы после перезагрузки страницы
   * или повторного входа список чатов не начинался с нуля. Включает и диалоги, начатые
   * не в этом приложении (например, с телефона).
   */
  loadRecent(signal?: AbortSignal): Promise<HistoryBatch>;

  /**
   * История одного чата (последние сообщения). Вызывается при открытии чата.
   * Провайдер может ограничивать частоту вызова — не вызывать повторно для уже загруженного чата.
   */
  loadChatHistory(chatId: ChatId, signal?: AbortSignal): Promise<HistoryBatch>;

  /**
   * Подписка на входящие события. Сколько бы ни было подписчиков, источник событий
   * у шлюза один (иначе несколько потребителей делили бы одну очередь уведомлений).
   * @returns функция отписки; после последней отписки источник останавливается.
   */
  subscribe(handlers: SubscriptionHandlers): Unsubscribe;
}

/** Обработчики сырых уведомлений источника. */
export interface NotificationHandlers {
  /**
   * Сырое уведомление в формате провайдера. Источник ждёт завершения обработчика
   * и только потом подтверждает уведомление; ошибка обработчика очередь не останавливает.
   */
  onRaw: (raw: unknown) => void | Promise<void>;
  /** Неустранимая ошибка; цикл получения уже остановлен. */
  onFatal: (error: Error) => void;
  /** Временная ошибка (будет повтор) или `null`, когда связь восстановилась. */
  onIssue?: (error: Error | null) => void;
}

/**
 * Источник сырых уведомлений провайдера. Сейчас это long polling HTTP API; завтра — SSE или
 * WebSocket от собственного бэкенда, принимающего вебхуки. Шлюз от способа доставки не зависит.
 */
export interface NotificationSource {
  /**
   * Запускает получение уведомлений.
   * @returns функция остановки; после её вызова обработчики больше не вызываются.
   */
  start(handlers: NotificationHandlers): Unsubscribe;
}

/**
 * Хранилище конфигурации сессии между перезагрузками страницы.
 * Реализация обязана не бросать исключений: недоступное хранилище — это «нет сохранённой сессии».
 */
export interface CredentialsStore {
  load(): SessionConfig | null;
  save(config: SessionConfig): void;
  clear(): void;
}

/** Создаёт шлюз под конкретную сессию. Выбор реализации — забота composition root. */
export type GatewayFactory = (config: SessionConfig) => MessengerGateway;
