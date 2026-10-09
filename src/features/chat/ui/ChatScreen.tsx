/**
 * Основной экран: сайдбар со списком чатов и окно переписки.
 *
 * Экран владеет хранилищем чатов текущей сессии (создаёт его при монтировании), поэтому
 * выход из аккаунта автоматически очищает переписку. Подписка на события запускается
 * здесь же — один раз на экран.
 *
 * На узких экранах (до 760px) показывается либо список, либо открытый чат: режим задаёт
 * атрибут data-view, а раскладку — CSS.
 */
import { useState } from 'react';
import type { ConnectionState } from '@/domain/models';
import { useSession } from '@/features/auth/SessionProvider';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { ChatBubbleIcon, LogoutIcon } from '@/ui/icons';
import { useMessengerSync } from '../hooks/useMessengerSync';
import type { SyncIssue } from '../model/chatState';
import { ChatStoreContext, createChatStore, useChatStore } from '../model/chatStore';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { NewChatForm } from './NewChatForm';

export function ChatScreen() {
  const [store] = useState(() => createChatStore());
  return (
    <ChatStoreContext.Provider value={store}>
      <ChatLayout />
    </ChatStoreContext.Provider>
  );
}

function ChatLayout() {
  const { retry } = useMessengerSync();
  const activeChatId = useChatStore((s) => s.activeChatId);

  return (
    <div className="shell" data-view={activeChatId ? 'chat' : 'list'}>
      <aside className="sidebar" aria-label="Чаты">
        <SidebarHeader />
        <ConnectionBanner onRetry={retry} />
        <NewChatForm />
        <ChatList />
      </aside>
      <main className="pane">
        {activeChatId ? (
          <ChatWindow key={activeChatId} chatId={activeChatId} />
        ) : (
          <div className="pane__empty">
            <ChatBubbleIcon width={40} height={40} />
            <p>Выберите чат слева или начните новый по номеру телефона</p>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarHeader() {
  const { state, logout } = useSession();
  const label =
    state.status === 'authenticated' && state.config.mode === 'live'
      ? `Инстанс ${state.config.credentials.instanceId}`
      : 'Демо-режим';

  return (
    <header className="sidebar__header">
      <img src="/favicon.svg" alt="" width={32} height={32} />
      <div className="sidebar__title">
        <span className="sidebar__app">MAX Web Chat</span>
        <span className="sidebar__instance">{label}</span>
      </div>
      <Button variant="icon" onClick={() => logout()} aria-label="Выйти" title="Выйти">
        <LogoutIcon />
      </Button>
    </header>
  );
}

const CONNECTION_WARNINGS: Partial<Record<ConnectionState, string>> = {
  notAuthorized: 'Аккаунт MAX не авторизован в инстансе. Отсканируйте QR-код в личном кабинете GREEN-API.',
  starting: 'Инстанс запускается — сообщения начнут приходить через пару минут.',
  blocked: 'Аккаунт MAX заблокирован.',
  restricted: 'На аккаунте временные ограничения: отправка возможна только на номера из контактов.',
};

function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  const connection = useChatStore((s) => s.connection);
  const syncIssue = useChatStore((s) => s.syncIssue);
  const warning = CONNECTION_WARNINGS[connection];

  if (!warning && !syncIssue) return null;
  return (
    <div className="sidebar__banners">
      {warning && <Alert tone="warning">{warning}</Alert>}
      {syncIssue && <SyncIssueAlert issue={syncIssue} onRetry={onRetry} />}
    </div>
  );
}

function SyncIssueAlert({ issue, onRetry }: { issue: SyncIssue; onRetry: () => void }) {
  if (issue.fatal) {
    return (
      <Alert
        tone="error"
        action={
          <Button variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        }
      >
        {issue.message}
      </Alert>
    );
  }
  return <Alert tone="warning">{issue.message} Переподключаемся…</Alert>;
}
