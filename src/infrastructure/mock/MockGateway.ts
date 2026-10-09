/**
 * Демо-реализация MessengerGateway без сети.
 *
 * Нужна, чтобы интерфейс можно было посмотреть без аккаунта GREEN-API. Мок воспроизводит
 * поведение настоящего API, включая неприятные стороны: эхо отправленного сообщения,
 * статусы delivered/read с задержкой, ответ собеседника, входящее от нового контакта,
 * ошибку доставки. Поэтому через него проходят те же ветки кода, что и в боевом режиме.
 *
 * Правила демо:
 * - номер, оканчивающийся на 0000, считается незарегистрированным в MAX;
 * - сообщение со словом «ошибка» получает статус failed.
 */
import { toChatId, type ChatId, type ConnectionState, type HistoryBatch, type MessengerEvent } from '@/domain/models';
import type {
  ContactLookupResult,
  GatewayCapabilities,
  MessengerGateway,
  SubscriptionHandlers,
  Unsubscribe,
} from '@/domain/ports';
import { createSharedSubscription } from '../common/sharedSubscription';

const DEMO_NAMES = ['Анна Смирнова', 'Илья Петров', 'Мария Волкова', 'Дмитрий Орлов', 'Екатерина Лебедева'];
const WELCOME_CHAT_ID = toChatId('10000001');

export class MockGateway implements MessengerGateway {
  readonly capabilities: GatewayCapabilities = { maxTextLength: 4000 };
  readonly subscribe: (handlers: SubscriptionHandlers) => Unsubscribe;

  private emit: ((event: MessengerEvent) => void) | null = null;
  private welcomeSent = false;
  private messageCounter = 0;

  constructor(private readonly speed = 1) {
    this.subscribe = createSharedSubscription((broadcast) => {
      this.emit = broadcast.onEvent;
      const welcome = this.welcomeSent ? undefined : setTimeout(() => this.sendWelcome(), this.ms(1500));
      return () => {
        clearTimeout(welcome);
        this.emit = null;
      };
    });
  }

  async getConnectionState(): Promise<ConnectionState> {
    await delay(this.ms(400));
    return 'ready';
  }

  /** У мока нет сервера с историей: каждая демо-сессия начинается с чистого листа. */
  async loadRecent(): Promise<HistoryBatch> {
    await delay(this.ms(300));
    return { chats: [], messages: [] };
  }

  async loadChatHistory(): Promise<HistoryBatch> {
    await delay(this.ms(300));
    return { chats: [], messages: [] };
  }

  async findContactByPhone(phone: string): Promise<ContactLookupResult> {
    await delay(this.ms(500));
    if (phone.endsWith('0000')) return { exists: false };
    // Как и в MAX, chatId — числовая строка, не совпадающая с номером телефона.
    return { exists: true, chatId: toChatId(String(10_000_000 + (hash(phone) % 89_999_999))) };
  }

  async sendText({ chatId, text }: { chatId: ChatId; text: string }): Promise<{ id: string }> {
    await delay(this.ms(350));
    const id = `demo-${Date.now()}-${++this.messageCounter}`;
    const timestamp = Date.now();

    // Эхо сообщения, отправленного через API (аналог outgoingAPIMessageReceived).
    this.later(300, {
      type: 'message',
      chat: { id: chatId },
      message: { id, chatId, direction: 'outgoing', content: { kind: 'text', text }, timestamp, status: 'sent' },
    });

    if (/ошибк/i.test(text)) {
      this.later(900, { type: 'status', chatId, messageId: id, status: 'failed', error: 'Не удалось отправить сообщение (демо)' });
      return { id };
    }

    this.later(1200, { type: 'status', chatId, messageId: id, status: 'delivered' });
    this.later(2400, { type: 'status', chatId, messageId: id, status: 'read' });
    this.later(3500, {
      type: 'message',
      // Имя приходит только с ответом — так же, как chatName во входящем уведомлении.
      chat: { id: chatId, title: DEMO_NAMES[hash(chatId) % DEMO_NAMES.length] },
      message: {
        id: `demo-in-${Date.now()}-${++this.messageCounter}`,
        chatId,
        direction: 'incoming',
        content: { kind: 'text', text: replyTo(text) },
        timestamp: Date.now() + this.ms(3500),
      },
    });
    return { id };
  }

  private sendWelcome(): void {
    this.welcomeSent = true;
    this.emit?.({
      type: 'message',
      chat: { id: WELCOME_CHAT_ID, title: 'Поддержка (демо)', phone: '79990000001' },
      message: {
        id: 'demo-welcome',
        chatId: WELCOME_CHAT_ID,
        direction: 'incoming',
        content: {
          kind: 'text',
          text: 'Это демо-режим: сеть не используется. Создайте чат по любому номеру РФ или РБ и отправьте сообщение — собеседник ответит через пару секунд.',
        },
        timestamp: Date.now(),
      },
    });
  }

  /** События отправляются, только пока есть подписчики, — как и у настоящей очереди без клиента. */
  private later(ms: number, event: MessengerEvent): void {
    setTimeout(() => this.emit?.(event), this.ms(ms));
  }

  private ms(value: number): number {
    return value / this.speed;
  }
}

function replyTo(text: string): string {
  const trimmed = text.trim();
  if (/привет|здравств/i.test(trimmed)) return 'Привет! Рад слышать 👋';
  if (trimmed.endsWith('?')) return 'Хороший вопрос. Давай обсудим чуть позже?';
  const short = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  return `Получил: «${short}». Спасибо!`;
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
