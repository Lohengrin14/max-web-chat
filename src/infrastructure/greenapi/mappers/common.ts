/** Общие помощники мапперов GREEN-API. */

export function isGroupChat(chatId: string): boolean {
  // В MAX id групповых чатов отрицательные: "-10000000000000".
  return chatId.startsWith('-');
}

export function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
