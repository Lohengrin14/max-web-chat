/**
 * Индикатор статуса исходящего сообщения в логике MAX:
 * часы — ещё не отправлено, ✓ — отправлено/доставлено, ✓✓ — прочитано,
 * красный значок — ошибка.
 *
 * Две галочки означают только «прочитано»: MAX присылает `delivered` почти сразу после
 * отправки, и если рисовать его двумя галочками, сообщение выглядит прочитанным, хотя
 * получатель его ещё не открывал. Точный статус — в title и в тексте для скринридеров.
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
    case 'delivered':
      return <CheckIcon width={15} height={15} />;
    case 'read':
      return <DoubleCheckIcon width={18} height={15} />;
    case 'failed':
      return <AlertIcon width={15} height={15} />;
  }
}
