/**
 * Раздел «Чаты»: колонка со списком чатов и окно переписки. Обе колонки встают прямо
 * в сетку каркаса (app/shell), поэтому компонент возвращает фрагмент.
 *
 * Подписка на события и загрузка недавних чатов запускаются здесь — один раз на раздел.
 * Хранилище создаёт каркас: раздел только читает и меняет его.
 */
import { useState } from "react";
import { useSession } from "@/features/auth/SessionProvider";
import { Button } from "@/ui/Button";
import { LogoutIcon, PlusIcon } from "@/ui/icons";
import { useMessengerSync } from "../hooks/useMessengerSync";
import { useRecentChats } from "../hooks/useRecentChats";
import { useChatStore } from "../model/chatStore";
import { ChatList } from "./ChatList";
import { ChatSearch } from "./ChatSearch";
import { ChatWindow } from "./ChatWindow";
import { ConnectionBanner } from "./ConnectionBanner";
import { NewChatDialog } from "./NewChatDialog";
import { StatusHint } from "./StatusHint";
import "./ChatScreen.css";

export function ChatScreen() {
  const { state } = useSession();
  const { retry } = useMessengerSync();
  const { retry: retryRecent } = useRecentChats();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const [query, setQuery] = useState("");

  return (
    <>
      <aside className="sidebar" aria-label="Чаты">
        <SidebarHeader />
        <ConnectionBanner onRetry={retry} />
        <ChatSearch value={query} onChange={setQuery} />
        {/* Ссылка «Профиль» ведёт на инстанс, поэтому подсказка — только в боевом режиме. */}
        {state.status === "authenticated" && state.config.mode === "live" && (
          <StatusHint instanceId={state.config.credentials.instanceId} />
        )}
        <ChatList query={query} onRetryRecent={retryRecent} />
      </aside>
      <main className="pane">
        {activeChatId ? (
          <ChatWindow key={activeChatId} chatId={activeChatId} />
        ) : (
          // Как в MAX: без открытого чата справа только фон. Текст — для скринридеров.
          <p className="visually-hidden">
            Чат не выбран. Выберите чат в списке или начните новый по номеру
            телефона.
          </p>
        )}
      </main>
    </>
  );
}

function SidebarHeader() {
  const { logout } = useSession();
  const [newChatOpen, setNewChatOpen] = useState(false);

  return (
    <header className="sidebar__header">
      <div className="sidebar__heading">
        <h1 className="sidebar__title">Чаты</h1>
      </div>
      <Button
        variant="icon"
        className="sidebar__new-chat"
        onClick={() => setNewChatOpen(true)}
        aria-label="Новый чат"
        title="Новый чат"
      >
        <PlusIcon width={18} height={18} strokeWidth={2.4} />
      </Button>
      {newChatOpen && <NewChatDialog onClose={() => setNewChatOpen(false)} />}
      {/* На широком экране выход — в навигационной колонке, на узком — здесь. */}
      <Button
        variant="icon"
        className="sidebar__logout"
        onClick={() => logout()}
        aria-label="Выйти"
        title="Выйти"
      >
        <LogoutIcon />
      </Button>
    </header>
  );
}
