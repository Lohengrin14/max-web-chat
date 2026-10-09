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

/**
 * GetSettings — только поля, нужные для проверки, что инстанс отдаёт уведомления,
 * без которых чат не работает. Значения настроек — строки "yes" / "no".
 */
export const settingsResponseSchema = z.object({
  webhookUrl: z.string().optional(),
  incomingWebhook: z.string().optional(),
  outgoingWebhook: z.string().optional(),
  outgoingAPIMessageWebhook: z.string().optional(),
  outgoingMessageWebhook: z.string().optional(),
});

export type InstanceSettings = z.infer<typeof settingsResponseSchema>;

/**
 * Идентификаторы в документации — строки, но принимаем и числа: если провайдер где-то
 * отдаст число, уведомление не должно молча теряться (статус так и не дошёл бы до сообщения).
 */
const idSchema = z.union([z.string().min(1), z.number()]).transform(String);

/** Общая «шапка» любого уведомления — по ней выбирается конкретная схема. */
export const notificationHeaderSchema = z.object({
  typeWebhook: z.string(),
});

const senderDataSchema = z.object({
  chatId: idSchema,
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
  timestamp: z.number().optional(),
  idMessage: idSchema,
  senderData: senderDataSchema,
  messageData: messageDataSchema,
});

/** outgoingMessageStatus. */
export const statusNotificationSchema = z.object({
  typeWebhook: z.literal('outgoingMessageStatus'),
  chatId: idSchema,
  timestamp: z.number().optional(),
  idMessage: idSchema,
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
