/** Узкая навигационная колонка слева: разделы, выход и аккаунт. */
import { useSession } from '@/features/auth/SessionProvider';
import { useChatActions } from '@/features/chat/model/chatStore';
import { Avatar } from '@/ui/Avatar';
import { ChatsIcon, LogoutIcon } from '@/ui/icons';
import './NavigationRail.css';

function useInstanceLabel(): string {
  const { state } = useSession();
  return state.status === 'authenticated' && state.config.mode === 'live'
    ? `Инстанс ${state.config.credentials.instanceId}`
    : 'Демо-режим';
}

export function NavigationRail() {
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
