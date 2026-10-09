/**
 * Аватар-инициалы с градиентной заливкой, как в MAX. Цвет детерминированно выводится
 * из id, чтобы один и тот же контакт всегда выглядел одинаково; сами градиенты —
 * CSS-переменные темы.
 */
import './Avatar.css';


interface AvatarProps {
  /** Стабильный ключ для выбора цвета. */
  seed: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const PALETTE_SIZE = 6;

export function Avatar({ seed, name, size = 'md' }: AvatarProps) {
  return (
    <span className={`avatar avatar--${size} avatar--c${colorIndex(seed)}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  // Для номера телефона — две последние цифры: так аватары разных номеров различимы.
  if (/^\d+$/.test(words.join(''))) return words.join('').slice(-2);
  const [first, second] = words;
  return ((first?.[0] ?? '') + (second?.[0] ?? '')).toUpperCase();
}

function colorIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % PALETTE_SIZE;
}
