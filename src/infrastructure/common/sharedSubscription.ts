/**
 * Один источник событий на много подписчиков.
 *
 * У инстанса GREEN-API одна очередь уведомлений: два цикла ReceiveNotification делили бы её
 * между собой, и каждый подписчик видел бы только часть событий. Поэтому шлюз запускает
 * источник при первой подписке, раздаёт события всем подписчикам и останавливает
 * источник после последней отписки. Повторный mount в StrictMode (подписка → отписка →
 * подписка) тоже даёт ровно один работающий источник.
 */
import type { SubscriptionHandlers, Unsubscribe } from '@/domain/ports';

type Broadcast = Required<SubscriptionHandlers>;

export function createSharedSubscription(
  startSource: (broadcast: Broadcast) => Unsubscribe,
): (handlers: SubscriptionHandlers) => Unsubscribe {
  const subscribers = new Set<SubscriptionHandlers>();
  let stopSource: Unsubscribe | null = null;

  const broadcast: Broadcast = {
    onEvent: (event) => {
      for (const s of [...subscribers]) {
        // Ошибка одного подписчика не должна лишать событий остальных.
        try {
          s.onEvent(event);
        } catch (error) {
          console.error('Ошибка подписчика на события мессенджера', error);
        }
      }
    },
    onIssue: (error) => subscribers.forEach((s) => s.onIssue?.(error)),
    onFatal: (error) => {
      stopSource = null;
      subscribers.forEach((s) => s.onFatal?.(error));
    },
  };

  return (handlers) => {
    subscribers.add(handlers);
    stopSource ??= startSource(broadcast);
    return () => {
      if (!subscribers.delete(handlers)) return;
      if (subscribers.size === 0 && stopSource) {
        stopSource();
        stopSource = null;
      }
    };
  };
}
