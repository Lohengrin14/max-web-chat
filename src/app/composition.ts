/**
 * Composition root — единственное место, где выбираются конкретные реализации портов.
 *
 * Остальной код зависит только от интерфейсов из `domain/ports.ts`. Чтобы подключить
 * другой мессенджер, перейти на вебхуки через свой бэкенд или хранить сессию иначе,
 * достаточно поменять строку здесь.
 */
import type { CredentialsStore, GatewayFactory } from '@/domain/ports';
import { SessionCredentialsStore } from '@/infrastructure/auth/SessionCredentialsStore';
import { createGreenApiGateway } from '@/infrastructure/greenapi/GreenApiGateway';
import { MockGateway } from '@/infrastructure/mock/MockGateway';

export interface Services {
  gatewayFactory: GatewayFactory;
  credentialsStore: CredentialsStore;
}

export function createServices(): Services {
  return {
    gatewayFactory: (config) =>
      config.mode === 'demo' ? new MockGateway() : createGreenApiGateway(config.credentials),
    credentialsStore: new SessionCredentialsStore(),
  };
}
