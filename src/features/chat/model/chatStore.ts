/**
 * zustand-хранилище чатов — тонкая обёртка над чистыми функциями из `chatState.ts`.
 *
 * Хранилище создаётся на каждую сессию (а не глобальным синглтоном) и раздаётся через
 * контекст: при выходе из аккаунта оно уничтожается вместе с экраном, и переписка одного
 * инстанса не может «протечь» в сессию другого. Действия лежат в отдельном стабильном
 * объекте `actions`, чтобы компоненты подписывались на данные, а не на функции.
 */
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChatId, ChatInfo, ConnectionState, MessengerEvent } from '@/domain/models';
import {
  addPendingMessage,
  applyEvent,
  confirmMessage,
  createInitialChatState,
  failMessage,
  openChat,
  selectChat,
  setConnection,
  setSetupWarnings,
  setSyncIssue,
  type ChatState,
  type SyncIssue,
} from './chatState';

export interface ChatActions {
  applyEvent(event: MessengerEvent): void;
  openChat(info: ChatInfo): void;
  selectChat(chatId: ChatId | null): void;
  addPending(input: { tempId: string; chatId: ChatId; text: string; timestamp: number }): void;
  confirm(input: { chatId: ChatId; tempId: string; id: string }): void;
  fail(input: { chatId: ChatId; tempId: string; error: string }): void;
  setConnection(state: ConnectionState): void;
  setSyncIssue(issue: SyncIssue | null): void;
  setSetupWarnings(warnings: string[]): void;
}

export type ChatStore = ChatState & { actions: ChatActions };

export function createChatStore(now: () => number = Date.now): StoreApi<ChatStore> {
  return createStore<ChatStore>()((set) => {
    const update = (transition: (state: ChatState) => ChatState) => set((store) => transition(store));
    return {
      ...createInitialChatState(),
      actions: {
        applyEvent: (event) => update((s) => applyEvent(s, event)),
        openChat: (info) => update((s) => openChat(s, info, now())),
        selectChat: (chatId) => update((s) => selectChat(s, chatId)),
        addPending: (input) => update((s) => addPendingMessage(s, input)),
        confirm: (input) => update((s) => confirmMessage(s, input)),
        fail: (input) => update((s) => failMessage(s, input)),
        setConnection: (state) => update((s) => setConnection(s, state)),
        setSyncIssue: (issue) => update((s) => setSyncIssue(s, issue)),
        setSetupWarnings: (warnings) => update((s) => setSetupWarnings(s, warnings)),
      },
    };
  });
}

export const ChatStoreContext = createContext<StoreApi<ChatStore> | null>(null);

export function useChatStoreApi(): StoreApi<ChatStore> {
  const store = useContext(ChatStoreContext);
  if (!store) throw new Error('useChatStore должен вызываться внутри ChatStoreContext');
  return store;
}

/**
 * Подписка на часть состояния. Селектор должен возвращать стабильные ссылки
 * (поле состояния, а не новый массив) — производные данные считайте через useMemo.
 */
export function useChatStore<T>(selector: (state: ChatStore) => T): T {
  return useStore(useChatStoreApi(), selector);
}

export function useChatActions(): ChatActions {
  return useChatStore((s) => s.actions);
}
