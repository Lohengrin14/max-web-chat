/**
 * Точка входа. StrictMode включён намеренно: двойной вызов эффектов в разработке
 * проверяет, что подписка на уведомления корректно останавливается и не создаёт
 * второй цикл опроса.
 */
// Токены и база — первыми: стили компонентов, подключаемые ниже, опираются на них в каскаде.
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
