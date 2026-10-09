import { describe, expect, it } from 'vitest';
import { isSecureApiUrl } from './url';

describe('isSecureApiUrl', () => {
  it.each([
    'https://1103.api.green-api.com',
    'https://1103.api.green-api.com/',
    'HTTPS://api.green-api.com',
    'http://localhost:5173',
    'http://127.0.0.1:8080/api',
    'http://[::1]:3000',
  ])('пропускает %s', (url) => {
    expect(isSecureApiUrl(url)).toBe(true);
  });

  it.each([
    // Главное: по http токен ушёл бы открытым текстом.
    'http://1103.api.green-api.com',
    'http://192.168.1.10:8080',
    'ftp://api.green-api.com',
    'api.green-api.com',
    'https://',
    '',
  ])('отклоняет «%s»', (url) => {
    expect(isSecureApiUrl(url)).toBe(false);
  });
});
