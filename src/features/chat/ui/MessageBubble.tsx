/**
 * Одно сообщение ленты: пузырь с автором, содержимым, временем и статусом.
 * Соседи по «стопке» (сообщения одного направления подряд) влияют только на отступы
 * и на то, показывать ли автора, — их вычисляет лента.
 */
import type { Message } from '@/domain/models';
import { StatusTicks } from '@/ui/StatusTicks';
import { MessageContent } from './content/MessageContent';
import { formatTime } from './format';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
  stackedAbove: boolean;
  stackedBelow: boolean;
}

export function MessageBubble({ message, stackedAbove, stackedBelow }: MessageBubbleProps) {
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
        <MessageContent content={message.content} />
        <span className="bubble__meta">
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {outgoing && message.status && <StatusTicks status={message.status} error={message.error} />}
        </span>
      </div>
      {message.status === 'failed' && message.error && <span className="message__error">{message.error}</span>}
    </li>
  );
}
