import type { ConnectionState } from '@/domain/models';

/** Состояния GetStateInstance / stateInstanceChanged → доменное состояние подключения. */
export function mapConnectionState(stateInstance: string): ConnectionState {
  switch (stateInstance) {
    case 'authorized':
      return 'ready';
    case 'starting':
      return 'starting';
    case 'notAuthorized':
    // pendingPassword: аккаунт ждёт ввода пароля — для пользователя это тоже «не авторизован».
    case 'pendingPassword':
      return 'notAuthorized';
    case 'blocked':
      return 'blocked';
    case 'suspended':
      return 'restricted';
    default:
      return 'unknown';
  }
}
