/**
 * Окно открытого чата: шапка, лента сообщений и поле ввода.
 * Монтируется заново для каждого чата (key = chatId), поэтому черновик, автофокус и
 * прокрутка не «переезжают» между чатами.
 */
import type { ChatId } from '@/domain/models';
import { formatPhone } from '@/shared/phone';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { BackIcon } from '@/ui/icons';
import { useChatHistory } from '../hooks/useChatHistory';
import { useSendMessage } from '../hooks/useSendMessage';
import { useChatActions, useChatStore } from '../model/chatStore';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { chatTitle } from './format';

export function ChatWindow({ chatId }: { chatId: ChatId }) {
  const chat = useChatStore((s) => s.chats[chatId]);
  const { selectChat } = useChatActions();
  const { send, maxLength } = useSendMessage();
  const history = useChatHistory(chatId);

  if (!chat) return null;
  const title = chatTitle(chat);
  const subtitle = chat.title && chat.phone ? formatPhone(chat.phone) : 'Чат в MAX';

  return (
    <section className="chat" aria-label={`Чат: ${title}`}>
      <header className="chat__header">
        {/* Закрывает чат: на широком экране справа остаётся пустой фон, на узком — снова список. */}
        <Button variant="icon" className="chat__back" onClick={() => selectChat(null)} aria-label="Закрыть чат" title="Закрыть чат">
          <BackIcon />
        </Button>
        <Avatar seed={chat.id} name={title} size="lg" />
        <div className="chat__heading">
          <h2 className="chat__title">{title}</h2>
          <p className="chat__subtitle">{subtitle}</p>
        </div>
      </header>
      <MessageList chatId={chatId} historyStatus={history.status} onRetryHistory={history.retry} />
      <Composer onSend={(text) => void send(chatId, text)} maxLength={maxLength} />
    </section>
  );
}
