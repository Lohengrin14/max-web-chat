/**
 * Список чатов, отсортированный по последней активности, с превью последнего сообщения.
 * Пока загружаются недавние чаты с сервера, вместо пустого состояния показывается загрузка.
 *
 * С поисковым запросом в списке остаются только чаты с совпадением, а если совпало
 * сообщение — в превью вместо последнего показывается оно, с подсветкой.
 */
import { useMemo } from 'react';
import type { Chat, Message } from '@/domain/models';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { StatusTicks } from '@/ui/StatusTicks';
import { searchChats } from '../model/chatSearch';
import { selectChatList } from '../model/chats';
import { useChatActions, useChatStore } from '../model/chatStore';
import { contentPreview } from './content/preview';
import { chatTitle, formatListTime } from './format';
import { Highlight } from './Highlight';
import './ChatList.css';

export function ChatList({ query, onRetryRecent }: { query: string; onRetryRecent: () => void }) {
  const chats = useChatStore((s) => s.chats);
  const recentStatus = useChatStore((s) => s.recentStatus);
  const messages = useChatStore((s) => s.messages);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { selectChat } = useChatActions();

  // Сортировка — в useMemo по стабильной ссылке на chats, а не в селекторе (новый массив на каждый вызов).
  const sorted = useMemo(() => selectChatList({ chats }), [chats]);
  const results = useMemo(() => searchChats(sorted, messages, query), [sorted, messages, query]);

  const retryNotice = recentStatus === 'failed' && (
    <div className="chat-list__notice" role="alert">
      <span>Не удалось загрузить чаты</span>
      <Button variant="secondary" onClick={onRetryRecent}>
        Повторить
      </Button>
    </div>
  );

  if (sorted.length === 0) {
    if (recentStatus === 'failed') return <div className="chat-list">{retryNotice}</div>;
    return (
      <p className="chat-list__empty" aria-live="polite">
        {recentStatus === 'loading' || recentStatus === null
          ? 'Загружаем чаты…'
          : 'Чатов пока нет. Нажмите «+», чтобы начать переписку по номеру телефона.'}
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="chat-list__empty" aria-live="polite">
        Ничего не найдено
      </p>
    );
  }

  return (
    <nav className="chat-list" aria-label="Список чатов">
      {retryNotice}
      <ul>
        {results.map(({ chat, message }) => {
          const list = messages[chat.id];
          return (
            <li key={chat.id}>
              <ChatListItem
                chat={chat}
                last={message ?? list?.[list.length - 1]}
                query={query}
                active={chat.id === activeChatId}
                onSelect={() => selectChat(chat.id)}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface ChatListItemProps {
  chat: Chat;
  last: Message | undefined;
  query: string;
  active: boolean;
  onSelect: () => void;
}

function ChatListItem({ chat, last, query, active, onSelect }: ChatListItemProps) {
  const title = chatTitle(chat);
  return (
    <button type="button" className="chat-item" aria-current={active ? 'true' : undefined} onClick={onSelect}>
      <Avatar seed={chat.id} name={title} />
      <span className="chat-item__body">
        <span className="chat-item__row">
          <span className="chat-item__title">
            <Highlight text={title} query={query} />
          </span>
          {last && <span className="chat-item__time">{formatListTime(last.timestamp)}</span>}
        </span>
        <span className="chat-item__row">
          <span className="chat-item__preview">
            {last?.direction === 'outgoing' && last.status && <StatusTicks status={last.status} error={last.error} />}
            {last ? <Highlight text={contentPreview(last.content)} query={query} /> : 'Нет сообщений'}
          </span>
          {chat.unreadCount > 0 && (
            <span className="chat-item__badge" aria-label={`Непрочитанных: ${chat.unreadCount}`}>
              {chat.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
