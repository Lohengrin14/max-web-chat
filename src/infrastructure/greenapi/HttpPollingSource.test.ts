import { describe, expect, it, vi } from 'vitest';
import { AuthError, ConfigurationError, NetworkError } from '@/domain/errors';
import { HttpClient, type FetchFn } from '../http/HttpClient';
import { HttpPollingSource } from './HttpPollingSource';

const credentials = { apiUrl: 'https://1103.api.green-api.com/', instanceId: '1103000001', apiToken: 'secret-token' };

type Reply = { status?: number; body?: unknown } | Error;

/**
 * Мок fetch: отдаёт заранее заданные ответы по очереди и записывает вызовы.
 * Когда ответы кончились — «висит» как long poll, пока запрос не отменят.
 */
function scriptedFetch(replies: Reply[]) {
  const calls: { method: string; url: string }[] = [];
  const fetchFn: FetchFn = (url, init) => {
    calls.push({ method: init?.method ?? 'GET', url });
    const reply = replies.shift();
    if (!reply) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }
    if (reply instanceof Error) return Promise.reject(reply);
    const text = reply.body === undefined ? '' : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return Promise.resolve(new Response(text, { status: reply.status ?? 200 }));
  };
  return { fetchFn, calls };
}

function createSource(replies: Reply[]) {
  const { fetchFn, calls } = scriptedFetch(replies);
  const sleep = vi.fn((_ms: number, _signal: AbortSignal) => Promise.resolve());
  const source = new HttpPollingSource(new HttpClient(credentials, fetchFn), { sleep });
  return { source, calls, sleep };
}

const notification = (receiptId: number) => ({ receiptId, body: { typeWebhook: 'incomingMessageReceived', n: receiptId } });

describe('HttpPollingSource', () => {
  it('вызывает receive → обработчик → delete и собирает URL с токеном и таймаутом', async () => {
    const { source, calls } = createSource([{ body: notification(1) }, { body: { result: true } }]);
    const onRaw = vi.fn();
    const stop = source.start({ onRaw, onFatal: vi.fn() });

    await vi.waitFor(() => expect(calls).toHaveLength(3));
    stop();

    expect(onRaw).toHaveBeenCalledWith({ typeWebhook: 'incomingMessageReceived', n: 1 });
    expect(calls[0]).toEqual({
      method: 'GET',
      url: 'https://1103.api.green-api.com/waInstance1103000001/receiveNotification/secret-token?receiveTimeout=20',
    });
    expect(calls[1]).toEqual({
      method: 'DELETE',
      url: 'https://1103.api.green-api.com/waInstance1103000001/deleteNotification/secret-token/1',
    });
    expect(calls[2]?.method).toBe('GET');
  });

  it('пустой ответ (таймаут long poll) не ломает цикл и ничего не удаляет', async () => {
    const { source, calls } = createSource([{ body: '' }, { body: 'null' }, { body: notification(7) }, { body: { result: true } }]);
    const onRaw = vi.fn();
    const stop = source.start({ onRaw, onFatal: vi.fn() });

    await vi.waitFor(() => expect(calls).toHaveLength(5));
    stop();

    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'GET', 'DELETE', 'GET']);
    expect(onRaw).toHaveBeenCalledTimes(1);
  });

  it('удаляет уведомление, даже если обработчик упал', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { source, calls } = createSource([{ body: notification(2) }, { body: { result: true } }]);
    const stop = source.start({
      onRaw: () => {
        throw new Error('bug');
      },
      onFatal: vi.fn(),
    });

    await vi.waitFor(() => expect(calls).toHaveLength(3));
    stop();
    expect(calls[1]?.url).toContain('/deleteNotification/secret-token/2');
  });

  it('останавливается на 401 и сообщает фатальную ошибку', async () => {
    const { source, calls } = createSource([{ status: 401, body: 'Unauthorized' }]);
    const onFatal = vi.fn();
    source.start({ onRaw: vi.fn(), onFatal });

    await vi.waitFor(() => expect(onFatal).toHaveBeenCalledOnce());
    expect(onFatal.mock.calls[0]?.[0]).toBeInstanceOf(AuthError);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(1);
  });

  it('останавливается, если у инстанса задан webhookUrl', async () => {
    const { source } = createSource([
      { status: 400, body: 'Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url' },
    ]);
    const onFatal = vi.fn();
    source.start({ onRaw: vi.fn(), onFatal });

    await vi.waitFor(() => expect(onFatal).toHaveBeenCalledOnce());
    expect(onFatal.mock.calls[0]?.[0]).toBeInstanceOf(ConfigurationError);
  });

  it('после сетевой ошибки ждёт с растущей паузой и повторяет', async () => {
    const { source, calls, sleep } = createSource([
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
      { status: 502, body: 'Bad Gateway' },
      { body: notification(3) },
      { body: { result: true } },
    ]);
    const onRaw = vi.fn();
    const onIssue = vi.fn();
    const stop = source.start({ onRaw, onFatal: vi.fn(), onIssue });

    await vi.waitFor(() => expect(onRaw).toHaveBeenCalledOnce());

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
    expect(onIssue.mock.calls[0]?.[0]).toBeInstanceOf(NetworkError);
    // После успешного запроса проблема снимается.
    expect(onIssue).toHaveBeenLastCalledWith(null);
    await vi.waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(5));
    expect(calls.slice(0, 5).map((c) => c.method)).toEqual(['GET', 'GET', 'GET', 'GET', 'DELETE']);
    stop();
  });

  it('пауза ограничена 30 секундами', async () => {
    const replies: Reply[] = Array.from({ length: 8 }, () => new TypeError('Failed to fetch'));
    const { source, sleep } = createSource(replies);
    const stop = source.start({ onRaw: vi.fn(), onFatal: vi.fn() });

    await vi.waitFor(() => expect(sleep).toHaveBeenCalledTimes(8));
    stop();
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('остановка обрывает висящий long poll, и повторный запуск даёт один цикл', async () => {
    const { source, calls } = createSource([]);
    const onRaw = vi.fn();
    const onFatal = vi.fn();

    // Как StrictMode: запуск → остановка → запуск.
    const stopFirst = source.start({ onRaw, onFatal });
    stopFirst();
    const stopSecond = source.start({ onRaw, onFatal });

    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(2);
    stopSecond();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(2);
    expect(onFatal).not.toHaveBeenCalled();
  });
});
