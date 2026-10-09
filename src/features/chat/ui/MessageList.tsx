/**
 * Лента сообщений с разделителями по дням.
 *
 * Автопрокрутка: к новому сообщению прокручиваем, только если пользователь и так был внизу
 * или сообщение отправил он сам, — чтобы входящее не выдёргивало из чтения истории.
 * role="log" сообщает скринридеру, что новые сообщения добавляются в конец.
 */
import { Fragment, useLayoutEffect, useRef } from 'react';
import type { ChatId, Message } from '@/domain/models';
import { StatusTicks } from '@/ui/StatusTicks';
import { useChatStore } from '../model/chatStore';
import { formatDay, formatTime, isSameDay, unsupportedLabel } from './format';

const EMPTY: Message[] = [];
/** Насколько близко к низу (px) считается «пользователь внизу». */
const STICK_THRESHOLD = 80;

export function MessageList({ chatId }: { chatId: ChatId }) {
  const messages = useChatStore((s) => s.messages[chatId] ?? EMPTY);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  const lastOutgoing = messages[messages.length - 1]?.direction === 'outgoing';

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && (stickToBottom.current || lastOutgoing)) el.scrollTop = el.scrollHeight;
  }, [lastId, lastOutgoing]);

  function handleScroll() {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
  }

  return (
    <div className="messages" ref={scrollRef} onScroll={handleScroll} role="log" aria-live="polite" aria-label="Сообщения" tabIndex={0}>
      {messages.length === 0 ? (
        <p className="messages__empty">Сообщений пока нет. Напишите первым!</p>
      ) : (
        <ol className="messages__list">
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || !isSameDay(prev.timestamp, message.timestamp);
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className="messages__day">
                    <span>{formatDay(message.timestamp)}</span>
                  </li>
                )}
                <MessageBubble message={message} grouped={!newDay && prev?.direction === message.direction} />
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MessageBubble({ message, grouped }: { message: Message; grouped: boolean }) {
  const outgoing = message.direction === 'outgoing';
  const classes = ['bubble', outgoing ? 'bubble--out' : 'bubble--in', grouped ? 'bubble--grouped' : '', message.status === 'failed' ? 'bubble--failed' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      {message.senderName && !outgoing && <span className="bubble__author">{message.senderName}</span>}
      {message.content.kind === 'text' ? (
        <p className="bubble__text">{message.content.text}</p>
      ) : (
        <p className="bubble__text bubble__text--muted">
          {unsupportedLabel(message.content.contentKind)} — этот тип сообщений пока не поддерживается
        </p>
      )}
      <span className="bubble__meta">
        <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
        {outgoing && message.status && <StatusTicks status={message.status} error={message.error} />}
      </span>
      {message.status === 'failed' && message.error && <span className="bubble__error">{message.error}</span>}
    </li>
  );
}
