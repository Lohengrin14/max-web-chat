/**
 * Можно ли слать на этот адрес токен инстанса.
 *
 * GREEN-API передаёт токен в пути запроса, поэтому по http:// он ушёл бы открытым текстом.
 * Исключение — локальный адрес (например, свой прокси при разработке): такой трафик
 * не покидает компьютер, а браузер считает localhost безопасным контекстом.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isSecureApiUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!url.hostname) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
}
