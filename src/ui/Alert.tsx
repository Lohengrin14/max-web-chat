/**
 * Плашка с сообщением. Ошибки объявляются скринридеру сразу (role="alert"),
 * предупреждения и справка — вежливо (role="status").
 */
import type { ReactNode } from 'react';
import { AlertIcon } from './icons';

interface AlertProps {
  tone?: 'error' | 'warning' | 'info';
  children: ReactNode;
  action?: ReactNode;
}

export function Alert({ tone = 'error', children, action }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AlertIcon className="alert__icon" width={18} height={18} />
      <div className="alert__body">{children}</div>
      {action && <div className="alert__action">{action}</div>}
    </div>
  );
}
