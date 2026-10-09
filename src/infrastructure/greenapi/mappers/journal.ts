/**
 * Журналы GREEN-API (LastIncomingMessages / LastOutgoingMessages / GetChatHistory) и
 * контакты → доменный снимок переписки. Как и маппер уведомлений, «прощающий»: битые
 * элементы пропускаются, а не роняют загрузку.
 */
import { toChatId, type ChatId, type ChatInfo, type HistoryBatch, type Message, type MessageStatus } from '@/domain/models';
import { contactSchema, journalMessageSchema, type Contact, type JournalMessage } from '../schemas';
import { isGroupChat, nonEmpty } from './common';
import { mapContent } from './content';

/** Типы журнала, которые не являются сообщениями ленты: реакция относится к другому сообщению. */
const NOT_A_MESSAGE = new Set(['reactionMessage']);

const JOURNAL_STATUSES: Partial<Record<string, MessageStatus>> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
};

/** Элемент журнала → сообщение ленты; `null` для битых элементов, реакций и удалённых. */
export function mapJournalMessage(raw: unknown): Message | null {
  const parsed = journalMessageSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;
  if (item.isDeleted || NOT_A_MESSAGE.has(item.typeMessage)) return null;

  const chatId = toChatId(item.chatId);
  const message: Message = {
    id: item.idMessage,
    chatId,
    direction: item.type,
    content: mapContent({ typeMessage: item.typeMessage, text: item.textMessage ?? item.extendedTextMessage?.text }),
    timestamp: item.timestamp * 1000,
  };

  if (item.type === 'outgoing') {
    // Пустой statusMessage встречается у только что отправленных: раз сообщение есть в журнале
    // отправленных, оно как минимум отправлено.
    message.status = JOURNAL_STATUSES[item.statusMessage ?? ''] ?? 'sent';
  } else if (isGroupChat(item.chatId)) {
    const author = nonEmpty(item.senderContactName) ?? nonEmpty(item.senderName);
    if (author) message.senderName = author;
  }
  return message;
}

/**
 * Сборка снимка из журналов и контактов. Чаты — все, в которых есть сообщения; имя берётся
 * из телефонной книги, затем из профиля контакта, затем из имени отправителя входящих.
 */
export function buildHistoryBatch(journal: readonly unknown[], contacts: readonly unknown[] = []): HistoryBatch {
  const messages = journal.map(mapJournalMessage).filter((m): m is Message => m !== null);

  const contactById = new Map<string, Contact>();
  for (const raw of contacts) {
    const parsed = contactSchema.safeParse(raw);
    if (parsed.success) contactById.set(parsed.data.chatId, parsed.data);
  }

  // Имена отправителей из входящих — запасной вариант, если контакта нет в книге.
  const senderNames = new Map<string, string>();
  for (const raw of journal) {
    const parsed = journalMessageSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item: JournalMessage = parsed.data;
    if (item.type !== 'incoming' || isGroupChat(item.chatId)) continue;
    const name = nonEmpty(item.senderContactName) ?? nonEmpty(item.senderName);
    if (name && !senderNames.has(item.chatId)) senderNames.set(item.chatId, name);
  }

  const chatIds = new Set<ChatId>(messages.map((m) => m.chatId));
  const chats: ChatInfo[] = [...chatIds].map((id) => {
    const contact = contactById.get(id);
    const chat: ChatInfo = { id };
    const title = nonEmpty(contact?.contactName) ?? nonEmpty(contact?.name) ?? senderNames.get(id);
    if (title) chat.title = title;
    if (contact?.phoneNumber) chat.phone = String(contact.phoneNumber);
    return chat;
  });

  return { chats, messages };
}
