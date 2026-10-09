/**
 * Реализация MessengerGateway поверх GREEN-API для мессенджера MAX.
 *
 * Шлюз собирает вызовы методов API (GetStateInstance, CheckAccount, SendMessage) и
 * переводит уведомления источника в доменные события через `mappers/`. О токене и
 * формате URL он не знает — это забота HttpClient; о способе доставки уведомлений
 * тоже — это NotificationSource. Поэтому замена транспорта или вынос токена на сервер
 * не затрагивает этот класс.
 */
import { ApiError, InstanceNotReadyError, RateLimitError, ValidationError } from '@/domain/errors';
import { toChatId, type ChatId, type ConnectionState, type Credentials, type HistoryBatch } from '@/domain/models';
import type {
  ContactLookupResult,
  GatewayCapabilities,
  MessengerGateway,
  NotificationSource,
  SubscriptionHandlers,
  Unsubscribe,
} from '@/domain/ports';
import { createSharedSubscription } from '../common/sharedSubscription';
import { HttpClient, type FetchFn } from '../http/HttpClient';
import { HttpPollingSource } from './HttpPollingSource';
import { mapConnectionState } from './mappers/connection';
import { buildHistoryBatch } from './mappers/journal';
import { mapNotification } from './mappers/notifications';
import {
  checkAccountResponseSchema,
  contactsResponseSchema,
  journalResponseSchema,
  sendMessageResponseSchema,
  stateInstanceResponseSchema,
} from './schemas';

/** Лимит длины текста SendMessage по документации. */
const MAX_TEXT_LENGTH = 4000;

/** За какой период подтягивать недавние чаты (минуты; 1440 — значение API по умолчанию, сутки). */
const RECENT_MINUTES = 1440;

/** Сколько последних сообщений загружать при открытии чата. */
const HISTORY_COUNT = 100;

export class GreenApiGateway implements MessengerGateway {
  readonly capabilities: GatewayCapabilities = { maxTextLength: MAX_TEXT_LENGTH };
  readonly subscribe: (handlers: SubscriptionHandlers) => Unsubscribe;

  constructor(
    private readonly http: Pick<HttpClient, 'request'>,
    source: NotificationSource,
  ) {
    this.subscribe = createSharedSubscription((broadcast) =>
      source.start({
        onRaw: (raw) => {
          const event = mapNotification(raw);
          if (event) broadcast.onEvent(event);
        },
        onIssue: broadcast.onIssue,
        onFatal: broadcast.onFatal,
      }),
    );
  }

  async getConnectionState(signal?: AbortSignal): Promise<ConnectionState> {
    const raw = await this.http.request({ httpMethod: 'GET', apiMethod: 'getStateInstance', signal });
    const parsed = stateInstanceResponseSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError('Сервер вернул неожиданный ответ. Проверьте apiUrl.');
    return mapConnectionState(parsed.data.stateInstance);
  }

  async findContactByPhone(phone: string): Promise<ContactLookupResult> {
    if (!/^\d{11,12}$/.test(phone)) throw new ValidationError('Номер должен содержать 11–12 цифр с кодом страны.');

    const raw = await this.http.request({
      httpMethod: 'POST',
      apiMethod: 'checkAccount',
      // По документации phoneNumber — число, а не строка.
      body: { phoneNumber: Number(phone) },
    });
    const parsed = checkAccountResponseSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError('Сервер вернул неожиданный ответ на проверку номера.');

    const data = parsed.data;
    if ('status' in data) {
      // Метод может ответить 200 с { status: false, reason } — это ошибка, а не «номер не найден».
      const reason = data.reason.toLowerCase();
      if (reason.includes('limit')) {
        throw new RateLimitError('MAX ограничил проверку номеров из-за частых запросов. Повторите позже.');
      }
      if (reason.includes('starting') || reason.includes('not authorized')) throw new InstanceNotReadyError();
      throw new ApiError(`Не удалось проверить номер: ${data.reason}`);
    }

    // Отправлять нужно по chatId из CheckAccount, а не по «номер@c.us»: иначе ответы и статусы
    // придут с другим chatId и не попадут в этот чат.
    return data.exist && data.chatId ? { exists: true, chatId: toChatId(data.chatId) } : { exists: false };
  }

  async sendText({ chatId, text }: { chatId: ChatId; text: string }): Promise<{ id: string }> {
    if (text.length > MAX_TEXT_LENGTH) throw new ValidationError(`Сообщение длиннее ${MAX_TEXT_LENGTH} символов.`);

    const raw = await this.http.request({
      httpMethod: 'POST',
      apiMethod: 'sendMessage',
      body: { chatId, message: text },
    });
    const parsed = sendMessageResponseSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError('Сервер не вернул идентификатор сообщения.');
    return { id: parsed.data.idMessage };
  }

  /**
   * Недавние чаты: входящие и исходящие за сутки по всем чатам аккаунта (два журнальных
   * метода, запросы параллельно — лимиты у методов раздельные) плюс контакты для имён.
   * GetChats не используется: он отдаёт все чаты аккаунта без имён, сообщений и порядка.
   */
  async loadRecent(signal?: AbortSignal): Promise<HistoryBatch> {
    const query = { minutes: RECENT_MINUTES };
    const [incoming, outgoing, contacts] = await Promise.all([
      this.requestList('GET', 'lastIncomingMessages', { query, signal }),
      this.requestList('GET', 'lastOutgoingMessages', { query, signal }),
      // Имена — приятное дополнение: если контакты не загрузились, список всё равно показываем.
      this.requestList('GET', 'getContacts', { signal }, contactsResponseSchema).catch((): unknown[] => []),
    ]);
    return buildHistoryBatch([...incoming, ...outgoing], contacts);
  }

  async loadChatHistory(chatId: ChatId, signal?: AbortSignal): Promise<HistoryBatch> {
    const items = await this.requestList('POST', 'getChatHistory', {
      body: { chatId, count: HISTORY_COUNT },
      signal,
    });
    return buildHistoryBatch(items);
  }

  /** Запрос метода, отвечающего массивом. Неожиданный ответ — пустой список, а не падение экрана. */
  private async requestList(
    httpMethod: 'GET' | 'POST',
    apiMethod: string,
    options: { query?: Record<string, number>; body?: unknown; signal?: AbortSignal },
    schema = journalResponseSchema,
  ): Promise<unknown[]> {
    const raw = await this.http.request({ httpMethod, apiMethod, ...options });
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : [];
  }
}

/** Фабрика с настройками по умолчанию: HTTP-клиент + long polling. */
export function createGreenApiGateway(credentials: Credentials, fetchFn?: FetchFn): GreenApiGateway {
  const http = new HttpClient(credentials, fetchFn);
  return new GreenApiGateway(http, new HttpPollingSource(http));
}
