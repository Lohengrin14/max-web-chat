/**
 * Оптимистичная отправка текстового сообщения.
 *
 * Сообщение сразу появляется в ленте со статусом pending и временным id — пользователь
 * не ждёт сеть. Ответ SendMessage заменяет временный id настоящим (статус queued: сервер
 * поставил сообщение в очередь, но ещё не отправил). Дальнейшие статусы придут событиями.
 */
import { useCallback } from 'react';
import { errorMessage } from '@/domain/errors';
import type { ChatId } from '@/domain/models';
import { useGateway, useSession } from '@/features/auth/SessionProvider';
import { STALLED_STATUS_TIMEOUT_MS } from '../model/chatState';
import { useChatActions } from '../model/chatStore';

let localCounter = 0;

/** Временный id; crypto.randomUUID недоступен вне secure context (http по IP в локальной сети). */
function createTempId(): string {
  return `local-${Date.now().toString(36)}-${(++localCounter).toString(36)}`;
}

export function useSendMessage(): { send: (chatId: ChatId, text: string) => Promise<void>; maxLength: number } {
  const gateway = useGateway();
  const { handleError } = useSession();
  const actions = useChatActions();

  const send = useCallback(
    async (chatId: ChatId, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const tempId = createTempId();
      actions.addPending({ tempId, chatId, text: trimmed, timestamp: Date.now() });
      try {
        const { id } = await gateway.sendText({ chatId, text: trimmed });
        actions.confirm({ chatId, tempId, id });
        // Если за таймаут не придёт ни эхо, ни статус, модель покажет подсказку про вебхуки.
        // Таймер не снимается при размонтировании: хранилище живёт всю сессию, а проверка
        // должна сработать, даже если пользователь уже переключился на другой чат.
        setTimeout(actions.checkStalledStatuses, STALLED_STATUS_TIMEOUT_MS + 100);
      } catch (error) {
        actions.fail({ chatId, tempId, error: errorMessage(error) });
        handleError(error);
      }
    },
    [gateway, actions, handleError],
  );

  return { send, maxLength: gateway.capabilities.maxTextLength };
}
