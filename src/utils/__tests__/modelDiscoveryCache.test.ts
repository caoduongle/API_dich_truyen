import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDiscoveredModels,
  saveDiscoveredModels,
  getDiscoveredCacheMeta,
  isDiscoveryStale,
  recordDiscoveryError,
  fetchAndCacheDiscoveredModels,
  DISCOVERED_MODELS_TTL_MS,
  DISCOVERED_MODELS_STORAGE_KEY,
} from '../modelRegistry';
import { ModelInfoItem } from '../apiClient';

describe('Model Discovery Cache & SWR Lifecycle (TASK 14)', () => {
  let mockStorage: Record<string, string> = {};

  const storageMock: Storage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = String(value);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      mockStorage = {};
    },
    key: (index: number) => Object.keys(mockStorage)[index] || null,
    get length() {
      return Object.keys(mockStorage).length;
    },
  };

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('User Story 1: Instant UI Render via Stale Cache (MVP)', () => {
    it('returns empty array and reports stale when no cache exists', () => {
      const models = getDiscoveredModels();
      expect(models).toEqual([]);
      expect(isDiscoveryStale()).toBe(true);
      expect(getDiscoveredCacheMeta()).toBeNull();
    });

    it('returns cached models synchronously and reports fresh when within TTL', () => {
      const now = Date.now();
      const mockPayload = {
        version: 1,
        timestamp: now - 10 * 60 * 1000, // 10 minutes ago (Fresh)
        lastRefreshedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        models: [
          {
            id: 'gemini-2.0-flash-exp',
            label: 'Gemini 2.0 Flash Exp',
            source: 'discovered',
          },
        ],
      };
      storageMock.setItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(mockPayload));

      const models = getDiscoveredModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gemini-2.0-flash-exp');

      const meta = getDiscoveredCacheMeta();
      expect(meta).not.toBeNull();
      expect(meta?.isStale).toBe(false);
      expect(meta?.count).toBe(1);
      expect(isDiscoveryStale()).toBe(false);
    });

    it('returns stale cache immediately (SWR) without deleting it when timestamp > 1h TTL', () => {
      const now = Date.now();
      const staleTimestamp = now - 2 * DISCOVERED_MODELS_TTL_MS; // 2 hours ago
      const mockPayload = {
        version: 1,
        timestamp: staleTimestamp,
        lastRefreshedAt: new Date(staleTimestamp).toISOString(),
        models: [
          {
            id: 'gemini-2.0-flash-exp',
            label: 'Gemini 2.0 Flash Exp',
            source: 'discovered',
          },
        ],
      };
      storageMock.setItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(mockPayload));

      // SWR: UI gets data immediately even if stale!
      const models = getDiscoveredModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gemini-2.0-flash-exp');

      // Stale is correctly identified so background refresh can fire
      const meta = getDiscoveredCacheMeta();
      expect(meta?.isStale).toBe(true);
      expect(isDiscoveryStale()).toBe(true);
      // Cache was NOT erased
      expect(storageMock.getItem(DISCOVERED_MODELS_STORAGE_KEY)).not.toBeNull();
    });
  });

  describe('User Story 2: In-Flight Request Deduplication', () => {
    it('deduplicates simultaneous in-flight discovery requests to a single API call', async () => {
      let callCount = 0;
      const apiMock = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [
          {
            name: 'models/gemini-2.0-flash-exp',
            displayName: 'Gemini 2.0 Flash Exp',
            supportedGenerationMethods: ['generateContent'],
          },
        ] as ModelInfoItem[];
      });

      // Dispatch 5 concurrent calls
      const [res1, res2, res3, res4, res5] = await Promise.all([
        fetchAndCacheDiscoveredModels(apiMock, { force: true }),
        fetchAndCacheDiscoveredModels(apiMock, { force: true }),
        fetchAndCacheDiscoveredModels(apiMock, { force: true }),
        fetchAndCacheDiscoveredModels(apiMock, { force: true }),
        fetchAndCacheDiscoveredModels(apiMock, { force: true }),
      ]);

      expect(apiMock).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);
      expect(res1).toHaveLength(1);
      expect(res2).toEqual(res1);
      expect(res3).toEqual(res1);
      expect(res4).toEqual(res1);
      expect(res5).toEqual(res1);
    });
  });

  describe('User Story 3: Transient Failure Resilience (Zero Registry Wipe)', () => {
    it('preserves existing stale cache and records error without wiping storage when API fails', async () => {
      const now = Date.now();
      const mockPayload = {
        version: 1,
        timestamp: now - 3 * DISCOVERED_MODELS_TTL_MS,
        lastRefreshedAt: new Date(now - 3 * DISCOVERED_MODELS_TTL_MS).toISOString(),
        models: [
          {
            id: 'gemini-existing-model',
            label: 'Gemini Existing Model',
            source: 'discovered',
          },
        ],
      };
      storageMock.setItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(mockPayload));

      const apiMockFailing = vi.fn().mockRejectedValue(new Error('HTTP 429: Resource has been exhausted (Quota Exceeded)'));

      // Attempt to refresh
      const result = await fetchAndCacheDiscoveredModels(apiMockFailing, { force: true });

      // Should return the stale models rather than throwing or returning empty
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-existing-model');

      // Check cache still contains the models
      const modelsAfter = getDiscoveredModels();
      expect(modelsAfter).toHaveLength(1);
      expect(modelsAfter[0].id).toBe('gemini-existing-model');

      // Check error is recorded in meta
      const meta = getDiscoveredCacheMeta();
      expect(meta?.lastError).toContain('HTTP 429');
    });

    it('recordDiscoveryError safely sets lastError on cache', () => {
      saveDiscoveredModels([
        {
          name: 'models/gemini-2.0-flash-exp',
          displayName: 'Gemini 2.0 Flash Exp',
          supportedGenerationMethods: ['generateContent'],
        },
      ]);

      recordDiscoveryError('Mất kết nối mạng');
      const meta = getDiscoveredCacheMeta();
      expect(meta?.lastError).toBe('Mất kết nối mạng');
      expect(meta?.count).toBe(1);
    });
  });
});
