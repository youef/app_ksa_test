import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const CACHE_PREFIX = 'hayna_cache_';
const DEFAULT_TTL_MS = 1000 * 60 * 15; // 15 minutes

/**
 * Saves arbitrary serializable data to local storage with TTL.
 */
export async function setCachedData<T>(
  key: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (err) {
    console.warn('[offlineCache] Failed to set cache for key:', key, err);
  }
}

/**
 * Retrieves cached data if still within TTL. If allowExpired is true, returns even if expired (great for offline fallback).
 */
export async function getCachedData<T>(
  key: string,
  allowExpired: boolean = false
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > entry.ttlMs;

    if (isExpired && !allowExpired) {
      return null;
    }
    return entry.data;
  } catch (err) {
    console.warn('[offlineCache] Failed to read cache for key:', key, err);
    return null;
  }
}

/**
 * Deletes a specific cache key.
 */
export async function removeCachedData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch (err) {
    console.warn('[offlineCache] Failed to remove cache for key:', key, err);
  }
}

/**
 * High-resilience fetch wrapper:
 * 1. Checks cache first for immediate render.
 * 2. Attempts fresh network fetch.
 * 3. On success, updates cache and returns fresh data.
 * 4. On failure (offline / timeout), gracefully falls back to cached data without throwing an error!
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttlMs?: number;
    forceRefresh?: boolean;
    onCachedData?: (data: T) => void;
  }
): Promise<{ data: T | null; isFromCache: boolean; error?: any }> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  // 1. If not forcing refresh, attempt to serve from cache immediately to UI callback
  if (!options?.forceRefresh) {
    const cached = await getCachedData<T>(key, true);
    if (cached !== null && options?.onCachedData) {
      options.onCachedData(cached);
    }
  }

  // 2. Attempt network fetch
  try {
    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
      void setCachedData(key, fresh, ttlMs);
    }
    return { data: fresh, isFromCache: false };
  } catch (err) {
    console.warn(`[offlineCache] Network failed for '${key}', attempting offline fallback...`, err);
    // 3. Network failed: fallback to expired cache if available
    const fallback = await getCachedData<T>(key, true);
    if (fallback !== null) {
      return { data: fallback, isFromCache: true, error: err };
    }
    return { data: null, isFromCache: false, error: err };
  }
}
