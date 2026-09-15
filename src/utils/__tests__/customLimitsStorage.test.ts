import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredCustomLimits,
  saveStoredCustomLimits,
  migrateCustomLimits,
  clearStoredCustomLimits,
  legacyHashApiKey,
  hashApiKey,
  isLegacyHash,
  DEFAULT_CUSTOM_LIMIT,
} from '../customLimitsStorage';

describe('customLimitsStorage & Hash Migration', () => {
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    mockLocalStorage = {};
    clearStoredCustomLimits();

    const localStorageMock = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
    };

    (globalThis as any).localStorage = localStorageMock;
    vi.restoreAllMocks();
  });

  describe('legacyHashApiKey and isLegacyHash', () => {
    it('should return empty string for empty input', () => {
      expect(legacyHashApiKey('')).toBe('');
      expect(legacyHashApiKey('   ')).toBe('');
    });

    it('should generate a 64-char hex string with repeating 8-char chunks', () => {
      const key = 'AIzaSyTestApiKey12345';
      const legacyHash = legacyHashApiKey(key);
      expect(legacyHash).toHaveLength(64);

      const chunk = legacyHash.slice(0, 8);
      expect(chunk.repeat(8)).toBe(legacyHash);
      expect(isLegacyHash(legacyHash)).toBe(true);
    });

    it('should correctly classify legacy vs standard SHA-256 hashes', () => {
      const key = 'AIzaSyTestApiKey12345';
      const legacy = legacyHashApiKey(key);
      const standardSha256 = hashApiKey(key);

      expect(isLegacyHash(legacy)).toBe(true);
      expect(isLegacyHash(standardSha256)).toBe(false);
      expect(isLegacyHash('short_hash')).toBe(true);
      expect(isLegacyHash('')).toBe(false);
    });
  });

  describe('migrateCustomLimits', () => {
    it('should migrate legacy hash entries to standard SHA-256', () => {
      const key1 = 'AIzaSyKeyOne_11111111111111111111';
      const key2 = 'AIzaSyKeyTwo_22222222222222222222';
      const legacyHash1 = legacyHashApiKey(key1);
      const legacyHash2 = legacyHashApiKey(key2);
      const sha256Hash1 = hashApiKey(key1);
      const sha256Hash2 = hashApiKey(key2);

      // Pre-populate storage with legacy hashes
      saveStoredCustomLimits({
        [legacyHash1]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 100 },
        [legacyHash2]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 250 },
      });

      const initial = getStoredCustomLimits();
      expect(initial[legacyHash1]).toEqual({ ...DEFAULT_CUSTOM_LIMIT, maxRpd: 100 });
      expect(initial[legacyHash2]).toEqual({ ...DEFAULT_CUSTOM_LIMIT, maxRpd: 250 });

      // Run migration
      const result = migrateCustomLimits([key1, key2]);

      expect(result.migratedCount).toBe(2);
      expect(result.legacyCount).toBe(0);
      expect(result.currentCount).toBe(2);
      expect(result.migratedKeys).toContain(sha256Hash1);
      expect(result.migratedKeys).toContain(sha256Hash2);

      const updated = getStoredCustomLimits();
      expect(updated[legacyHash1]).toBeUndefined();
      expect(updated[legacyHash2]).toBeUndefined();
      expect(updated[sha256Hash1]).toEqual({ ...DEFAULT_CUSTOM_LIMIT, maxRpd: 100 });
      expect(updated[sha256Hash2]).toEqual({ ...DEFAULT_CUSTOM_LIMIT, maxRpd: 250 });
    });

    it('should preserve existing new hash without overwrite and delete legacy orphan', () => {
      const key = 'AIzaSyExistingNew_33333333333333';
      const legacyHash = legacyHashApiKey(key);
      const newHash = hashApiKey(key);

      saveStoredCustomLimits({
        [legacyHash]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 100 },
        [newHash]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 500 },
      });

      const result = migrateCustomLimits([key]);

      expect(result.migratedCount).toBe(1);
      const updated = getStoredCustomLimits();
      expect(updated[legacyHash]).toBeUndefined();
      expect(updated[newHash]).toEqual({ ...DEFAULT_CUSTOM_LIMIT, maxRpd: 500 });
    });

    it('should handle empty key lists or nonexistent legacy hashes gracefully', () => {
      saveStoredCustomLimits({
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef': {
          ...DEFAULT_CUSTOM_LIMIT,
          maxRpd: 300,
        },
      });

      const resultEmpty = migrateCustomLimits([]);
      expect(resultEmpty.migratedCount).toBe(0);

      const resultNonExistent = migrateCustomLimits(['AIzaSySomeUnrelatedKey_999999']);
      expect(resultNonExistent.migratedCount).toBe(0);
    });
  });
});
