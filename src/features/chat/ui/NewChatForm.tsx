/**
 * Форма «Новый чат» по номеру телефона — в виде поля поиска над списком чатов, как в MAX.
 * Номер принимается в любом привычном виде; проверка аккаунта MAX выполняется только
 * при отправке формы (см. useStartChat).
 */
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { PlusIcon, SearchIcon } from '@/ui/icons';
import { useStartChat } from '../hooks/useStartChat';

export function NewChatForm() {
  const { start, pending, error, resetError } = useStartChat();
  const [phone, setPhone] = useState('');
  const id = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await start(phone)) setPhone('');
  }

  return (
    <form className="new-chat" onSubmit={handleSubmit} noValidate>
      <div className={`search${error ? ' search--invalid' : ''}`}>
        <SearchIcon className="search__icon" width={20} height={20} />
        <label htmlFor={id} className="visually-hidden">
          Номер телефона для нового чата
        </label>
        <input
          id={id}
          className="search__input"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="Новый чат по номеру телефона"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) resetError();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button
          type="submit"
          variant="icon"
          className="search__submit"
          loading={pending}
          disabled={!phone.trim()}
          aria-label="Создать чат"
          title="Создать чат"
        >
          <PlusIcon />
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="new-chat__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
