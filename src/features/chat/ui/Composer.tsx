/**
 * Поле ввода сообщения.
 *
 * - Enter отправляет, Shift+Enter переносит строку. Во время набора через IME (например,
 *   японская раскладка или автозамена на мобильных) Enter подтверждает ввод, а не
 *   отправляет — это проверяется по isComposing.
 * - Высота растёт по содержимому до предела, дальше появляется прокрутка.
 * - Лимит длины приходит из возможностей шлюза; счётчик появляется при приближении к нему.
 */
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Button } from '@/ui/Button';
import { SendIcon } from '@/ui/icons';

interface ComposerProps {
  onSend: (text: string) => void;
  maxLength: number;
}

/** Счётчик показывается, когда осталось меньше 10% лимита. */
const COUNTER_THRESHOLD = 0.9;
const MAX_HEIGHT_PX = 180;

export function Composer({ onSend, maxLength }: ComposerProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const length = text.length;
  const tooLong = length > maxLength;
  const hasText = text.trim().length > 0;
  const canSend = hasText && !tooLong;
  const showCounter = length >= maxLength * COUNTER_THRESHOLD;

  // Автофокус при открытии чата — только на устройствах с мышью, чтобы на телефоне
  // не выскакивала клавиатура поверх ленты.
  useLayoutEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) ref.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  function submit() {
    if (!canSend) return;
    onSend(text);
    setText('');
    // Кнопка исчезает вместе с текстом; если отправляли кликом, фокус вернётся в поле,
    // чтобы можно было сразу печатать дальше.
    ref.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // keyCode 229 — Safari сообщает так о вводе через IME вместо isComposing.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  }

  /**
   * Клик по карточке мимо текстового поля (отступы, промежуток у кнопки) ставит курсор
   * в конец текста. Без этого фокус не переходил в поле или курсор оказывался в начале.
   * Клики по самому полю и по кнопке отправки работают как обычно.
   */
  function handleCardMouseDown(event: MouseEvent<HTMLDivElement>) {
    const textarea = ref.current;
    if (!textarea || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target === textarea || target.closest('button')) return;
    // Не даём браузеру увести фокус или выделение на саму карточку.
    event.preventDefault();
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    // Для многострочного текста — показать конец, а не начало.
    textarea.scrollTop = textarea.scrollHeight;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {/* Плавающая карточка ввода поверх фона чата — как панель ввода в MAX. */}
      <div className="composer__card" onMouseDown={handleCardMouseDown}>
        <label htmlFor="composer-input" className="visually-hidden">
          Сообщение
        </label>
        <textarea
          id="composer-input"
          ref={ref}
          className="composer__input"
          rows={1}
          placeholder="Сообщение"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={showCounter ? 'composer-counter' : undefined}
          aria-invalid={tooLong || undefined}
        />
        {showCounter && (
          <span id="composer-counter" className={`composer__counter${tooLong ? ' composer__counter--over' : ''}`} aria-live="polite">
            {length} / {maxLength}
          </span>
        )}
        {/* Как в MAX: в пустом поле кнопки нет, она появляется, когда есть что отправить.
            При превышении лимита остаётся видимой, но неактивной — рядом счётчик объясняет почему. */}
        {hasText && (
          <Button type="submit" variant="icon" className="composer__send" disabled={!canSend} aria-label="Отправить" title="Отправить (Enter)">
            <SendIcon width={23} height={23} />
          </Button>
        )}
      </div>
    </form>
  );
}
