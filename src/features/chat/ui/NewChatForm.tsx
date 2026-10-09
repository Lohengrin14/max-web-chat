/**
 * Форма «Новый чат» по номеру телефона. Номер принимается в любом привычном виде;
 * проверка аккаунта MAX выполняется только при отправке формы (см. useStartChat).
 */
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { PlusIcon } from '@/ui/icons';
import { TextField } from '@/ui/TextField';
import { useStartChat } from '../hooks/useStartChat';

export function NewChatForm() {
  const { start, pending, error, resetError } = useStartChat();
  const [phone, setPhone] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await start(phone)) setPhone('');
  }

  return (
    <form className="new-chat" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Номер телефона для нового чата"
        hideLabel
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="Новый чат: +7 999 123-45-67"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (error) resetError();
        }}
        error={error}
        className="new-chat__field"
      />
      <Button type="submit" variant="icon" className="new-chat__submit" loading={pending} aria-label="Создать чат" title="Создать чат">
        <PlusIcon />
      </Button>
    </form>
  );
}
