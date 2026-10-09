import { describe, expect, it } from 'vitest';
import { buildHistoryBatch, mapConnectionState, mapJournalMessage, mapNotification } from './mappers';

// Примеры уведомлений — из документации GREEN-API v3 (MAX).
const instanceData = { idInstance: 3100000000, wid: '79991234567@c.us', typeInstance: 'v3' };

const incomingText = {
  typeWebhook: 'incomingMessageReceived',
  instanceData,
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    sender: '10000000',
    chatName: 'Ходабрыш Пробешёлов',
    senderName: 'Ходабрыш Пробешёлов',
    senderContactName: 'Ходабрыш Пробешёлов',
    senderPhoneNumber: 79876543210,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Я использую GREEN-API для отправки этого сообщения!' },
  },
};

describe('mapNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(mapNotification(incomingText)).toEqual({
      type: 'message',
      chat: { id: '10000000', title: 'Ходабрыш Пробешёлов', phone: '79876543210' },
      message: {
        id: '1763115112345',
        chatId: '10000000',
        direction: 'incoming',
        content: { kind: 'text', text: 'Я использую GREEN-API для отправки этого сообщения!' },
        timestamp: 1763115112000,
      },
    });
  });

  it('разбирает extendedTextMessage (текст со ссылкой)', () => {
    const event = mapNotification({
      ...incomingText,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: {
          text: 'Документация на сайте https://green-api.com/',
          description: '',
          title: 'Сервис GREEN-API',
          forwardingScore: 0,
          isForwarded: false,
        },
      },
    });
    expect(event?.type === 'message' && event.message.content).toEqual({
      kind: 'text',
      text: 'Документация на сайте https://green-api.com/',
    });
  });

  it('помечает неподдерживаемые типы заглушкой', () => {
    const sticker = mapNotification({ ...incomingText, messageData: { typeMessage: 'stickerMessage' } });
    expect(sticker?.type === 'message' && sticker.message.content).toEqual({ kind: 'unsupported', contentKind: 'sticker' });

    const unknown = mapNotification({ ...incomingText, messageData: { typeMessage: 'pollMessage' } });
    expect(unknown?.type === 'message' && unknown.message.content).toEqual({ kind: 'unsupported', contentKind: 'other' });
  });

  it('в групповом чате берёт имя группы и автора сообщения, но не номер', () => {
    const event = mapNotification({
      ...incomingText,
      senderData: {
        chatId: '-69876543210123',
        sender: '10000000',
        chatName: 'Название группы',
        senderName: 'Ходабрыш',
        senderContactName: '',
        senderPhoneNumber: 0,
      },
    });
    expect(event).toMatchObject({
      chat: { id: '-69876543210123', title: 'Название группы' },
      message: { senderName: 'Ходабрыш' },
    });
    expect(event?.type === 'message' && event.chat.phone).toBeUndefined();
  });

  it('эхо outgoingAPIMessageReceived — исходящее со статусом sent, без имени чата', () => {
    const event = mapNotification({ ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' });
    expect(event).toMatchObject({
      type: 'message',
      chat: { id: '10000000' },
      message: { id: '1763115112345', direction: 'outgoing', status: 'sent' },
    });
    expect(event?.type === 'message' && event.chat.title).toBeUndefined();
  });

  it('сообщение, отправленное с телефона, тоже становится исходящим', () => {
    const event = mapNotification({ ...incomingText, typeWebhook: 'outgoingMessageReceived' });
    expect(event).toMatchObject({ message: { direction: 'outgoing', status: 'sent' } });
  });

  const statusBase = {
    typeWebhook: 'outgoingMessageStatus',
    chatId: '10000000',
    instanceData,
    timestamp: 1755591519,
    idMessage: '115054445839974415',
  };

  it.each(['delivered', 'read'] as const)('разбирает статус %s', (status) => {
    expect(mapNotification({ ...statusBase, status })).toEqual({
      type: 'status',
      chatId: '10000000',
      messageId: '115054445839974415',
      status,
    });
  });

  it('noAccount превращается в failed с понятной причиной', () => {
    expect(mapNotification({ ...statusBase, status: 'noAccount' })).toEqual({
      type: 'status',
      chatId: '10000000',
      messageId: '115054445839974415',
      status: 'failed',
      error: 'На этом номере не зарегистрирован MAX',
    });
  });

  it('failed дополняется описанием из description', () => {
    const event = mapNotification({ ...statusBase, status: 'failed', description: 'service chat' });
    expect(event).toMatchObject({ status: 'failed', error: 'Не удалось отправить сообщение: service chat' });
  });

  it('разбирает stateInstanceChanged', () => {
    expect(
      mapNotification({ typeWebhook: 'stateInstanceChanged', instanceData, timestamp: 1755589527, stateInstance: 'notAuthorized' }),
    ).toEqual({ type: 'connection', state: 'notAuthorized' });
  });

  it('игнорирует неизвестные типы и битые уведомления', () => {
    expect(mapNotification({ typeWebhook: 'quotaExceeded', instanceData, timestamp: 1 })).toBeNull();
    expect(mapNotification({ ...statusBase, status: 'somethingNew' })).toBeNull();
    expect(mapNotification({ ...incomingText, senderData: undefined })).toBeNull();
    expect(mapNotification({ ...incomingText, idMessage: 42 })).toBeNull();
    expect(mapNotification(null)).toBeNull();
    expect(mapNotification('garbage')).toBeNull();
  });
});

describe('mapConnectionState', () => {
  it('переводит состояния инстанса в доменные', () => {
    expect(mapConnectionState('authorized')).toBe('ready');
    expect(mapConnectionState('notAuthorized')).toBe('notAuthorized');
    expect(mapConnectionState('pendingPassword')).toBe('notAuthorized');
    expect(mapConnectionState('blocked')).toBe('blocked');
    expect(mapConnectionState('starting')).toBe('starting');
    expect(mapConnectionState('suspended')).toBe('restricted');
    expect(mapConnectionState('whatever')).toBe('unknown');
  });
});

// Примеры элементов журнала — из документации GetChatHistory / LastOutgoingMessages (MAX v3).
const journalOutgoing = {
  type: 'outgoing',
  idMessage: '1763115112345',
  timestamp: 1754999812,
  typeMessage: 'extendedTextMessage',
  chatId: '10000000',
  textMessage: 'Я использую GREEN-API для отправки этого сообщения!',
  extendedTextMessage: { text: 'Я использую GREEN-API для отправки этого сообщения!', description: '', title: '' },
  statusMessage: '',
  sendByApi: true,
};

const journalIncoming = {
  type: 'incoming',
  idMessage: '1763115112346',
  timestamp: 1754986980,
  typeMessage: 'textMessage',
  chatId: '10000000',
  textMessage: 'Привет',
  senderId: '10000000',
  senderName: 'Ходабрыш',
  senderContactName: 'Ходабрыш Пробешёлов',
};

describe('mapJournalMessage', () => {
  it('разбирает исходящее; пустой statusMessage считается «отправлено»', () => {
    expect(mapJournalMessage(journalOutgoing)).toEqual({
      id: '1763115112345',
      chatId: '10000000',
      direction: 'outgoing',
      content: { kind: 'text', text: 'Я использую GREEN-API для отправки этого сообщения!' },
      timestamp: 1754999812000,
      status: 'sent',
    });
  });

  it.each(['delivered', 'read'] as const)('переносит статус %s', (statusMessage) => {
    expect(mapJournalMessage({ ...journalOutgoing, statusMessage })?.status).toBe(statusMessage);
  });

  it('разбирает входящее без статуса', () => {
    expect(mapJournalMessage(journalIncoming)).toEqual({
      id: '1763115112346',
      chatId: '10000000',
      direction: 'incoming',
      content: { kind: 'text', text: 'Привет' },
      timestamp: 1754986980000,
    });
  });

  it('в группе запоминает автора входящего', () => {
    expect(mapJournalMessage({ ...journalIncoming, chatId: '-69876543210123' })?.senderName).toBe('Ходабрыш Пробешёлов');
  });

  it('медиа — заглушка; реакции, удалённые и битые элементы пропускаются', () => {
    expect(mapJournalMessage({ ...journalIncoming, typeMessage: 'stickerMessage', textMessage: undefined })?.content).toEqual({
      kind: 'unsupported',
      contentKind: 'sticker',
    });
    expect(mapJournalMessage({ ...journalIncoming, typeMessage: 'reactionMessage' })).toBeNull();
    expect(mapJournalMessage({ ...journalIncoming, isDeleted: true })).toBeNull();
    expect(mapJournalMessage({ ...journalIncoming, idMessage: undefined })).toBeNull();
    expect(mapJournalMessage('garbage')).toBeNull();
  });
});

describe('buildHistoryBatch', () => {
  it('собирает чаты из сообщений; имя — из контактов, иначе из входящих', () => {
    const batch = buildHistoryBatch(
      [journalOutgoing, journalIncoming, { ...journalIncoming, idMessage: 'x', chatId: '20000000', senderContactName: '', senderName: 'Анна' }],
      [{ chatId: '10000000', name: 'Профиль', contactName: 'Из книги', type: 'user', phoneNumber: 79876543210 }, 'garbage'],
    );
    expect(batch.messages).toHaveLength(3);
    expect(batch.chats).toEqual([
      { id: '10000000', title: 'Из книги', phone: '79876543210' },
      { id: '20000000', title: 'Анна' },
    ]);
  });

  it('пустой журнал — пустой снимок', () => {
    expect(buildHistoryBatch([])).toEqual({ chats: [], messages: [] });
  });
});
