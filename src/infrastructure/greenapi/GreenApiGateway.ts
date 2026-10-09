/**
 * Реализация MessengerGateway поверх GREEN-API для мессенджера MAX.
 *
 * Шлюз собирает вызовы методов API (GetStateInstance, CheckAccount, SendMessage) и
 * переводит уведомления источника в доменные события через `mappers.ts`. О токене и
 * формате URL он не знает — это забота HttpClient; о способе доставки уведомлений
 * тоже — это NotificationSource. Поэтому замена транспорта или вынос токена на сервер
 * не затрагивает этот класс.
 */
import { ApiError, InstanceNotReadyError, RateLimitError, ValidationError } from '@/domain/errors';
import { toChatId, type ChatId, type ConnectionState, type Credentials } from '@/domain/models';
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
import { mapConnectionState, mapNotification, mapSettingsWarnings } from './mappers';
import {
  checkAccountResponseSchema,
  sendMessageResponseSchema,
  settingsResponseSchema,
  stateInstanceResponseSchema,
} from './schemas';

/** Лимит длины текста SendMessage по документации. */
const MAX_TEXT_LENGTH = 4000;

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
          // В режиме разработки видно, что пришло из очереди и во что превратилось:
          // без этого «статус не обновился» невозможно отличить от «статус не пришёл».
          if (import.meta.env.DEV) console.info('[GREEN-API] уведомление', { raw, event });
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

  async checkSetup(signal?: AbortSignal): Promise<string[]> {
    const raw = await this.http.request({ httpMethod: 'GET', apiMethod: 'getSettings', signal });
    const parsed = settingsResponseSchema.safeParse(raw);
    // Неожиданный ответ — не повод пугать пользователя: просто нечего проверить.
    return parsed.success ? mapSettingsWarnings(parsed.data) : [];
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
}

/** Фабрика с настройками по умолчанию: HTTP-клиент + long polling. */
export function createGreenApiGateway(credentials: Credentials, fetchFn?: FetchFn): GreenApiGateway {
  const http = new HttpClient(credentials, fetchFn);
  return new GreenApiGateway(http, new HttpPollingSource(http));
}
