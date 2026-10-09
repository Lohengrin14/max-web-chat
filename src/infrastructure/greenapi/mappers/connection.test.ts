import { describe, expect, it } from 'vitest';
import { mapConnectionState } from './connection';

describe('mapConnectionState', () => {
  it('переводит состояния инстанса в доменные', () => {
    expect(mapConnectionState('authorized')).toBe('ready');
    expect(mapConnectionState('notAuthorized')).toBe('notAuthorized');
    expect(mapConnectionState('pendingPassword')).toBe('notAuthorized');
    expect(mapConnectionState('blocked')).toBe('blocked');
    expect(mapConnectionState('starting')).toBe('starting');
    expect(mapConnectionState('suspended')).toBe('restricted');
    expect(mapConnectionState('whatever')).toBe('unknown');
  });
});
