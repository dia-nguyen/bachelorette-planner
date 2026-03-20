const CACHE_PREFIX = "bp-offline-v1";

interface CacheEnvelope<T> {
  savedAt: string;
  value: T;
}

export function createOfflineCacheKey(...segments: string[]): string {
  return [CACHE_PREFIX, ...segments].join(":");
}

export function readOfflineCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || !("value" in parsed)) {
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

export function writeOfflineCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    const payload: CacheEnvelope<T> = {
      savedAt: new Date().toISOString(),
      value,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore write errors (quota/private mode); app should keep working.
  }
}

export function removeOfflineCacheByPrefix(prefix: string): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage access errors.
  }
}
