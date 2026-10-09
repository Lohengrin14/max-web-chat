/**
 * zod-схемы ответов GREEN-API (мессенджер MAX, v3).
 *
 * Данные из сети проверяются на границе системы: всё, что прошло схему, дальше считается
 * типобезопасным. Схемы описывают только поля, которые мы используем, — остальные
 * игнорируются, чтобы появление новых полей в API ничего не ломало.
 * Документация: https://green-api.com/v3/docs/api/
 */
import { z } from 'zod';

/** GetStateInstance → `{ stateInstance }`. */
export const stateInstanceResponseSchema = z.object({
  stateInstance: z.string(),
});

/** SendMessage → `{ idMessage }`. */
export const sendMessageResponseSchema = z.object({
  idMessage: z.string().min(1),
});

/**
 * CheckAccount. Помимо `{ exist, chatId }` метод может ответить кодом 200 с
 * `{ status: false, reason }` — когда инстанс не авторизован или исчерпан лимит проверок.
 */
export const checkAccountResponseSchema = z.union([
  z.object({
    exist: z.boolean(),
    chatId: z.string().optional(),
  }),
  z.object({
    status: z.literal(false),
    reason: z.string(),
  }),
]);

/** ReceiveNotification → `{ receiptId, body }` или пустой ответ/`null` при таймауте long polling. */
export const receiveNotificationResponseSchema = z
  .object({
    receiptId: z.number().int(),
    body: z.unknown(),
  })
  .nullable();

/** Общая «шапка» любого уведомления — по ней выбирается конкретная схема. */
export const notificationHeaderSchema = z.object({
  typeWebhook: z.string(),
});

const senderDataSchema = z.object({
  chatId: z.string().min(1),
  sender: z.string().optional(),
  chatName: z.string().optional(),
  senderName: z.string().optional(),
  senderContactName: z.string().optional(),
  /** Число; 0, если номер скрыт или чат групповой. */
  senderPhoneNumber: z.number().optional(),
});

const messageDataSchema = z.object({
  typeMessage: z.string(),
  textMessageData: z.object({ textMessage: z.string() }).optional(),
  extendedTextMessageData: z.object({ text: z.string() }).optional(),
});

/** incomingMessageReceived / outgoingMessageReceived / outgoingAPIMessageReceived. */
export const messageNotificationSchema = z.object({
  typeWebhook: z.enum(['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived']),
  timestamp: z.number(),
  idMessage: z.string().min(1),
  senderData: senderDataSchema,
  messageData: messageDataSchema,
});

/** outgoingMessageStatus. */
export const statusNotificationSchema = z.object({
  typeWebhook: z.literal('outgoingMessageStatus'),
  chatId: z.string().min(1),
  timestamp: z.number(),
  idMessage: z.string().min(1),
  status: z.string(),
  description: z.string().optional(),
});

/** stateInstanceChanged. */
export const stateNotificationSchema = z.object({
  typeWebhook: z.literal('stateInstanceChanged'),
  stateInstance: z.string(),
});

export type MessageNotification = z.infer<typeof messageNotificationSchema>;
export type StatusNotification = z.infer<typeof statusNotificationSchema>;

/**
 * Элемент журнала сообщений: LastIncomingMessages, LastOutgoingMessages, GetChatHistory.
 * Формат отличается от уведомлений: поля сообщения лежат «плоско» (`textMessage`,
 * `statusMessage`), а не в `messageData`/`senderData`.
 */
export const journalMessageSchema = z.object({
  type: z.enum(['incoming', 'outgoing']),
  idMessage: z.string().min(1),
  timestamp: z.number(),
  typeMessage: z.string(),
  chatId: z.string().min(1),
  textMessage: z.string().optional(),
  extendedTextMessage: z.object({ text: z.string() }).optional(),
  /** Только у исходящих: sent / delivered / read (иногда пустая строка). */
  statusMessage: z.string().optional(),
  senderName: z.string().optional(),
  senderContactName: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

/**
 * Ответ журнальных методов — массив. Элементы проверяются по одному в маппере, чтобы один
 * непонятный элемент не лишал пользователя всей истории.
 */
export const journalResponseSchema = z.array(z.unknown());

/** GetContacts → массив контактов; нужен только для имён чатов. */
export const contactSchema = z.object({
  chatId: z.string().min(1),
  name: z.string().optional(),
  contactName: z.string().optional(),
  phoneNumber: z.number().optional(),
});

export const contactsResponseSchema = z.array(z.unknown());

export type JournalMessage = z.infer<typeof journalMessageSchema>;
export type Contact = z.infer<typeof contactSchema>;
