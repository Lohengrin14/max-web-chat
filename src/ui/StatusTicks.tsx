/**
 * Индикатор статуса исходящего сообщения, как в привычных мессенджерах:
 * часы — ещё не отправлено, ✓ — отправлено, ✓✓ — доставлено, синие ✓✓ — прочитано,
 * красный значок — ошибка. Текстовое описание дублируется для скринридеров и в title.
 */
import type { MessageStatus } from '@/domain/models';
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from './icons';

const LABELS: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  queued: 'В очереди на отправку',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
};

interface StatusTicksProps {
  status: MessageStatus;
  error?: string;
}

export function StatusTicks({ status, error }: StatusTicksProps) {
  const label = status === 'failed' && error ? `${LABELS.failed}: ${error}` : LABELS[status];
  return (
    <span className={`ticks ticks--${status}`} title={label}>
      {renderIcon(status)}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

function renderIcon(status: MessageStatus) {
  switch (status) {
    case 'pending':
    case 'queued':
      return <ClockIcon width={14} height={14} />;
    case 'sent':
      return <CheckIcon width={15} height={15} />;
    case 'delivered':
    case 'read':
      return <DoubleCheckIcon width={18} height={15} />;
    case 'failed':
      return <AlertIcon width={15} height={15} />;
  }
}
