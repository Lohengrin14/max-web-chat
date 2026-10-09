import { describe, expect, it } from 'vitest';
import { buildHistoryBatch, mapJournalMessage } from './journal';

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
