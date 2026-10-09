/**
 * Источник уведомлений по технологии HTTP API GREEN-API (long polling).
 *
 * Цикл: ReceiveNotification → обработка → DeleteNotification → снова ReceiveNotification.
 *
 * Почему цикл последовательный, а не setInterval: ReceiveNotification сам ждёт уведомление
 * до `receiveTimeout` секунд (long polling), поэтому новый запрос нужен сразу после
 * завершения предыдущего — не раньше и не позже. Интервал либо создавал бы параллельные
 * запросы к одной FIFO-очереди (одно уведомление получили бы дважды, порядок нарушился бы),
 * либо добавлял бы лишнюю задержку.
 *
 * Почему удаляем уведомление даже при ошибке обработчика: очередь FIFO, и неудаляемое
 * уведомление навсегда заблокировало бы все следующие. Ошибка обработчика — баг клиента,
 * а не причина остановить приём сообщений.
 */
import { AuthError, ConfigurationError, isAbortError } from '@/domain/errors';
import type { NotificationHandlers, NotificationSource, Unsubscribe } from '@/domain/ports';
import type { HttpClient } from '../http/HttpClient';
import { receiveNotificationResponseSchema } from './schemas';

export interface PollingOptions {
  /** Сколько секунд сервер держит запрос в ожидании уведомления (документация: 5–60). */
  receiveTimeoutSec?: number;
  /** Пауза после первой ошибки; дальше удваивается. */
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** Подменяется в тестах, чтобы не ждать реального времени. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const DEFAULTS = {
  receiveTimeoutSec: 20,
  initialBackoffMs: 1_000,
  maxBackoffMs: 30_000,
};

/** Запас сверх receiveTimeout: сервер отвечает по таймауту, а не мы обрываем запрос. */
const REQUEST_TIMEOUT_MARGIN_MS = 10_000;

export class HttpPollingSource implements NotificationSource {
  private readonly options: Required<PollingOptions>;

  constructor(
    private readonly http: Pick<HttpClient, 'request'>,
    options: PollingOptions = {},
  ) {
    this.options = { ...DEFAULTS, sleep: abortableSleep, ...options };
  }

  start(handlers: NotificationHandlers): Unsubscribe {
    // Каждый запуск — свой AbortController: остановка обрывает и висящий long poll,
    // поэтому повторный mount в StrictMode не оставляет «осиротевший» второй цикл.
    const controller = new AbortController();
    void this.loop(controller.signal, handlers);
    return () => controller.abort();
  }

  private async loop(signal: AbortSignal, handlers: NotificationHandlers): Promise<void> {
    const { receiveTimeoutSec } = this.options;
    let failures = 0;

    while (!signal.aborted) {
      try {
        const raw = await this.http.request({
          httpMethod: 'GET',
          apiMethod: 'receiveNotification',
          query: { receiveTimeout: receiveTimeoutSec },
          signal,
          timeoutMs: receiveTimeoutSec * 1000 + REQUEST_TIMEOUT_MARGIN_MS,
        });
        const notification = receiveNotificationResponseSchema.parse(raw);

        if (failures > 0) {
          failures = 0;
          handlers.onIssue?.(null);
        }
        // Пустой ответ — истёк receiveTimeout, уведомлений нет. Сразу ждём следующее.
        if (notification === null) continue;

        try {
          await handlers.onRaw(notification.body);
        } catch (error) {
          console.error('Ошибка обработки уведомления, оно будет пропущено', error);
        }
        if (signal.aborted) return;

        // Если удаление не удастся, то же уведомление придёт снова — потребитель идемпотентен.
        // Ответ `{ result: false }` означает «уже удалено» — для нас это тоже успех.
        await this.http.request({
          httpMethod: 'DELETE',
          apiMethod: 'deleteNotification',
          pathSuffix: [notification.receiptId],
          signal,
        });
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;

        // Неверный токен или задан webhookUrl: повторы не помогут, а только тратят лимиты.
        if (error instanceof AuthError || error instanceof ConfigurationError) {
          handlers.onFatal(error);
          return;
        }

        failures += 1;
        handlers.onIssue?.(error instanceof Error ? error : new Error(String(error)));
        await this.options.sleep(this.backoffDelay(failures), signal).catch(() => undefined);
      }
    }
  }

  /** Экспоненциальная пауза: 1 с, 2 с, 4 с … но не больше 30 с. */
  private backoffDelay(failures: number): number {
    const { initialBackoffMs, maxBackoffMs } = this.options;
    return Math.min(initialBackoffMs * 2 ** (failures - 1), maxBackoffMs);
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
