/** Список чатов: создание и дополнение сведений, активный чат, непрочитанные, порядок. */
import type { Chat, ChatId, ChatInfo } from '@/domain/models';
import type { ChatState } from './state';

/** Открыть чат (создав, если его нет) и сделать активным. */
export function openChat(state: ChatState, info: ChatInfo, now: number): ChatState {
  const withChat = upsertChat(state, info, state.chats[info.id] ? undefined : now);
  return selectChat(withChat, info.id);
}

export function selectChat(state: ChatState, chatId: ChatId | null): ChatState {
  if (chatId === null) return { ...state, activeChatId: null };
  const chat = state.chats[chatId];
  if (!chat) return state;
  return {
    ...state,
    activeChatId: chatId,
    chats: chat.unreadCount ? { ...state.chats, [chatId]: { ...chat, unreadCount: 0 } } : state.chats,
  };
}

/** Создаёт чат или дополняет известные сведения, не затирая их пустыми значениями. */
export function upsertChat(state: ChatState, info: ChatInfo, activity?: number): ChatState {
  const existing = state.chats[info.id];
  if (existing && (!info.title || info.title === existing.title) && (!info.phone || info.phone === existing.phone)) {
    return state;
  }
  const chat: Chat = existing
    ? { ...existing, ...(info.title ? { title: info.title } : {}), ...(info.phone ? { phone: info.phone } : {}) }
    : { ...info, lastActivity: activity ?? 0, unreadCount: 0 };
  return { ...state, chats: { ...state.chats, [info.id]: chat } };
}

/** Сдвигает время последней активности чата и, если нужно, увеличивает счётчик непрочитанных. */
export function touchChat(state: ChatState, chatId: ChatId, timestamp: number, countUnread: boolean): ChatState {
  const chat = state.chats[chatId];
  if (!chat) return state;
  const lastActivity = Math.max(chat.lastActivity, timestamp);
  const unreadCount = chat.unreadCount + (countUnread ? 1 : 0);
  if (lastActivity === chat.lastActivity && unreadCount === chat.unreadCount) return state;
  return { ...state, chats: { ...state.chats, [chatId]: { ...chat, lastActivity, unreadCount } } };
}

/** Чаты по убыванию последней активности. */
export function selectChatList(state: Pick<ChatState, 'chats'>): Chat[] {
  return Object.values(state.chats).sort((a, b) => b.lastActivity - a.lastActivity);
}

export function findChatByPhone(state: ChatState, phone: string): Chat | undefined {
  return Object.values(state.chats).find((c) => c.phone === phone);
}
