/**
 * Содержимое пузыря сообщения по его виду.
 *
 * switch без default: TypeScript требует вернуть значение из каждой ветки, поэтому
 * новый вариант MessageContent без своего отображения — ошибка компиляции, а не пустой пузырь.
 */
import type { MessageContent as Content } from '@/domain/models';
import { unsupportedLabel } from './preview';

export function MessageContent({ content }: { content: Content }) {
  switch (content.kind) {
    case 'text':
      return <p className="bubble__text">{content.text}</p>;
    case 'unsupported':
      return (
        <p className="bubble__text bubble__text--muted">
          {unsupportedLabel(content.contentKind)} — этот тип сообщений пока не поддерживается
        </p>
      );
  }
}
