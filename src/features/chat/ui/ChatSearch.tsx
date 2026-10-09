/**
 * Поле поиска над списком чатов, как в MAX. Ищет по именам, номерам и сообщениям
 * (см. searchChats); фильтрует список на ввод — запросов к API нет. Esc очищает поле.
 */
import { CloseIcon } from '@/ui/icons';

interface ChatSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ChatSearch({ value, onChange }: ChatSearchProps) {
  return (
    <div className="chat-search" role="search">
      <input
        className="chat-search__input"
        type="search"
        autoComplete="off"
        placeholder="Поиск"
        aria-label="Поиск по чатам, номерам и сообщениям"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
      />
      {value && (
        <button type="button" className="chat-search__clear" aria-label="Очистить поиск" onClick={() => onChange('')}>
          <CloseIcon width={12} height={12} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
