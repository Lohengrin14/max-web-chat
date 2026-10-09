import { describe, expect, it } from 'vitest';
import {
  AccountRestrictedError,
  ApiError,
  AuthError,
  ConfigurationError,
  InstanceNotReadyError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from '@/domain/errors';
import { HttpClient, mapHttpError } from './HttpClient';

describe('mapHttpError', () => {
  it.each([
    [401, 'Unauthorized', AuthError],
    [403, 'Forbidden', AuthError],
    [403, 'Your account is suspended', AccountRestrictedError],
    [429, 'Too Many Requests', RateLimitError],
    [466, '', RateLimitError],
    [469, 'User get contact info limit reached', RateLimitError],
    [400, 'Message cannot be received because custom webhook url is set.', ConfigurationError],
    [400, 'instance is starting or not authorized', InstanceNotReadyError],
    [400, 'Instance account is expired. Renew your instance from personal area', AuthError],
    [400, 'Validation failed. Details: \'chatId\' is required', ValidationError],
    [502, 'Bad Gateway', ApiError],
    [408, 'Request Timeout', ApiError],
  ])('%i «%s» → %o', (status, body, ErrorClass) => {
    expect(mapHttpError(status, body)).toBeInstanceOf(ErrorClass);
  });
});

it('408 — временная ошибка с понятным текстом', () => {
  const error = mapHttpError(408, 'Request Timeout');
  expect(error.retryable).toBe(true);
  expect(error.message).toBe('Сервер не ответил вовремя. Попробуйте ещё раз.');
});

describe('HttpClient', () => {
  const credentials = { apiUrl: 'https://7103.api.green-api.com///', instanceId: '7103', apiToken: 'tok' };

  it('отправляет JSON и разбирает ответ', async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    const client = new HttpClient(credentials, async (url, init) => {
      captured = { url, init };
      return new Response('{"idMessage":"1"}');
    });

    const result = await client.request({ httpMethod: 'POST', apiMethod: 'sendMessage', body: { chatId: '1', message: 'hi' } });

    expect(result).toEqual({ idMessage: '1' });
    expect(captured?.url).toBe('https://7103.api.green-api.com/waInstance7103/sendMessage/tok');
    expect(captured?.init?.body).toBe('{"chatId":"1","message":"hi"}');
  });

  it('переводит сбой сети в NetworkError', async () => {
    const client = new HttpClient(credentials, () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(client.request({ httpMethod: 'GET', apiMethod: 'getStateInstance' })).rejects.toBeInstanceOf(NetworkError);
  });

  it('переводит таймаут в NetworkError', async () => {
    const client = new HttpClient(credentials, (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    );
    await expect(client.request({ httpMethod: 'GET', apiMethod: 'getStateInstance', timeoutMs: 10 })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});
