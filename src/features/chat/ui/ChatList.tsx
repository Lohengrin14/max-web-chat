/**
 * Список чатов, отсортированный по последней активности, с превью последнего сообщения.
 */
import { useMemo } from 'react';
import type { Chat, Message } from '@/domain/models';
import { Avatar } from '@/ui/Avatar';
import { StatusTicks } from '@/ui/StatusTicks';
import { selectChatList } from '../model/chatState';
import { useChatActions, useChatStore } from '../model/chatStore';
import { chatTitle, contentPreview, formatListTime } from './format';

export function ChatList() {
  const chats = useChatStore((s) => s.chats);
  const messages = useChatStore((s) => s.messages);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { selectChat } = useChatActions();

  // Сортировка — в useMemo по стабильной ссылке на chats, а не в селекторе (новый массив на каждый вызов).
  const sorted = useMemo(() => selectChatList({ chats }), [chats]);

  if (sorted.length === 0) {
    return (
      <p className="chat-list__empty">
        Чатов пока нет. Введите номер телефона выше, чтобы начать переписку.
      </p>
    );
  }

  return (
    <nav className="chat-list" aria-label="Список чатов">
      <ul>
        {sorted.map((chat) => {
          const list = messages[chat.id];
          return (
            <li key={chat.id}>
              <ChatListItem
                chat={chat}
                last={list?.[list.length - 1]}
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
  active: boolean;
  onSelect: () => void;
}

function ChatListItem({ chat, last, active, onSelect }: ChatListItemProps) {
  const title = chatTitle(chat);
  return (
    <button type="button" className="chat-item" aria-current={active ? 'true' : undefined} onClick={onSelect}>
      <Avatar seed={chat.id} name={title} />
      <span className="chat-item__body">
        <span className="chat-item__row">
          <span className="chat-item__title">{title}</span>
          {last && <span className="chat-item__time">{formatListTime(last.timestamp)}</span>}
        </span>
        <span className="chat-item__row">
          <span className="chat-item__preview">
            {last?.direction === 'outgoing' && last.status && <StatusTicks status={last.status} error={last.error} />}
            {last ? contentPreview(last.content) : 'Нет сообщений'}
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
