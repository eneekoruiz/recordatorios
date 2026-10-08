import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AIService } from '../../src/services/AIService';
import { getAccountSettings, saveAccountSettings } from '../../src/utils/accountSettings';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const memoryStorage = new MemoryStorage();

beforeEach(() => {
  memoryStorage.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });
});

afterEach(() => memoryStorage.clear());

describe('accountSettings', () => {
  it('keeps settings separate by account and does not expose them to an anonymous session', () => {
    saveAccountSettings('account-a', 'notion', { apiKey: 'secret-a', databaseId: 'db-a' });
    saveAccountSettings('account-b', 'notion', { apiKey: 'secret-b', databaseId: 'db-b' });

    expect(getAccountSettings('account-a', 'notion', { apiKey: '', databaseId: '' })).toEqual({ apiKey: 'secret-a', databaseId: 'db-a' });
    expect(getAccountSettings('account-b', 'notion', { apiKey: '', databaseId: '' })).toEqual({ apiKey: 'secret-b', databaseId: 'db-b' });
    expect(getAccountSettings(null, 'notion', { apiKey: '', databaseId: '' })).toEqual({ apiKey: '', databaseId: '' });
  });

  it('never assigns unowned legacy settings to whichever account signs in first', () => {
    memoryStorage.setItem('notion_api_key', 'legacy-secret');
    memoryStorage.setItem('notion_db_id', 'legacy-db');
    const defaults = { apiKey: '', databaseId: '' };
    const legacy = { apiKey: 'notion_api_key', databaseId: 'notion_db_id' };

    expect(getAccountSettings(null, 'notion', defaults, legacy)).toEqual(defaults);
    expect(memoryStorage.getItem('notion_api_key')).toBe('legacy-secret');
    expect(getAccountSettings('account-a', 'notion', defaults, legacy)).toEqual(defaults);
    expect(getAccountSettings('account-b', 'notion', defaults, legacy)).toEqual(defaults);
    expect(memoryStorage.getItem('notion_api_key')).toBe('legacy-secret');
    expect(memoryStorage.getItem('notion_db_id')).toBe('legacy-db');
  });

  it('migrates a legacy group only to the account named by its existing owner marker and only once', () => {
    memoryStorage.setItem('notion_api_key', 'owned-legacy-secret');
    memoryStorage.setItem('notion_db_id', 'owned-legacy-db');
    memoryStorage.setItem('recordatorios:account-settings:legacy-owner:v1:notion', 'account-a');
    const defaults = { apiKey: '', databaseId: '' };
    const legacy = { apiKey: 'notion_api_key', databaseId: 'notion_db_id' };

    expect(getAccountSettings('account-b', 'notion', defaults, legacy)).toEqual(defaults);
    expect(memoryStorage.getItem('notion_api_key')).toBe('owned-legacy-secret');
    expect(getAccountSettings('account-a', 'notion', defaults, legacy)).toEqual({ apiKey: 'owned-legacy-secret', databaseId: 'owned-legacy-db' });
    expect(getAccountSettings('account-b', 'notion', defaults, legacy)).toEqual(defaults);
    expect(memoryStorage.getItem('notion_api_key')).toBeNull();
    expect(memoryStorage.getItem('notion_db_id')).toBeNull();
  });

  it('keeps a guest-scoped setting separate from a registered account', () => {
    const defaults = { provider: 'auto' as const, apiKey: undefined };
    saveAccountSettings('local_guest_123', 'ai-assistant', { provider: 'gemini', apiKey: 'guest-secret' });
    expect(getAccountSettings('local_guest_123', 'ai-assistant', defaults)).toEqual({ provider: 'gemini', apiKey: 'guest-secret' });
    expect(getAccountSettings('account-a', 'ai-assistant', defaults)).toEqual(defaults);
  });

  it('leaves legacy settings unclaimed by a guest, then migrates them once to a known account', () => {
    const defaults = { provider: 'auto' as const, apiKey: undefined };
    memoryStorage.setItem('ai_assistant_config', JSON.stringify({ provider: 'openai', apiKey: 'legacy-secret' }));
    memoryStorage.setItem('recordatorios:account-settings:legacy-owner:v1:ai-assistant', 'account-a');
    expect(getAccountSettings('local_guest_123', 'ai-assistant', defaults, { config: 'ai_assistant_config' })).toEqual(defaults);
    expect(getAccountSettings('account-a', 'ai-assistant', defaults, { config: 'ai_assistant_config' })).toEqual({ provider: 'openai', apiKey: 'legacy-secret' });
  });

  it('stores AIService config in the requested account scope', () => {
    expect(AIService.saveConfig({ provider: 'openai', apiKey: 'secret-a' }, 'account-a')).toBe(true);
    expect(AIService.saveConfig({ provider: 'gemini', apiKey: 'secret-b' }, 'account-b')).toBe(true);

    expect(AIService.getConfig('account-a')).toEqual({ provider: 'openai', apiKey: 'secret-a' });
    expect(AIService.getConfig('account-b')).toEqual({ provider: 'gemini', apiKey: 'secret-b' });
    expect(AIService.getConfig(null)).toEqual({ provider: 'auto' });
  });

  it('reports account-setting and AI config write failures', () => {
    const originalSetItem = memoryStorage.setItem.bind(memoryStorage);
    memoryStorage.setItem = (key, value) => {
      if (key.startsWith('recordatorios:account-settings:v1:')) throw new Error('storage unavailable');
      originalSetItem(key, value);
    };
    try {
      expect(saveAccountSettings('account-a', 'notion', { apiKey: 'draft' })).toBe(false);
      expect(AIService.saveConfig({ provider: 'openai', apiKey: 'draft' }, 'account-a')).toBe(false);
    } finally {
      memoryStorage.setItem = MemoryStorage.prototype.setItem;
    }
  });
});
