# AGENTS.md

## Обзор
Веб-чат для мессенджера MAX поверх GREEN-API: вход по данным инстанса (`apiUrl`, `idInstance`, `apiTokenInstance`), новый чат по номеру телефона, отправка и приём текстовых сообщений в реальном времени. Только фронтенд (React 19, TypeScript, Vite), своего бэкенда нет. Описание для людей — в `README.md`.

## Команды
- `npm run dev` — dev-сервер, http://localhost:5173
- `npm test` — vitest (jsdom), однократный прогон
- `npm run typecheck` — tsc для приложения и конфигов
- `npm run build` — typecheck + сборка в `dist/`

Без аккаунта GREEN-API приложение проверяется в демо-режиме: кнопка на экране входа, реализация — `src/infrastructure/mock/MockGateway.ts`.

Деплой — GitHub Pages: push в `main` запускает `.github/workflows/deploy.yml` (тесты → сборка → публикация).

## Архитектура
Порты и адаптеры. Импорты из `src` — через алиас `@/`.
- `domain/` — модели, порты (`MessengerGateway`, `NotificationSource`, `CredentialsStore`), доменные ошибки. Без React и без GREEN-API.
- `infrastructure/` — реализации портов: `http/HttpClient`, `greenapi/` (zod-схемы, мапперы, `HttpPollingSource`, `GreenApiGateway`), `mock/`, `auth/`.
- `features/` — `auth` (сессия, `useGateway()`), `chat` (`model/` — состояние, `hooks/`, `ui/`).
- `ui/` — примитивы без знания о чатах; `shared/` — утилиты без React.
- `app/` — `composition.ts` (единственное место выбора реализаций), каркас `shell/`, тема, глобальные стили.

Зависимости: app → features → domain ← infrastructure. `features/` и `ui/` не импортируют `infrastructure/`.

## Правила
- Поля и методы GREEN-API (`typeWebhook`, `idMessage`, `textMessageData`…) — только в `infrastructure/greenapi/`. Остальной код работает с типами из `domain/models.ts`.
- Токен подставляется в URL только в `HttpClient`. Не логировать URL запросов и не включать токен в тексты ошибок.
- Адаптеры бросают ошибки из `domain/errors.ts`, а не HTTP-ответы.
- Хуки получают шлюз через `useGateway()`; реализации шлюза из features не импортируются.
- `ChatId` — branded type, создаётся только `toChatId()` в адаптерах. Отправка — только по chatId из CheckAccount (`findContactByPhone`), не по `номер@c.us`: иначе ответы и статусы придут с другим chatId.
- Приём — последовательный long polling в `HttpPollingSource`: без `setInterval` и параллельных запросов к очереди, один источник на сессию (`common/sharedSubscription`). DeleteNotification вызывается и при ошибке обработчика.
- Ответы и уведомления проверяются zod-схемами. Незнакомое или битое уведомление — `null` из маппера, а не исключение.
- Состояние чатов — чистые функции в `features/chat/model/` (`messages`, `chats`, `sync`, `chatState`); `chatStore.ts` только вызывает их. Сообщения — upsert по id, статус только растёт (`mergeStatus`), `failed` финален.
- Лимиты API: CheckAccount — только по явному действию пользователя, не на ввод; GetChatHistory — один раз на чат. Лимиты для UI берутся из `gateway.capabilities`, не хардкодятся.
- TypeScript strict с `noUncheckedIndexedAccess`; `any` не используется.
- Пути к файлам из `public/` — через `import.meta.env.BASE_URL`, не `"/file"`: на GitHub Pages сайт живёт по подпути (`BASE_PATH` в workflow).
- Стили — `Foo.css` рядом с `Foo.tsx`, импортируется самим компонентом. Цвета — только переменные из `app/styles/tokens.css`, тёмная тема — `:root[data-theme='dark']`. UI-библиотек нет, иконки — inline SVG в `ui/icons.tsx`.

## Как добавлять
- Метод API: метод порта в `domain/ports.ts` → схема в `greenapi/schemas.ts` и реализация в `GreenApiGateway` → реализация в `MockGateway` с поведением настоящего API → тест в `GreenApiGateway.test.ts`.
- Тип уведомления: схема → маппер в `greenapi/mappers/` → вариант `MessengerEvent`, если нужен → переход в `features/chat/model/` → тесты маппера и состояния.
- Вид содержимого сообщения: вариант `MessageContent` → `greenapi/mappers/content.ts` → `features/chat/ui/content/`. `switch` без `default` покажет пропущенные места ошибкой компиляции.

## Стиль
- Комментарии — на русском и объясняют «почему». Тексты интерфейса и ошибок — на русском.
- Линтера и форматтера нет: следуй стилю файла (в большинстве — одинарные кавычки).
- Тесты — `*.test.ts` рядом с модулем; `*.test.tsx` vitest не подхватит (`include` в `vite.config.ts`). `fetch` и `sleep` подменяются через конструктор и опции — без реальной сети и таймеров.

## Перед завершением задачи
Должны пройти `npm run typecheck` и `npm test`. При изменении UI — ещё `npm run build` и проверка в `npm run dev` (демо-режим).

## Документация GREEN-API
- [chatId в MAX](https://green-api.com/v3/docs/api/chat-id/)
- [SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/)
- [HTTP API: ReceiveNotification и DeleteNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/)
- [CheckAccount](https://green-api.com/v3/docs/api/service/CheckAccount/)
- [Статусы исходящих сообщений](https://green-api.com/v3/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/)
- [GetChatHistory](https://green-api.com/v3/docs/api/journals/GetChatHistory/)
