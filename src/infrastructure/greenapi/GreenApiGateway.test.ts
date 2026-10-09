import { describe, expect, it } from 'vitest';
import { toChatId } from '@/domain/models';
import { NetworkError } from '@/domain/errors';
import type { HttpRequest } from '../http/HttpClient';
import { GreenApiGateway } from './GreenApiGateway';

const noSource = { start: () => () => undefined };

function gatewayWith(handler: (req: HttpRequest) => unknown) {
  const calls: HttpRequest[] = [];
  const http = {
    request: async (req: HttpRequest) => {
      calls.push(req);
      return handler(req);
    },
  };
  return { gateway: new GreenApiGateway(http, noSource), calls };
}

const incoming = { type: 'incoming', idMessage: 'in', timestamp: 2, typeMessage: 'textMessage', chatId: '10000000', textMessage: 'Привет', senderName: 'Анна' };
const outgoing = { type: 'outgoing', idMessage: 'out', timestamp: 1, typeMessage: 'textMessage', chatId: '10000000', textMessage: 'Здравствуйте', statusMessage: 'read' };

describe('GreenApiGateway: история', () => {
  it('loadRecent объединяет входящие и исходящие за сутки и берёт имена из контактов', async () => {
    const { gateway, calls } = gatewayWith((req) => {
      if (req.apiMethod === 'lastIncomingMessages') return [incoming];
      if (req.apiMethod === 'lastOutgoingMessages') return [outgoing];
      if (req.apiMethod === 'getContacts') return [{ chatId: '10000000', contactName: 'Анна Смирнова', phoneNumber: 79991234567 }];
      throw new Error('unexpected');
    });

    const batch = await gateway.loadRecent();

    expect(calls.map((c) => [c.apiMethod, c.query])).toEqual([
      ['lastIncomingMessages', { minutes: 1440 }],
      ['lastOutgoingMessages', { minutes: 1440 }],
      ['getContacts', undefined],
    ]);
    expect(batch.chats).toEqual([{ id: '10000000', title: 'Анна Смирнова', phone: '79991234567' }]);
    expect(batch.messages.map((m) => [m.id, m.status])).toEqual([
      ['in', undefined],
      ['out', 'read'],
    ]);
  });

  it('если контакты не загрузились, список всё равно строится', async () => {
    const { gateway } = gatewayWith((req) => {
      if (req.apiMethod === 'getContacts') throw new NetworkError();
      return req.apiMethod === 'lastIncomingMessages' ? [incoming] : [];
    });
    const batch = await gateway.loadRecent();
    expect(batch.chats).toEqual([{ id: '10000000', title: 'Анна' }]);
  });

  it('ошибка журнала пробрасывается — экран покажет «Повторить»', async () => {
    const { gateway } = gatewayWith(() => {
      throw new NetworkError();
    });
    await expect(gateway.loadRecent()).rejects.toBeInstanceOf(NetworkError);
  });

  it('loadChatHistory запрашивает getChatHistory по chatId', async () => {
    const { gateway, calls } = gatewayWith(() => [outgoing, incoming]);
    const batch = await gateway.loadChatHistory(toChatId('10000000'));
    expect(calls[0]).toMatchObject({ httpMethod: 'POST', apiMethod: 'getChatHistory', body: { chatId: '10000000', count: 100 } });
    expect(batch.messages).toHaveLength(2);
  });

  it('неожиданный ответ журнала — пустой список, а не падение', async () => {
    const { gateway } = gatewayWith(() => ({ not: 'an array' }));
    expect(await gateway.loadChatHistory(toChatId('1'))).toEqual({ chats: [], messages: [] });
  });
});
