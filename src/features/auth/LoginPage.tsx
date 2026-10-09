/**
 * Экран входа: учётные данные инстанса GREEN-API или демо-режим.
 *
 * Простая проверка формата выполняется здесь, чтобы не тратить запрос (у GetStateInstance
 * лимит 1 запрос в секунду). Настоящую проверку делает SessionProvider.login.
 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { useSession } from "./SessionProvider";

type Field = "apiUrl" | "instanceId" | "apiToken";
type FieldErrors = Partial<Record<Field, string>>;

// Это просто пример валадицаии, я не уверен в ее правильности, для MVP может стоит отключить
function validate(values: Record<Field, string>): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.apiUrl) errors.apiUrl = "Укажите apiUrl";
  else if (!/^https?:\/\/[^\s/]+/i.test(values.apiUrl))
    errors.apiUrl = "Адрес должен начинаться с https://";
  if (!values.instanceId) errors.instanceId = "Укажите idInstance";
  else if (!/^\d+$/.test(values.instanceId))
    errors.instanceId = "idInstance состоит только из цифр";
  if (!values.apiToken) errors.apiToken = "Укажите apiTokenInstance";
  return errors;
}

export function LoginPage() {
  const { state, login, startDemo } = useSession();
  const [values, setValues] = useState<Record<Field, string>>({
    apiUrl: "",
    instanceId: "",
    apiToken: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Причина последнего выхода (например, токен стал недействительным) — пока пользователь не начал новый вход.
  const logoutReason = state.status === "anonymous" ? state.reason : null;
  const message = submitError ?? logoutReason;

  const update = (field: Field) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = {
      apiUrl: values.apiUrl.trim(),
      instanceId: values.instanceId.trim(),
      apiToken: values.apiToken.trim(),
    };
    const errors = validate(trimmed);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setSubmitError(null);
    const error = await login(trimmed);
    // При успехе компонент уже размонтирован — состояние трогаем только при ошибке.
    if (error) {
      setSubmitError(error);
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <header className="login__header">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <h1 className="login__title">Войдите в MAX Web Chat</h1>
          <p className="login__subtitle">
            Укажите параметры{" "}
            <a
              href="https://green-api.com/v3/docs/before-start/#_2"
              target="_blank"
              rel="noopener noreferrer"
            >
              инстанса
            </a>{" "}
            GREEN-API, чтобы отправлять и получать сообщения MAX
          </p>
        </header>

        {message && <Alert tone="error">{message}</Alert>}

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="apiUrl"
            name="apiUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://1103.api.green-api.com"
            value={values.apiUrl}
            onChange={update("apiUrl")}
            error={fieldErrors.apiUrl}
            hint="Адрес API вашего инстанса из личного кабинета"
            spellCheck={false}
            autoFocus
          />
          <TextField
            label="idInstance"
            name="idInstance"
            inputMode="numeric"
            autoComplete="username"
            placeholder="1103000000"
            value={values.instanceId}
            onChange={update("instanceId")}
            error={fieldErrors.instanceId}
            spellCheck={false}
          />
          <TextField
            label="apiTokenInstance"
            name="apiTokenInstance"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••••••"
            value={values.apiToken}
            onChange={update("apiToken")}
            error={fieldErrors.apiToken}
            spellCheck={false}
          />
          <Button type="submit" loading={loading} className="login__submit">
            {loading ? "Проверяем…" : "Войти"}
          </Button>
        </form>

        <Button
          variant="ghost"
          className="login__demo"
          onClick={startDemo}
          disabled={loading}
        >
          Открыть демо-режим без GREEN-API
        </Button>

        <p className="login__note">
          Данные берутся в{" "}
          <a
            href="https://console.green-api.com"
            target="_blank"
            rel="noreferrer"
          >
            личном кабинете GREEN-API
          </a>
          . Они хранятся только в этой вкладке браузера и удаляются при её
          закрытии.{" "}
        </p>
      </div>
    </main>
  );
}
