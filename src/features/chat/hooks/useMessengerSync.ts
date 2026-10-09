/**
 * Подписка экрана чатов на события мессенджера.
 *
 * Хук связывает шлюз с хранилищем: события идут в чистую функцию applyEvent, проблемы
 * получения — в индикатор подключения. Неверный токен закрывает сессию, а неустранимая
 * ошибка настройки (задан webhookUrl) показывается в интерфейсе с кнопкой «Повторить» —
 * отправка при этом продолжает работать.
 *
 * Повторный вызов эффекта в StrictMode безопасен: отписка останавливает источник
 * (и обрывает висящий long poll) до того, как вторая подписка запустит новый.
 */
import { useCallback, useEffect, useState } from 'react';
import { AuthError, errorMessage, isAbortError } from '@/domain/errors';
import { useGateway, useSession } from '@/features/auth/SessionProvider';
import { useChatActions } from '../model/chatStore';

export function useMessengerSync(): { retry: () => void } {
  const gateway = useGateway();
  const { state, logout } = useSession();
  const verifiedConnection = state.status === 'authenticated' ? state.verifiedConnection : null;
  const actions = useChatActions();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    // Сразу после входа состояние уже проверено: у GetStateInstance лимит 1 запрос в секунду.
    if (verifiedConnection && attempt === 0) {
      actions.setConnection(verifiedConnection);
    } else {
      gateway
        .getConnectionState(controller.signal)
        .then(actions.setConnection)
        .catch((error: unknown) => {
          if (isAbortError(error)) return;
          if (error instanceof AuthError) logout(error.message);
        });
    }

    // Проверка настроек провайдера: выключенные уведомления о статусах — частая причина того,
    // что сообщения «висят» на часах. Ошибку проверки не показываем: это лишь подсказка.
    gateway
      .checkSetup?.(controller.signal)
      .then(actions.setSetupWarnings)
      .catch(() => undefined);

    const unsubscribe = gateway.subscribe({
      onEvent: actions.applyEvent,
      onIssue: (error) => actions.setSyncIssue(error ? { message: errorMessage(error), fatal: false } : null),
      onFatal: (error) => {
        if (error instanceof AuthError) logout(error.message);
        else actions.setSyncIssue({ message: errorMessage(error), fatal: true });
      },
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [gateway, actions, logout, attempt, verifiedConnection]);

  const retry = useCallback(() => {
    actions.setSyncIssue(null);
    setAttempt((n) => n + 1);
  }, [actions]);

  return { retry };
}
