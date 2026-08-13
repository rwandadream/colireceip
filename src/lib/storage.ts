export const AUTH_STORAGE_KEYS = ['groupe-gaff-auth', 'sarah-groupe-auth'] as const;
export const THEME_STORAGE_KEYS = ['groupe-gaff-theme', 'sarah-groupe-theme'] as const;

export function readStorageValue(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function writeStorageJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readStorageJson<T>(keys: readonly string[]): T | null {
  const rawValue = readStorageValue(keys);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function clearStorageKeys(keys: readonly string[]): void {
  for (const key of keys) {
    localStorage.removeItem(key);
  }
}
