import { describe, expect, it, vi } from 'vitest';
import { mapConnectionState, mapNotification, mapSettingsWarnings } from './mappers';

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

  it('принимает числовые id и уведомления без timestamp, чтобы статус не терялся', () => {
    const { timestamp: _omit, ...withoutTimestamp } = statusBase;
    expect(mapNotification({ ...withoutTimestamp, chatId: 10000000, idMessage: '115054445839974415', status: 'read' })).toEqual({
      type: 'status',
      chatId: '10000000',
      messageId: '115054445839974415',
      status: 'read',
    });
    expect(mapNotification({ ...incomingText, idMessage: 42 })).toMatchObject({ message: { id: '42' } });
  });

  it('игнорирует неизвестные типы и битые уведомления, сообщая о битых в консоль', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(mapNotification({ typeWebhook: 'quotaExceeded', instanceData, timestamp: 1 })).toBeNull();
    expect(mapNotification({ ...statusBase, status: 'somethingNew' })).toBeNull();
    expect(warn).not.toHaveBeenCalled();

    expect(mapNotification({ ...incomingText, senderData: undefined })).toBeNull();
    expect(mapNotification({ ...incomingText, idMessage: { bad: true } })).toBeNull();
    expect(mapNotification({ ...statusBase, idMessage: '' })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
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

describe('mapSettingsWarnings', () => {
  const allOn = {
    webhookUrl: '',
    incomingWebhook: 'yes',
    outgoingWebhook: 'yes',
    outgoingAPIMessageWebhook: 'yes',
    outgoingMessageWebhook: 'yes',
  };

  it('нет предупреждений, когда всё включено', () => {
    expect(mapSettingsWarnings(allOn)).toEqual([]);
  });

  it('сообщает о выключенных уведомлениях о статусах одной строкой', () => {
    const warnings = mapSettingsWarnings({ ...allOn, outgoingAPIMessageWebhook: 'no', outgoingWebhook: 'no' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('«о сообщениях, отправленных через API»');
    expect(warnings[0]).toContain('«о статусах отправленных сообщений»');
    expect(warnings[0]).not.toContain('с телефона');
  });

  it('сообщает о webhookUrl и выключенных входящих', () => {
    const warnings = mapSettingsWarnings({ ...allOn, webhookUrl: 'https://example.com/hook', incomingWebhook: 'no' });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('webhookUrl');
    expect(warnings[1]).toContain('входящих');
  });

  it('не ругается на поля, которых нет в ответе', () => {
    expect(mapSettingsWarnings({})).toEqual([]);
  });
});
