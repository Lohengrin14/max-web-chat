/**
 * Кнопка. «Глупый» компонент: ничего не знает о чатах и сессиях.
 * В состоянии загрузки кнопка заблокирована и объявляет занятость через aria-busy.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading = false, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, loading ? 'btn--loading' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      <span className="btn__label">{children}</span>
    </button>
  );
}
