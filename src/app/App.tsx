/**
 * Корневой компонент: выбирает экран по состоянию сессии.
 * Каркас получает key = id сессии, чтобы при смене аккаунта всё его состояние
 * (хранилище, подписка, черновики) создавалось заново.
 */
import { useState } from 'react';
import { LoginPage } from '@/features/auth/LoginPage';
import { useSession } from '@/features/auth/SessionProvider';
import { createServices } from './composition';
import { AppShell } from './shell/AppShell';
import { ServicesProvider } from './providers/ServicesProvider';

export function App() {
  const [services] = useState(createServices);
  return (
    <ServicesProvider services={services}>
      <Screens />
    </ServicesProvider>
  );
}

function Screens() {
  const { state } = useSession();
  return state.status === 'authenticated' ? <AppShell key={state.id} /> : <LoginPage />;
}
