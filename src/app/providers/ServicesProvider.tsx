/**
 * DI через React Context: раздаёт приложению сервисы, собранные в composition root.
 *
 * Фичи не импортируют этот модуль — SessionProvider получает зависимости пропсами отсюда.
 * Так направление зависимостей остаётся «app → features», а фичи можно тестировать и
 * переиспользовать с любыми реализациями. `useServices()` — для будущих сервисов уровня
 * приложения (аналитика, логирование), которым не нужна сессия.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { SessionProvider } from '@/features/auth/SessionProvider';
import type { Services } from '../composition';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <ServicesContext.Provider value={services}>
      <SessionProvider gatewayFactory={services.gatewayFactory} credentialsStore={services.credentialsStore}>
        {children}
      </SessionProvider>
    </ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices должен вызываться внутри ServicesProvider');
  return services;
}
