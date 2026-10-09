/**
 * Каркас приложения для вошедшего пользователя: навигационная колонка и раздел.
 *
 * Каркас владеет хранилищем сессии (создаёт его при монтировании) и раздаёт его всем
 * разделам, поэтому выход из аккаунта автоматически очищает переписку: App монтирует
 * каркас заново с key = id сессии.
 *
 * Раздел пока один — чаты; он отдаёт свои колонки (список и окно чата) прямо в сетку
 * каркаса. На узких экранах (до 760px) навигационная колонка скрывается, и показывается
 * либо список, либо открытый чат: режим задаёт атрибут data-view, а раскладку — CSS.
 */
import { useState } from 'react';
import { ChatStoreContext, createChatStore, useChatStore } from '@/features/chat/model/chatStore';
import { ChatScreen } from '@/features/chat/ui/ChatScreen';
import { NavigationRail } from './NavigationRail';
import './AppShell.css';

export function AppShell() {
  const [store] = useState(() => createChatStore());
  return (
    <ChatStoreContext.Provider value={store}>
      <ShellLayout />
    </ChatStoreContext.Provider>
  );
}

function ShellLayout() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  return (
    <div className="shell" data-view={activeChatId ? 'chat' : 'list'}>
      <NavigationRail />
      <ChatScreen />
    </div>
  );
}
