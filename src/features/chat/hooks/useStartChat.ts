/**
 * Создание чата по номеру телефона.
 *
 * В MAX chatId — это не номер телефона, а отдельный числовой идентификатор. Отправка
 * по «номер@c.us» формально работает, но ответы и статусы тогда приходят с настоящим
 * chatId и не попадают в созданный чат. Поэтому номер сначала превращается в chatId
 * методом поиска контакта (CheckAccount), и чат создаётся уже с ним.
 *
 * Поиск вызывается только по явному действию пользователя, а не на ввод: частые проверки,
 * особенно несуществующих номеров, MAX расценивает как подозрительные. По той же причине
 * номера, для которых аккаунт не найден, запоминаются и повторно не проверяются.
 */
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/domain/errors';
import { useGateway, useSession } from '@/features/auth/SessionProvider';
import { normalizePhone } from '@/shared/phone';
import { findChatByPhone } from '../model/chats';
import { useChatActions, useChatStoreApi } from '../model/chatStore';

const NOT_REGISTERED = 'На этот номер не зарегистрирован MAX';

export function useStartChat() {
  const gateway = useGateway();
  const { handleError } = useSession();
  const actions = useChatActions();
  const store = useChatStoreApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notRegistered = useRef(new Set<string>());
  const inFlight = useRef(false);

  const start = useCallback(
    async (input: string): Promise<boolean> => {
      if (inFlight.current) return false;
      const parsed = normalizePhone(input);
      if (!parsed.ok) {
        setError(parsed.error);
        return false;
      }
      const phone = parsed.digits;

      // Чат с этим номером уже есть — просто открываем его, без запроса к API.
      const existing = findChatByPhone(store.getState(), phone);
      if (existing) {
        actions.selectChat(existing.id);
        setError(null);
        return true;
      }
      if (notRegistered.current.has(phone)) {
        setError(NOT_REGISTERED);
        return false;
      }

      inFlight.current = true;
      setPending(true);
      setError(null);
      try {
        const result = await gateway.findContactByPhone(phone);
        if (!result.exists || !result.chatId) {
          notRegistered.current.add(phone);
          setError(NOT_REGISTERED);
          return false;
        }
        actions.openChat({ id: result.chatId, phone });
        return true;
      } catch (err) {
        setError(errorMessage(err));
        handleError(err);
        return false;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [gateway, actions, store, handleError],
  );

  const resetError = useCallback(() => setError(null), []);

  return { start, pending, error, resetError };
}
