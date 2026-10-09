/**
 * Предупреждения над списком чатов: состояние аккаунта мессенджера и проблемы
 * получения событий. Временная проблема — «переподключаемся», неустранимая — кнопка «Повторить».
 */
import type { ConnectionState } from "@/domain/models";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { useChatStore } from "../model/chatStore";
import type { SyncIssue } from "../model/state";
import "./ConnectionBanner.css";

const CONNECTION_WARNINGS: Partial<Record<ConnectionState, string>> = {
  notAuthorized:
    "Аккаунт MAX не авторизован в инстансе. Отсканируйте QR-код в личном кабинете GREEN-API.",
  starting:
    "Инстанс запускается — сообщения начнут приходить через пару минут.",
  blocked: "Аккаунт MAX заблокирован.",
  restricted:
    "На аккаунте временные ограничения: отправка возможна только на номера из контактов.",
};

export function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  const connection = useChatStore((s) => s.connection);
  const syncIssue = useChatStore((s) => s.syncIssue);
  const warning = CONNECTION_WARNINGS[connection];

  if (!warning && !syncIssue) return null;
  return (
    <div className="sidebar__banners">
      {warning && <Alert tone="warning">{warning}</Alert>}
      {syncIssue && <SyncIssueAlert issue={syncIssue} onRetry={onRetry} />}
    </div>
  );
}

function SyncIssueAlert({
  issue,
  onRetry,
}: {
  issue: SyncIssue;
  onRetry: () => void;
}) {
  if (issue.fatal) {
    return (
      <Alert
        tone="error"
        action={
          <Button variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        }
      >
        {issue.message}
      </Alert>
    );
  }
  return <Alert tone="warning">{issue.message} Переподключаемся…</Alert>;
}
