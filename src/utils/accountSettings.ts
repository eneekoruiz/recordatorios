const STORAGE_PREFIX = 'recordatorios:account-settings:v1';
const LEGACY_OWNER_PREFIX = 'recordatorios:account-settings:legacy-owner:v1';
const LEGACY_MIGRATED_PREFIX = 'recordatorios:account-settings:legacy-migrated:v1';

function scopeFor(userId: string | null): string {
  return encodeURIComponent(userId || 'anonymous-device');
}

function scopedKey(userId: string | null, group: string): string {
  return `${STORAGE_PREFIX}:${scopeFor(userId)}:${encodeURIComponent(group)}`;
}

function isKnownAccount(userId: string | null): userId is string {
  return Boolean(userId && !userId.startsWith('local_guest'));
}

function parseLegacyValue(storageKey: string, raw: string): unknown {
  if (storageKey === 'ai_assistant_config' && raw.trimStart().startsWith('{')) {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return raw;
}

function parseScopedValue<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Reads settings for one account. Legacy global settings migrate only when an
 * existing owner marker proves which registered account they belong to. Unowned
 * legacy values remain untouched and are never assigned by inference.
 */
export function getAccountSettings<T extends object>(
  userId: string | null,
  group: string,
  defaults: T,
  legacyKeys: Record<string, string> = {}
): T {
  try {
    const key = scopedKey(userId, group);
    let raw = localStorage.getItem(key);

    if (isKnownAccount(userId)) {
      const ownerKey = `${LEGACY_OWNER_PREFIX}:${encodeURIComponent(group)}`;
      const legacyOwner = localStorage.getItem(ownerKey);
      const migratedKey = `${LEGACY_MIGRATED_PREFIX}:${encodeURIComponent(group)}`;
      if (legacyOwner === userId && localStorage.getItem(migratedKey) !== '1') {
        const migrated: Record<string, unknown> = {};
        const foundLegacyKeys: string[] = [];
        for (const [field, storageKey] of Object.entries(legacyKeys)) {
          const oldValue = localStorage.getItem(storageKey);
          if (oldValue === null) continue;
          foundLegacyKeys.push(storageKey);
          const value = parseLegacyValue(storageKey, oldValue);
          if (value !== undefined) {
            if (storageKey === 'ai_assistant_config' && value && typeof value === 'object' && !Array.isArray(value)) {
              Object.assign(migrated, value);
            } else {
              migrated[field] = value;
            }
          }
        }

        if (foundLegacyKeys.length > 0) {
          if (raw === null) {
            localStorage.setItem(key, JSON.stringify(migrated));
            raw = localStorage.getItem(key);
          }
          // A scoped value already exists, so discard the older value rather than
          // overwriting the current account's explicit settings.
          for (const storageKey of foundLegacyKeys) localStorage.removeItem(storageKey);
          localStorage.setItem(migratedKey, '1');
        }
      }
    }

    return parseScopedValue(raw, defaults);
  } catch {
    return defaults;
  }
}

export function saveAccountSettings<T extends object>(
  userId: string | null,
  group: string,
  settings: T,
  legacyKeys: Record<string, string> = {}
): boolean {
  try {
    // Migrate only owner-attributed legacy values before writing this account's value.
    getAccountSettings(userId, group, settings, legacyKeys);
    localStorage.setItem(scopedKey(userId, group), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
