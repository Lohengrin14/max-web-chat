/**
 * Перевод уведомлений GREEN-API в доменные события.
 *
 * Единственное место, где живут имена полей уведомлений (`typeWebhook`, `idMessage`,
 * `textMessageData`…). Если провайдер изменит формат, правится только этот файл и схемы.
 *
 * Маппер «прощающий»: неизвестный тип уведомления или битые данные дают `null`, а не
 * исключение. Такое уведомление источник просто подтвердит и пойдёт дальше — иначе одно
 * непонятное уведомление навсегда застряло бы в начале FIFO-очереди.
 */
import {
  toChatId,
  type ChatInfo,
  type ConnectionState,
  type MessageContent,
  type MessageStatus,
  type MessengerEvent,
  type UnsupportedContentKind,
} from '@/domain/models';
import {
  messageNotificationSchema,
  notificationHeaderSchema,
  stateNotificationSchema,
  statusNotificationSchema,
  type InstanceSettings,
  type MessageNotification,
  type StatusNotification,
} from './schemas';

export function mapNotification(body: unknown): MessengerEvent | null {
  const header = notificationHeaderSchema.safeParse(body);
  if (!header.success) return null;

  switch (header.data.typeWebhook) {
    case 'incomingMessageReceived':
    case 'outgoingMessageReceived':
    case 'outgoingAPIMessageReceived': {
      const parsed = messageNotificationSchema.safeParse(body);
      if (!parsed.success) return rejected(body, parsed.error.issues);
      return mapMessage(parsed.data);
    }
    case 'outgoingMessageStatus': {
      const parsed = statusNotificationSchema.safeParse(body);
      if (!parsed.success) return rejected(body, parsed.error.issues);
      return mapStatus(parsed.data);
    }
    case 'stateInstanceChanged': {
      const parsed = stateNotificationSchema.safeParse(body);
      if (!parsed.success) return rejected(body, parsed.error.issues);
      return { type: 'connection', state: mapConnectionState(parsed.data.stateInstance) };
    }
    default:
      // quotaExceeded и будущие типы нам не нужны — их подтвердят удалением.
      return null;
  }
}

/**
 * Нужный нам тип уведомления не прошёл схему. Очередь из-за этого не останавливаем, но и
 * молча не теряем: иначе, например, статус «доставлено» исчезал бы без следа, а сообщение
 * навсегда оставалось бы на часах.
 */
function rejected(body: unknown, issues: unknown): null {
  console.warn('[GREEN-API] Уведомление не прошло проверку формата и пропущено', { issues, body });
  return null;
}

/**
 * Проверка настроек инстанса (GetSettings). Возвращает понятные предупреждения о том,
 * без чего чат работает неполноценно. Для статусов документация MAX требует включить
 * сразу три настройки: outgoingWebhook, outgoingAPIMessageWebhook и outgoingMessageWebhook.
 */
export function mapSettingsWarnings(settings: InstanceSettings): string[] {
  const warnings: string[] = [];
  if (settings.webhookUrl?.trim()) {
    warnings.push('У инстанса задан webhookUrl — через HTTP API уведомления не приходят. Очистите поле в личном кабинете GREEN-API.');
  }
  const off = (value: string | undefined) => value !== undefined && value !== 'yes';
  if (off(settings.incomingWebhook)) {
    warnings.push('Выключены уведомления о входящих сообщениях — ответы не будут появляться в чате.');
  }
  const statusSettings: [keyof InstanceSettings, string][] = [
    ['outgoingAPIMessageWebhook', '«о сообщениях, отправленных через API»'],
    ['outgoingWebhook', '«о статусах отправленных сообщений»'],
    ['outgoingMessageWebhook', '«о сообщениях, отправленных с телефона»'],
  ];
  const disabled = statusSettings.filter(([key]) => off(settings[key])).map(([, label]) => label);
  if (disabled.length > 0) {
    warnings.push(
      `Выключены уведомления ${disabled.join(', ')} — статусы «отправлено», «доставлено» и «прочитано» не будут обновляться. Включите их в настройках инстанса в личном кабинете GREEN-API.`,
    );
  }
  return warnings;
}

/** Состояния GetStateInstance / stateInstanceChanged → доменное состояние подключения. */
export function mapConnectionState(stateInstance: string): ConnectionState {
  switch (stateInstance) {
    case 'authorized':
      return 'ready';
    case 'starting':
      return 'starting';
    case 'notAuthorized':
    // pendingPassword: аккаунт ждёт ввода пароля — для пользователя это тоже «не авторизован».
    case 'pendingPassword':
      return 'notAuthorized';
    case 'blocked':
      return 'blocked';
    case 'suspended':
      return 'restricted';
    default:
      return 'unknown';
  }
}

function isGroupChat(chatId: string): boolean {
  // В MAX id групповых чатов отрицательные: "-10000000000000".
  return chatId.startsWith('-');
}

function mapMessage(n: MessageNotification): MessengerEvent {
  const { senderData } = n;
  const chatId = toChatId(senderData.chatId);
  const group = isGroupChat(senderData.chatId);
  const incoming = n.typeWebhook === 'incomingMessageReceived';

  const chat: ChatInfo = { id: chatId };
  if (incoming) {
    // Имя берём только из входящих: в эхе исходящих senderData описывает нас, а не собеседника.
    const title = nonEmpty(senderData.chatName) ?? (group ? undefined : nonEmpty(senderData.senderContactName) ?? nonEmpty(senderData.senderName));
    if (title) chat.title = title;
    if (!group && senderData.senderPhoneNumber) chat.phone = String(senderData.senderPhoneNumber);
  }

  return {
    type: 'message',
    chat,
    message: {
      id: n.idMessage,
      chatId,
      direction: incoming ? 'incoming' : 'outgoing',
      content: mapContent(n.messageData),
      timestamp: n.timestamp !== undefined ? n.timestamp * 1000 : Date.now(),
      // Эхо исходящего — подтверждение, что сообщение ушло с аккаунта.
      ...(incoming ? {} : { status: 'sent' as const }),
      ...(incoming && group ? { senderName: nonEmpty(senderData.senderContactName) ?? nonEmpty(senderData.senderName) } : {}),
    },
  };
}

function mapContent(data: MessageNotification['messageData']): MessageContent {
  // extendedTextMessage — текст со ссылкой; у цитат в MAX тоже textMessage/extendedText.
  const text = data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text;
  if (text !== undefined) return { kind: 'text', text };
  return { kind: 'unsupported', contentKind: UNSUPPORTED_KINDS[data.typeMessage] ?? 'other' };
}

const UNSUPPORTED_KINDS: Partial<Record<string, UnsupportedContentKind>> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  locationMessage: 'location',
  contactMessage: 'contact',
  reactionMessage: 'reaction',
};

const STATUS_ERRORS: Partial<Record<string, string>> = {
  failed: 'Не удалось отправить сообщение',
  noAccount: 'На этом номере не зарегистрирован MAX',
  notInGroup: 'Вы не участник этой группы',
};

function mapStatus(n: StatusNotification): MessengerEvent | null {
  let status: MessageStatus;
  switch (n.status) {
    case 'sent':
      status = 'sent';
      break;
    case 'delivered':
      status = 'delivered';
      break;
    case 'read':
      status = 'read';
      break;
    case 'failed':
    case 'noAccount':
    case 'notInGroup':
      status = 'failed';
      break;
    default:
      return null;
  }

  const event: Extract<MessengerEvent, { type: 'status' }> = { type: 'status', chatId: toChatId(n.chatId), messageId: n.idMessage, status };
  if (status === 'failed') {
    const base = STATUS_ERRORS[n.status] ?? 'Не удалось отправить сообщение';
    const details = nonEmpty(n.description);
    event.error = details && n.status === 'failed' ? `${base}: ${details}` : base;
  }
  return event;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
