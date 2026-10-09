/**
 * Основной экран в раскладке веб-версии MAX: узкая навигационная колонка, список чатов
 * и окно переписки.
 *
 * Экран владеет хранилищем чатов текущей сессии (создаёт его при монтировании), поэтому
 * выход из аккаунта автоматически очищает переписку. Подписка на события запускается
 * здесь же — один раз на экран.
 *
 * На узких экранах (до 760px) навигационная колонка скрывается, и показывается либо
 * список, либо открытый чат: режим задаёт атрибут data-view, а раскладку — CSS.
 */
import { useState } from 'react';
import type { ConnectionState } from '@/domain/models';
import { useSession } from '@/features/auth/SessionProvider';
import { Alert } from '@/ui/Alert';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { ChatBubbleIcon, ChatsIcon, LogoutIcon } from '@/ui/icons';
import { useMessengerSync } from '../hooks/useMessengerSync';
import { useRecentChats } from '../hooks/useRecentChats';
import type { SyncIssue } from '../model/chatState';
import { ChatStoreContext, createChatStore, useChatActions, useChatStore } from '../model/chatStore';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { NewChatForm } from './NewChatForm';
import { StatusHint } from './StatusHint';

export function ChatScreen() {
  const [store] = useState(() => createChatStore());
  return (
    <ChatStoreContext.Provider value={store}>
      <ChatLayout />
    </ChatStoreContext.Provider>
  );
}

function useInstanceLabel(): string {
  const { state } = useSession();
  return state.status === 'authenticated' && state.config.mode === 'live'
    ? `Инстанс ${state.config.credentials.instanceId}`
    : 'Демо-режим';
}

function ChatLayout() {
  const { state } = useSession();
  const { retry } = useMessengerSync();
  const { retry: retryRecent } = useRecentChats();
  const activeChatId = useChatStore((s) => s.activeChatId);

  return (
    <div className="shell" data-view={activeChatId ? 'chat' : 'list'}>
      <NavigationRail />
      <aside className="sidebar" aria-label="Чаты">
        <SidebarHeader />
        <ConnectionBanner onRetry={retry} />
        <NewChatForm />
        {/* Ссылка «Профиль» ведёт на инстанс, поэтому подсказка — только в боевом режиме. */}
        {state.status === 'authenticated' && state.config.mode === 'live' && (
          <StatusHint instanceId={state.config.credentials.instanceId} />
        )}
        <ChatList onRetryRecent={retryRecent} />
      </aside>
      <main className="pane">
        {activeChatId ? (
          <ChatWindow key={activeChatId} chatId={activeChatId} />
        ) : (
          <div className="pane__empty">
            <span className="capsule">
              <ChatBubbleIcon width={16} height={16} />
              Выберите чат или начните новый по номеру телефона
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

function NavigationRail() {
  const { logout } = useSession();
  const { selectChat } = useChatActions();
  const label = useInstanceLabel();

  return (
    <nav className="rail" aria-label="Разделы">
      <button type="button" className="rail__item rail__item--active" aria-current="page" onClick={() => selectChat(null)}>
        <ChatsIcon width={24} height={24} />
        <span>Чаты</span>
      </button>
      <div className="rail__bottom">
        <button type="button" className="rail__item" onClick={() => logout()}>
          <LogoutIcon width={24} height={24} />
          <span>Выйти</span>
        </button>
        <span className="rail__profile" title={label}>
          <Avatar seed={label} name={label === 'Демо-режим' ? 'Демо' : label.replace(/\D/g, '')} size="sm" />
        </span>
      </div>
    </nav>
  );
}

function SidebarHeader() {
  const { logout } = useSession();
  const label = useInstanceLabel();

  return (
    <header className="sidebar__header">
      <div className="sidebar__heading">
        <h1 className="sidebar__title">Чаты</h1>
        <span className="sidebar__instance">{label}</span>
      </div>
      {/* На широком экране выход — в навигационной колонке, на узком — здесь. */}
      <Button variant="icon" className="sidebar__logout" onClick={() => logout()} aria-label="Выйти" title="Выйти">
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
