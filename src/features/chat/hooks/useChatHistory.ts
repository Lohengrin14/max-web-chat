/**
 * Загрузка истории чата при первом открытии.
 *
 * История запрашивается один раз на чат за сессию: у GetChatHistory лимит 1 запрос
 * в секунду, и повторная загрузка при каждом переключении чатов быстро упиралась бы в него.
 * После ошибки автоматического повтора нет — только по кнопке, по той же причине.
 * Отмена при размонтировании не делается — см. комментарий в useRecentChats.
 */
import { useCallback, useEffect } from 'react';
import type { ChatId } from '@/domain/models';
import { useGateway, useSession } from '@/features/auth/SessionProvider';
import type { LoadStatus } from '../model/state';
import { useChatActions, useChatStore, useChatStoreApi } from '../model/chatStore';

export function useChatHistory(chatId: ChatId): { status: LoadStatus | undefined; retry: () => void } {
  const gateway = useGateway();
  const { handleError } = useSession();
  const actions = useChatActions();
  const store = useChatStoreApi();
  const status = useChatStore((s) => s.historyStatus[chatId]);

  const load = useCallback(() => {
    if (store.getState().historyStatus[chatId] === 'loading') return;
    actions.setHistoryStatus(chatId, 'loading');
    gateway
      .loadChatHistory(chatId)
      .then((batch) => {
        actions.applyHistory(batch);
        actions.setHistoryStatus(chatId, 'loaded');
      })
      .catch((error: unknown) => {
        actions.setHistoryStatus(chatId, 'failed');
        handleError(error);
      });
  }, [chatId, gateway, actions, store, handleError]);

  useEffect(() => {
    if (store.getState().historyStatus[chatId] === undefined) load();
  }, [chatId, load, store]);

  return { status, retry: load };
}
