/**
 * Загрузка недавних чатов при открытии экрана.
 *
 * Без неё список чатов после перезагрузки страницы или повторного входа начинался бы
 * с нуля: уведомления несут только новые события, а не прошлое. Снимок сливается с
 * состоянием через applyHistory, поэтому события, пришедшие раньше ответа, не теряются
 * и не дублируются.
 *
 * Повторный вызов эффекта (StrictMode) не делает второй запрос: статус `loading`
 * выставляется синхронно до запроса. Запрос не отменяется при размонтировании — иначе
 * StrictMode отменил бы первый запрос, а второй эффект счёл бы загрузку уже идущей.
 */
import { useCallback, useEffect } from 'react';
import { useGateway, useSession } from '@/features/auth/SessionProvider';
import { useChatActions, useChatStoreApi } from '../model/chatStore';

export function useRecentChats(): { retry: () => void } {
  const gateway = useGateway();
  const { handleError } = useSession();
  const actions = useChatActions();
  const store = useChatStoreApi();

  const load = useCallback(() => {
    if (store.getState().recentStatus === 'loading') return;
    actions.setRecentStatus('loading');
    gateway
      .loadRecent()
      .then((batch) => {
        actions.applyHistory(batch);
        actions.setRecentStatus('loaded');
      })
      .catch((error: unknown) => {
        actions.setRecentStatus('failed');
        handleError(error);
      });
  }, [gateway, actions, store, handleError]);

  useEffect(() => {
    if (store.getState().recentStatus === null) load();
  }, [load, store]);

  return { retry: load };
}
