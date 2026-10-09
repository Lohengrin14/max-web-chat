/**
 * Окно «Поиск по номеру» — новый чат, как в MAX: выбор кода страны, поле номера и кнопка
 * «Найти в MAX». Проверка аккаунта MAX выполняется только по кнопке (см. useStartChat).
 *
 * Окно — нативный <dialog> в модальном режиме: фокус удерживается внутри, Esc закрывает,
 * остальная страница недоступна для скринридеров. Компонент монтируется на время показа,
 * поэтому каждое открытие начинается с чистого поля и без старой ошибки.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { COUNTRIES, withDialCode, type Country } from '@/shared/phone';
import { Button } from '@/ui/Button';
import { ChevronDownIcon } from '@/ui/icons';
import { useStartChat } from '../hooks/useStartChat';

export function NewChatDialog({ onClose }: { onClose: () => void }) {
  const { start, pending, error, resetError } = useStartChat();
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await start(withDialCode(country, phone))) dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      // Клик по затемнению (вне карточки) закрывает окно.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <form className="dialog__card" onSubmit={handleSubmit} noValidate>
        <h2 id={`${id}-title`} className="dialog__title">
          Поиск по номеру
        </h2>
        <div className={`phone-field${error ? ' phone-field--invalid' : ''}`}>
          <CountryPicker
            value={country}
            onChange={(next) => {
              setCountry(next);
              if (error) resetError();
              inputRef.current?.focus();
            }}
          />
          <label htmlFor={id} className="visually-hidden">
            Номер телефона
          </label>
          <input
            ref={inputRef}
            id={id}
            className="phone-field__input"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            placeholder={country.placeholder}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) resetError();
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        {error && (
          <p id={`${id}-error`} className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="dialog__submit" loading={pending} disabled={!phone.trim()}>
          Найти в MAX
        </Button>
      </form>
    </dialog>
  );
}

function CountryPicker({ value, onChange }: { value: Country; onChange: (country: Country) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Клик мимо списка закрывает его.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function handleKeyDown(e: KeyboardEvent) {
    // Esc закрывает только список, а не всё окно.
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="country-picker" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="country-picker__toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Код страны: ${value.name}, +${value.dialCode}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{value.flag}</span>
        <span>+{value.dialCode}</span>
        <ChevronDownIcon className="country-picker__chevron" width={16} height={16} />
      </button>
      {open && (
        <ul id={listId} className="country-picker__list" role="listbox" aria-label="Страна">
          {COUNTRIES.map((country) => (
            <li key={country.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={country.id === value.id}
                className="country-picker__option"
                autoFocus={country.id === value.id}
                onClick={() => {
                  setOpen(false);
                  onChange(country);
                }}
              >
                <span aria-hidden="true">{country.flag}</span>
                <span className="country-picker__name">{country.name}</span>
                <span className="country-picker__code">+{country.dialCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
