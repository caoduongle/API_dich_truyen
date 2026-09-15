import { CustomLimit, DEFAULT_CUSTOM_LIMIT } from '../types/quota';
import { legacyHashApiKey, hashApiKey, isLegacyHash } from './apiKeyHash';

export const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

export interface CustomLimitMigrationResult {
  migratedCount: number;
  legacyCount: number;
  currentCount: number;
  migratedKeys: string[];
}

let memoryFallback: Record<string, CustomLimit> = {};

/**
 * Loads user-configured custom limits from localStorage safely with in-memory fallback.
 */
export function getStoredCustomLimits(): Record<string, CustomLimit> {
  if (typeof localStorage === 'undefined') {
    return memoryFallback;
  }
  try {
    const raw = localStorage.getItem(CUSTOM_LIMITS_STORAGE_KEY);
    if (!raw) return memoryFallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

/**
 * Saves updated custom limits to localStorage safely, updating memory fallback.
 */
export function saveStoredCustomLimits(limits: Record<string, CustomLimit>): void {
  memoryFallback = { ...limits };
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_LIMITS_STORAGE_KEY, JSON.stringify(limits));
  } catch {}
}

/**
 * Di trú các mục cấu hình hạn mức từ mã băm cũ (32-bit integer fallback) sang SHA-256 mới (64 hex characters)
 */
export function migrateCustomLimits(apiKeys: string[]): CustomLimitMigrationResult {
  const limits = getStoredCustomLimits();
  const cleanKeys = (apiKeys || []).map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);

  let migratedCount = 0;
  const migratedKeys: string[] = [];

  for (const rawKey of cleanKeys) {
    const legacyHash = legacyHashApiKey(rawKey);
    const newHash = hashApiKey(rawKey);

    // Nếu tồn tại bản ghi dưới mã băm cũ
    if (limits[legacyHash]) {
      if (!limits[newHash]) {
        limits[newHash] = { ...limits[legacyHash] };
      }
      delete limits[legacyHash];
      migratedCount++;
      migratedKeys.push(newHash);
    }
  }

  if (migratedCount > 0) {
    saveStoredCustomLimits(limits);
  }

  const allKeys = Object.keys(limits);
  return {
    migratedCount,
    legacyCount: allKeys.filter((k) => isLegacyHash(k)).length,
    currentCount: allKeys.length,
    migratedKeys,
  };
}

/**
 * Clears custom limits from storage and memory (useful for test resets).
 */
export function clearStoredCustomLimits(): void {
  memoryFallback = {};
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CUSTOM_LIMITS_STORAGE_KEY);
    } catch {}
  }
}

export { legacyHashApiKey, hashApiKey, isLegacyHash };
export type { CustomLimit };
export { DEFAULT_CUSTOM_LIMIT };
