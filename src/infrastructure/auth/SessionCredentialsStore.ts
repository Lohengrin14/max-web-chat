/**
 * Хранение конфигурации сессии в sessionStorage.
 *
 * Почему sessionStorage, а не localStorage: учётные данные переживают перезагрузку (F5),
 * но не остаются в браузере после закрытия вкладки — токен инстанса даёт полный доступ
 * к аккаунту, и хранить его бессрочно в чужом браузере рискованно.
 *
 * Доступ к storage обёрнут в try/catch: в приватном режиме, при запрете cookies или
 * в песочнице iframe обращение к нему бросает исключение. Тогда приложение просто
 * работает без восстановления сессии. Прочитанные данные проверяются схемой, потому что
 * их могли изменить вручную или оставить старой версией приложения.
 */
import { z } from 'zod';
import type { SessionConfig } from '@/domain/models';
import type { CredentialsStore } from '@/domain/ports';

const STORAGE_KEY = 'max-web-chat:session';

const sessionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('live'),
    credentials: z.object({
      apiUrl: z.string().min(1),
      instanceId: z.string().min(1),
      apiToken: z.string().min(1),
    }),
  }),
  z.object({ mode: z.literal('demo') }),
]);

export class SessionCredentialsStore implements CredentialsStore {
  constructor(private readonly getStorage: () => Storage = () => window.sessionStorage) {}

  load(): SessionConfig | null {
    try {
      const raw = this.getStorage().getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = sessionSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  save(config: SessionConfig): void {
    try {
      this.getStorage().setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Хранилище недоступно — сессия просто не переживёт перезагрузку.
    }
  }

  clear(): void {
    try {
      this.getStorage().removeItem(STORAGE_KEY);
    } catch {
      // Нечего очищать.
    }
  }
}
