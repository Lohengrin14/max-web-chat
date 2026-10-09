/**
 * Содержимое сообщения GREEN-API → доменное MessageContent.
 *
 * Общее для уведомлений и журналов: поля у них называются по-разному, но вид содержимого
 * определяется одинаково — по typeMessage. Новый поддерживаемый вид добавляется здесь.
 */
import type { MessageContent, UnsupportedContentKind } from '@/domain/models';

const UNSUPPORTED_KINDS: Partial<Record<string, UnsupportedContentKind>> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  locationMessage: 'location',
  contactMessage: 'contact',
  reactionMessage: 'reaction',
};

/**
 * @param input.text текст сообщения, если он есть (textMessage или extendedText —
 * текст со ссылкой; у цитат в MAX тоже textMessage/extendedText).
 */
export function mapContent(input: { typeMessage: string; text: string | undefined }): MessageContent {
  if (input.text !== undefined) return { kind: 'text', text: input.text };
  return { kind: 'unsupported', contentKind: UNSUPPORTED_KINDS[input.typeMessage] ?? 'other' };
}
