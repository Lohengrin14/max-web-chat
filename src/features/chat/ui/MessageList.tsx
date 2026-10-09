/**
 * Лента сообщений с разделителями по дням.
 *
 * Подряд идущие сообщения одного направления складываются в «стопку», как в MAX: у
 * соседних пузырей внутренние углы скругляются меньше. Для этого каждому сообщению
 * вычисляется, есть ли у него сосед сверху и снизу.
 *
 * Автопрокрутка: к новому сообщению прокручиваем, только если пользователь и так был внизу
 * или сообщение отправил он сам, — чтобы входящее не выдёргивало из чтения истории.
 * role="log" сообщает скринридеру, что новые сообщения добавляются в конец.
 */
import { Fragment, useLayoutEffect, useRef } from 'react';
import type { ChatId, Message } from '@/domain/models';
import { StatusTicks } from '@/ui/StatusTicks';
import type { LoadStatus } from '../model/chatState';
import { useChatStore } from '../model/chatStore';
import { formatDay, formatTime, isSameDay, unsupportedLabel } from './format';

const EMPTY: Message[] = [];
/** Насколько близко к низу (px) считается «пользователь внизу». */
const STICK_THRESHOLD = 80;

function sameStack(a: Message | undefined, b: Message | undefined): boolean {
  return !!a && !!b && a.direction === b.direction && isSameDay(a.timestamp, b.timestamp);
}

interface MessageListProps {
  chatId: ChatId;
  /** Состояние загрузки истории с сервера; undefined — ещё не запрашивалась. */
  historyStatus: LoadStatus | undefined;
  onRetryHistory: () => void;
}

export function MessageList({ chatId, historyStatus, onRetryHistory }: MessageListProps) {
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
      {historyStatus === 'failed' && (
        <div className="messages__history">
          <button type="button" className="capsule capsule--action" onClick={onRetryHistory}>
            Не удалось загрузить историю · Повторить
          </button>
        </div>
      )}
      {historyStatus === 'loading' && messages.length > 0 && (
        <div className="messages__history">
          <span className="capsule">Загружаем историю…</span>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="messages__empty">
          <span className="capsule">
            {historyStatus === 'loading' || historyStatus === undefined
              ? 'Загружаем историю…'
              : 'Сообщений пока нет. Напишите первым!'}
          </span>
        </div>
      ) : (
        <ol className="messages__list">
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || !isSameDay(prev.timestamp, message.timestamp);
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className="messages__day">
                    <span className="capsule">{formatDay(message.timestamp)}</span>
                  </li>
                )}
                <MessageBubble message={message} stackedAbove={sameStack(prev, message)} stackedBelow={sameStack(message, next)} />
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  stackedAbove: boolean;
  stackedBelow: boolean;
}

function MessageBubble({ message, stackedAbove, stackedBelow }: MessageBubbleProps) {
  const outgoing = message.direction === 'outgoing';
  const classes = [
    'message',
    outgoing ? 'message--out' : 'message--in',
    stackedAbove ? 'message--stack-above' : '',
    stackedBelow ? 'message--stack-below' : '',
    message.status === 'failed' ? 'message--failed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <div className="bubble">
        {message.senderName && !outgoing && !stackedAbove && <span className="bubble__author">{message.senderName}</span>}
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
      </div>
      {message.status === 'failed' && message.error && <span className="message__error">{message.error}</span>}
    </li>
  );
}
