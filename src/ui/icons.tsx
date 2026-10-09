/**
 * Набор inline-SVG иконок. Свои иконки вместо библиотеки: их немного, а лишняя
 * зависимость весила бы больше, чем весь интерфейс. Иконки декоративные (aria-hidden):
 * доступное имя задаёт кнопка или подпись рядом.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12h11" />
    <path d="M3.4 4.6 20.5 12 3.4 19.4a.6.6 0 0 1-.8-.75L5 12 2.6 5.35a.6.6 0 0 1 .8-.75Z" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 18 9 12l6-6" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17 5 12l5-5" />
    <path d="M5 12h11" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon viewBox="0 0 16 16" strokeWidth="1.5" {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5.2V8l1.8 1.2" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon viewBox="0 0 16 16" strokeWidth="1.6" {...p}>
    <path d="m3 8.5 3 3 7-7" />
  </Icon>
);

export const DoubleCheckIcon = (p: IconProps) => (
  <Icon viewBox="0 0 20 16" strokeWidth="1.6" {...p}>
    <path d="m1.5 8.5 3 3 7-7" />
    <path d="m8.5 11.5 7-7" />
    <path d="m7.4 10.4 1.1 1.1" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon viewBox="0 0 16 16" strokeWidth="1.6" {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 4.8v3.6" />
    <path d="M8 11.1v.1" />
  </Icon>
);

export const ChatBubbleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12Z" />
  </Icon>
);

export const ChatsIcon = (p: IconProps) => (
  <Icon strokeWidth="1.8" {...p}>
    <path d="M12 3.5c4.97 0 9 3.58 9 8s-4.03 8-9 8c-1.13 0-2.2-.18-3.2-.52L4 20.5l1.33-3.98A7.5 7.5 0 0 1 3 11.5c0-4.42 4.03-8 9-8Z" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </Icon>
);
