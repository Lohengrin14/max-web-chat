/**
 * Нормализация, проверка и форматирование номеров телефонов.
 *
 * Пользователь вводит номер как привык: «+7 (999) 123-45-67», «8 999 123 45 67»,
 * «9991234567». API (CheckAccount) ждёт только цифры в международном формате и принимает
 * номера РФ (7 + 10 цифр) и РБ (375 + 9 цифр). Проверяем это до запроса: каждая лишняя
 * проверка номера в MAX расходует лимит и может привести к временным ограничениям.
 */

export type PhoneParseResult = { ok: true; digits: string } | { ok: false; error: string };

const RU = /^7\d{10}$/;
const BY = /^375\d{9}$/;

export function normalizePhone(input: string): PhoneParseResult {
  let digits = input.replace(/\D/g, '');
  if (digits === '') return { ok: false, error: 'Введите номер телефона' };

  // Белорусская привычка: 80 вместо +375 (80 29 123-45-67). Проверяем до российской:
  // коды российских номеров не начинаются с 0, так что «80…» однозначно белорусский.
  if (digits.length === 11 && digits.startsWith('80')) digits = `375${digits.slice(2)}`;
  // Российская привычка: 8 вместо +7.
  else if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  // Номер без кода страны: 10 цифр, начинается с 9 (мобильные РФ).
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;

  if (RU.test(digits) || BY.test(digits)) return { ok: true, digits };
  return { ok: false, error: 'Поддерживаются номера России (+7) и Беларуси (+375)' };
}

/** Красивое отображение номера из цифр: +7 999 123-45-67, +375 29 123-45-67. */
export function formatPhone(digits: string): string {
  const ru = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  if (ru) return `+7 ${ru[1]} ${ru[2]}-${ru[3]}-${ru[4]}`;
  const by = /^375(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  if (by) return `+375 ${by[1]} ${by[2]}-${by[3]}-${by[4]}`;
  return /^\d+$/.test(digits) ? `+${digits}` : digits;
}

/** Страна в выборе кода номера. Только те, чьи номера принимает API (см. normalizePhone). */
export interface Country {
  id: string;
  name: string;
  flag: string;
  /** Код страны без «+». */
  dialCode: string;
  /** Внутренний префикс, который набирают вместо кода страны: 8 в РФ, 80 в РБ. */
  trunkPrefix: string;
  /** Длина номера без кода страны. */
  nationalLength: number;
  placeholder: string;
}

export const COUNTRIES: readonly [Country, ...Country[]] = [
  { id: 'ru', name: 'Россия', flag: '🇷🇺', dialCode: '7', trunkPrefix: '8', nationalLength: 10, placeholder: '999 123-45-67' },
  { id: 'by', name: 'Беларусь', flag: '🇧🇾', dialCode: '375', trunkPrefix: '80', nationalLength: 9, placeholder: '29 123-45-67' },
];

/**
 * Номер из поля рядом с выбранным кодом страны → международный вид для normalizePhone.
 * Код страны подставляется, только если пользователь не ввёл его сам: вставленный целиком
 * «+375 29 …», «8 999 …» или «7999…» остаётся как есть.
 */
export function withDialCode(country: Country, input: string): string {
  if (input.trim().startsWith('+')) return input;
  const digits = input.replace(/\D/g, '');
  const { dialCode, trunkPrefix, nationalLength } = country;
  if (digits.length === trunkPrefix.length + nationalLength && digits.startsWith(trunkPrefix)) {
    return `+${dialCode}${digits.slice(trunkPrefix.length)}`;
  }
  if (digits.length === dialCode.length + nationalLength && digits.startsWith(dialCode)) {
    return `+${digits}`;
  }
  return `+${dialCode}${digits}`;
}
