/**
 * Текст с подсвеченными вхождениями запроса — для результатов поиска.
 * Сравнение без учёта регистра и «ё», как в searchChats: замена ё→е не меняет длину
 * строки, поэтому позиции в нормализованном тексте совпадают с исходными.
 */
import type { ReactNode } from 'react';
import { normalizeSearchText } from '../model/chatSearch';
import './Highlight.css';

export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return text;
  const haystack = normalizeSearchText(text);
  // toLowerCase в редких случаях меняет длину строки — тогда просто без подсветки.
  if (haystack.length !== text.length) return text;

  const parts: ReactNode[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="highlight">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}
