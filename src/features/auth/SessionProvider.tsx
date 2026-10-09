/**
 * Сессия пользователя: вход, выход, восстановление после перезагрузки.
 *
 * Провайдер получает фабрику шлюзов и хранилище через пропсы (их передаёт composition
 * root), поэтому не знает, какой мессенджер и какое хранилище используются. Для каждой
 * сессии создаётся свой экземпляр шлюза — его получают компоненты через `useGateway()`.
 *
 * Вход проверяется вызовом GetStateInstance: так неверный токен, отвязанный аккаунт MAX
 * или запускающийся инстанс видны сразу на экране входа, а не после первой неудачной
 * отправки. При восстановлении после F5 проверка не повторяется: если токен перестал
 * действовать, первый же запрос вернёт AuthError и сессия закроется с понятной причиной.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AuthError, errorMessage } from '@/domain/errors';
import type { ConnectionState, Credentials, SessionConfig } from '@/domain/models';
import type { CredentialsStore, GatewayFactory, MessengerGateway } from '@/domain/ports';

type SessionState =
  | { status: 'anonymous'; reason: string | null }
  | {
      status: 'authenticated';
      config: SessionConfig;
      gateway: MessengerGateway;
      id: number;
      /** Состояние, проверенное при входе; null после восстановления из хранилища. */
      verifiedConnection: ConnectionState | null;
    };

export interface SessionContextValue {
  state: SessionState;
  /** Проверяет учётные данные и открывает сессию. Возвращает текст ошибки или null. */
  login(credentials: Credentials): Promise<string | null>;
  startDemo(): void;
  logout(reason?: string): void;
  /** Закрывает сессию, если ошибка означает недействительные учётные данные. */
  handleError(error: unknown): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STATE_ERRORS: Partial<Record<ConnectionState, string>> = {
  notAuthorized: 'Аккаунт MAX не привязан к инстансу. Отсканируйте QR-код в личном кабинете GREEN-API и повторите вход.',
  starting: 'Инстанс запускается. Подождите пару минут и повторите вход.',
  blocked: 'Аккаунт MAX заблокирован. Работа через этот инстанс невозможна.',
  unknown: 'Инстанс вернул неизвестное состояние. Проверьте его в личном кабинете GREEN-API.',
};

let sessionCounter = 0;

interface SessionProviderProps {
  gatewayFactory: GatewayFactory;
  credentialsStore: CredentialsStore;
  children: ReactNode;
}

export function SessionProvider({ gatewayFactory, credentialsStore, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>(() => {
    const saved = credentialsStore.load();
    return saved
      ? { status: 'authenticated', config: saved, gateway: gatewayFactory(saved), id: ++sessionCounter, verifiedConnection: null }
      : { status: 'anonymous', reason: null };
  });

  const open = useCallback(
    (config: SessionConfig, gateway: MessengerGateway, verifiedConnection: ConnectionState | null) => {
      credentialsStore.save(config);
      setState({ status: 'authenticated', config, gateway, id: ++sessionCounter, verifiedConnection });
    },
    [credentialsStore],
  );

  const login = useCallback(
    async (credentials: Credentials) => {
      const config: SessionConfig = { mode: 'live', credentials };
      const gateway = gatewayFactory(config);
      try {
        const connection = await gateway.getConnectionState();
        const problem = STATE_ERRORS[connection];
        if (problem) return problem;
        // 'restricted' не мешает входу: отправка контактам работает, предупреждение покажем в чате.
        open(config, gateway, connection);
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    [gatewayFactory, open],
  );

  const startDemo = useCallback(() => {
    const config: SessionConfig = { mode: 'demo' };
    open(config, gatewayFactory(config), null);
  }, [gatewayFactory, open]);

  const logout = useCallback(
    (reason?: string) => {
      credentialsStore.clear();
      setState({ status: 'anonymous', reason: reason ?? null });
    },
    [credentialsStore],
  );

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AuthError) logout(error.message);
    },
    [logout],
  );

  const value = useMemo(
    () => ({ state, login, startDemo, logout, handleError }),
    [state, login, startDemo, logout, handleError],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession должен вызываться внутри SessionProvider');
  return value;
}

/** Шлюз текущей сессии. Доступен только на экранах для вошедшего пользователя. */
export function useGateway(): MessengerGateway {
  const { state } = useSession();
  if (state.status !== 'authenticated') throw new Error('useGateway вызван без открытой сессии');
  return state.gateway;
}
