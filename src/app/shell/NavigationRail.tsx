/** Узкая навигационная колонка слева: разделы, тема, выход и аккаунт. */
import { useSession } from "@/features/auth/SessionProvider";
import { useChatActions } from "@/features/chat/model/chatStore";
import { Avatar } from "@/ui/Avatar";
import { ChatsIcon, LogoutIcon, MoonIcon, SunIcon } from "@/ui/icons";
import { useTheme } from "../theme";
import "./NavigationRail.css";

function useInstanceLabel(): string {
  const { state } = useSession();
  return state.status === "authenticated" && state.config.mode === "live"
    ? `Инстанс ${state.config.credentials.instanceId}`
    : "Демо-режим";
}

export function NavigationRail() {
  const { logout } = useSession();
  const { selectChat } = useChatActions();
  const label = useInstanceLabel();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <nav className="rail" aria-label="Разделы">
      <button
        type="button"
        className="rail__item rail__item--active"
        aria-current="page"
        onClick={() => selectChat(null)}
      >
        <ChatsIcon width={24} height={24} />
        <span>Чаты</span>
      </button>
      <div className="rail__bottom">
        {/* Иконка — тема, на которую переключит нажатие: луна в светлой, солнце в тёмной. */}
        <button
          type="button"
          className="rail__item"
          onClick={toggle}
          aria-pressed={dark}
          title={dark ? "Включить светлую тему" : "Включить тёмную тему"}
        >
          {dark ? (
            <SunIcon width={24} height={24} />
          ) : (
            <MoonIcon width={24} height={24} />
          )}
        </button>
        <button type="button" className="rail__item" onClick={() => logout()}>
          <LogoutIcon width={24} height={24} />
          <span>Выйти</span>
        </button>
        <span className="rail__profile" title={label}>
          <Avatar
            seed={label}
            name={label === "Демо-режим" ? "Демо" : label.replace(/\D/g, "")}
            size="sm"
          />
        </span>
      </div>
    </nav>
  );
}
