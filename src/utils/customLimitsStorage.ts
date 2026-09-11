import { CustomLimit, DEFAULT_CUSTOM_LIMIT } from '../types/quota';

export const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

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

export type { CustomLimit };
export { DEFAULT_CUSTOM_LIMIT };
