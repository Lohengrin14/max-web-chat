/**
 * Доменные ошибки.
 *
 * Адаптеры переводят в них HTTP-коды и ответы провайдера, поэтому фичи принимают решения
 * по типу ошибки («разлогинить», «повторить позже», «показать пользователю»), не зная
 * про статусы HTTP. Сообщения — на русском и пригодны для показа в интерфейсе.
 */

export abstract class MessengerError extends Error {
  /** Имеет ли смысл автоматически повторить операцию позже. */
  abstract readonly retryable: boolean;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Неверные учётные данные или нет доступа к инстансу. Требует повторного входа. */
export class AuthError extends MessengerError {
  readonly retryable = false;
  constructor(message = 'Неверные учётные данные: проверьте idInstance и apiTokenInstance.', options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Нет связи с сервером или он не ответил вовремя. */
export class NetworkError extends MessengerError {
  readonly retryable = true;
  constructor(message = 'Нет связи с сервером. Проверьте интернет и apiUrl.', options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Провайдер отклонил параметры запроса. */
export class ValidationError extends MessengerError {
  readonly retryable = false;
}

/** Превышена частота запросов. */
export class RateLimitError extends MessengerError {
  readonly retryable = true;
  constructor(message = 'Слишком много запросов. Подождите немного и повторите.', options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** На аккаунте мессенджера действуют ограничения (например, отправка только контактам). */
export class AccountRestrictedError extends MessengerError {
  readonly retryable = false;
  constructor(
    message = 'На аккаунте MAX временные ограничения: отправка возможна только на номера из контактов.',
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Инстанс неверно настроен так, что функция не может работать (например, задан webhookUrl). */
export class ConfigurationError extends MessengerError {
  readonly retryable = false;
}

/** Инстанс запускается или аккаунт мессенджера не привязан — состояние временное. */
export class InstanceNotReadyError extends MessengerError {
  readonly retryable = true;
  constructor(
    message = 'Инстанс запускается или аккаунт MAX не авторизован. Проверьте статус в личном кабинете GREEN-API.',
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Прочие ошибки провайдера (5xx, неожиданный ответ). */
export class ApiError extends MessengerError {
  readonly retryable: boolean;
  constructor(
    message: string,
    readonly httpStatus?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.retryable = httpStatus === undefined || httpStatus >= 500 || httpStatus === 499;
  }
}

/** Прерывание запроса по AbortSignal — это не ошибка, а штатная отмена. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Текст ошибки, пригодный для показа пользователю. */
export function errorMessage(error: unknown): string {
  if (error instanceof MessengerError) return error.message;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
