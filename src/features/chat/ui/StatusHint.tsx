/**
 * Подсказка «включите вебхуки» над списком чатов.
 *
 * Появляется, когда отправленное сообщение дольше таймаута висит без эха и статусов
 * (см. checkStalledStatuses): значит, у инстанса выключены уведомления об отправленных
 * сообщениях и их статусах, и сами мы это исправить не можем — только подсказать, где
 * включить. Исчезает сама, как только статусы начнут приходить; можно закрыть вручную.
 */
import { Button } from '@/ui/Button';
import { CloseIcon } from '@/ui/icons';
import { useChatActions, useChatStore } from '../model/chatStore';

/** Документация по вебхукам (раздел о настройках уведомлений инстанса). */
const WEBHOOKS_DOCS_URL = 'https://green-api.com/v3/docs/api/marks/ReadChat/';

/** Страница инстанса в личном кабинете GREEN-API — там включаются уведомления. */
function instanceConsoleUrl(instanceId: string): string {
  return `https://console.green-api.com/instanceList/${encodeURIComponent(instanceId)}`;
}

export function StatusHint({ instanceId }: { instanceId: string }) {
  const hint = useChatStore((s) => s.statusHint);
  const { dismissStatusHint } = useChatActions();

  if (hint !== 'shown') return null;
  return (
    <section className="status-hint" role="status" aria-labelledby="status-hint-title">
      <div className="status-hint__head">
        <h2 id="status-hint-title" className="status-hint__title">
          Статусы сообщений не обновляются
        </h2>
        <Button variant="icon" className="status-hint__close" onClick={dismissStatusHint} aria-label="Закрыть подсказку">
          <CloseIcon width={18} height={18} />
        </Button>
      </div>
      <p className="status-hint__text">
        Для того чтобы отслеживать статус сообщения, необходимо включить{' '}
        <a href={WEBHOOKS_DOCS_URL} target="_blank" rel="noopener noreferrer">
          вебхуки
        </a>{' '}
        в настройках инстанса, а после — перезагрузить страницу.
      </p>
      <a className="status-hint__action" href={instanceConsoleUrl(instanceId)} target="_blank" rel="noopener noreferrer">
        Профиль
      </a>
    </section>
  );
}
