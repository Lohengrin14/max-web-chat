/**
 * Поле ввода с подписью, подсказкой и ошибкой. Подпись связана с полем через htmlFor,
 * подсказка и ошибка — через aria-describedby, чтобы их зачитывал скринридер.
 */
import { useId, type InputHTMLAttributes } from 'react';
import './TextField.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Скрыть подпись визуально, оставив её для скринридеров. */
  hideLabel?: boolean;
}

export function TextField({ label, hint, error, hideLabel = false, className, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['field', error ? 'field--invalid' : '', className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
