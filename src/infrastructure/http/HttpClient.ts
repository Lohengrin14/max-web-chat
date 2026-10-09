/**
 * HTTP-клиент для API в стиле GREEN-API: `{apiUrl}/waInstance{id}/{method}/{token}`.
 *
 * Отвечает за три вещи и только за них:
 * 1. Сборка URL. Токен подставляется только здесь, поэтому остальной код его не видит
 *    и не может случайно залогировать. При переносе токена на свой бэкенд-прокси
 *    меняется только этот класс.
 * 2. Перевод HTTP-кодов и сетевых сбоев в доменные ошибки (`domain/errors.ts`).
 * 3. Отмена и таймауты через AbortSignal.
 *
 * `fetch` передаётся в конструктор, чтобы в тестах его можно было подменить.
 */
import {
  AccountRestrictedError,
  ApiError,
  AuthError,
  ConfigurationError,
  InstanceNotReadyError,
  NetworkError,
  RateLimitError,
  ValidationError,
  type MessengerError,
} from '@/domain/errors';
import type { Credentials } from '@/domain/models';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpRequest {
  httpMethod: 'GET' | 'POST' | 'DELETE';
  /** Имя метода API, например `sendMessage`. */
  apiMethod: string;
  /** Дополнительные сегменты пути после токена (например, receiptId). */
  pathSuffix?: readonly (string | number)[];
  query?: Readonly<Record<string, string | number>>;
  body?: unknown;
  signal?: AbortSignal;
  /** Таймаут запроса; по истечении бросается NetworkError. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class HttpClient {
  private readonly baseUrl: string;

  constructor(
    private readonly credentials: Credentials,
    private readonly fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init),
  ) {
    // apiUrl у каждого инстанса свой (например, https://1103.api.green-api.com) — не хардкодим.
    this.baseUrl = credentials.apiUrl.trim().replace(/\/+$/, '');
  }

  /**
   * Выполняет запрос и возвращает разобранный JSON (или `null` для пустого тела).
   * Проверку формы ответа делает вызывающий код через zod-схемы.
   */
  async request(req: HttpRequest): Promise<unknown> {
    const url = this.buildUrl(req);
    const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { signal, isTimedOut, dispose } = withTimeout(req.signal, timeoutMs);

    let response: Response;
    let text: string;
    try {
      response = await this.fetchFn(url, {
        method: req.httpMethod,
        headers: req.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal,
      });
      text = await response.text();
    } catch (error) {
      // Отмена вызывающим кодом — штатная ситуация, пробрасываем как есть.
      if (req.signal?.aborted) throw req.signal.reason ?? error;
      if (isTimedOut()) throw new NetworkError('Сервер не ответил вовремя.', { cause: error });
      // fetch бросает TypeError и при обрыве сети, и при блокировке CORS — различить их нельзя.
      throw new NetworkError(undefined, { cause: error });
    } finally {
      dispose();
    }

    if (!response.ok) throw mapHttpError(response.status, text);
    if (text.trim() === '') return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new ApiError('Сервер вернул некорректный ответ.', response.status, { cause: error });
    }
  }

  private buildUrl(req: HttpRequest): string {
    const { instanceId, apiToken } = this.credentials;
    const segments = [
      this.baseUrl,
      `waInstance${encodeURIComponent(instanceId)}`,
      encodeURIComponent(req.apiMethod),
      encodeURIComponent(apiToken),
      ...(req.pathSuffix ?? []).map((s) => encodeURIComponent(String(s))),
    ];
    const url = segments.join('/');
    if (!req.query) return url;
    const params = new URLSearchParams(
      Object.entries(req.query).map(([key, value]) => [key, String(value)]),
    );
    return `${url}?${params.toString()}`;
  }
}

/**
 * Перевод HTTP-ответа с ошибкой в доменную ошибку.
 * Тексты ответов взяты из раздела «Стандартные ошибки» документации GREEN-API.
 */
export function mapHttpError(status: number, bodyText: string): MessengerError {
  const body = bodyText.toLowerCase();

  if (status === 401) return new AuthError();
  if (status === 403) {
    // 403 означает и неверный idInstance, и ограничения аккаунта при отправке — различаем по тексту.
    if (body.includes('suspended')) return new AccountRestrictedError();
    return new AuthError('Доступ запрещён: проверьте idInstance и apiUrl.');
  }
  if (status === 429 || status === 466 || status === 469) {
    if (body.includes('contact info limit')) {
      return new RateLimitError(
        'MAX ограничил проверку номеров из-за частых запросов. Повторите позже (рекомендуется пауза до 2 часов).',
      );
    }
    return new RateLimitError();
  }
  if (status === 400) {
    if (body.includes('webhook url')) {
      return new ConfigurationError(
        'Входящие сообщения не приходят: у инстанса задан webhookUrl. Очистите его в личном кабинете GREEN-API и подождите около минуты.',
      );
    }
    if (body.includes('starting') || body.includes('not authorized')) return new InstanceNotReadyError();
    if (body.includes('expired')) return new AuthError('Срок действия инстанса истёк. Продлите его в личном кабинете GREEN-API.');
    if (body.includes('deleted')) return new AuthError('Инстанс удалён.');
    if (body.includes('idinstance') || body.includes('apitokeninstance')) return new AuthError();
    if (body.includes('4000')) return new ValidationError('Сообщение длиннее 4000 символов.');
    return new ValidationError('Сервер отклонил запрос: некорректные данные.');
  }
  if (status === 404) return new AuthError('Сервер не нашёл метод: проверьте apiUrl.');
  if (status === 408) return new ApiError('Сервер не ответил вовремя. Попробуйте ещё раз.', status);
  return new ApiError(`Ошибка сервера (${status}). Попробуйте позже.`, status);
}

/**
 * Объединяет внешний сигнал отмены с таймаутом. Свой helper вместо AbortSignal.any/timeout:
 * нужно отличать таймаут от отмены пользователем и гарантированно снимать таймер.
 */
function withTimeout(outer: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort(outer?.reason);
  if (outer?.aborted) onOuterAbort();
  else outer?.addEventListener('abort', onOuterAbort, { once: true });

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    },
  };
}
