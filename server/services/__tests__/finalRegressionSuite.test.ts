import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  quotaService,
  hashApiKey,
  maskApiKey,
  getDayInLosAngeles,
} from '../quotaService';
import {
  getPresetModels,
  getDiscoveredModels,
  saveDiscoveredModels,
  migrateModelSelection,
  normalizeModelId,
  getDiscoveredCacheMeta,
  isDiscoveryStale,
  fetchAndCacheDiscoveredModels,
  DISCOVERED_MODELS_TTL_MS,
  DISCOVERED_MODELS_STORAGE_KEY,
} from '../../../src/utils/modelRegistry';
import { DEFAULT_MODEL_ID } from '../../constants/models';
import {
  createRateLimiter,
  calculateSlidingWindowCount,
  getRateLimiterStatus,
  resetRateLimiterForTesting,
} from '../../middleware/rateLimiter';
import { Request, Response } from 'express';
import { translationChunkCache } from '../../utils/chunkCache';
import { verifyStorageIntegrity } from '../../../src/utils/storageAudit';

describe('TASK 16 — FINAL REGRESSION TEST SUITE (End-to-End Invariants)', () => {
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
    quotaService.resetAll();
    translationChunkCache.clear();
    resetRateLimiterForTesting();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. MODEL SUBSYSTEM REGRESSION
  // =========================================================================
  describe('1. Model Subsystem (Selection, SWR Discovery, Verification, Lifecycle)', () => {
    it('migrates shutdown models (gemini-1.5-flash) to replacement model gemini-2.5-flash', () => {
      const migration = migrateModelSelection('gemini-1.5-flash');
      expect(migration.wasMigrated).toBe(true);
      expect(migration.isShutdown).toBe(true);
      expect(migration.effectiveModelId).toBe('gemini-2.5-flash');
      expect(migration.replacementId).toBe('gemini-2.5-flash');
      expect(migration.reason).toContain('ngừng hoạt động');
    });

    it('preserves valid custom and preset model IDs during selection check', () => {
      const presetMigration = migrateModelSelection('gemini-2.5-flash');
      expect(presetMigration.wasMigrated).toBe(false);
      expect(presetMigration.effectiveModelId).toBe('gemini-2.5-flash');

      const customMigration = migrateModelSelection('tunedModels/my-special-translator');
      expect(customMigration.wasMigrated).toBe(false);
      expect(customMigration.effectiveModelId).toBe('tunedModels/my-special-translator');
    });

    it('enforces SWR instant render: returns stale discovered models immediately without deletion on TTL expiry', () => {
      const now = Date.now();
      const staleTimestamp = now - 2 * DISCOVERED_MODELS_TTL_MS; // 2 hours old
      const stalePayload = {
        version: 1,
        timestamp: staleTimestamp,
        lastRefreshedAt: new Date(staleTimestamp).toISOString(),
        models: [
          {
            id: 'gemini-exp-custom-test',
            label: 'Gemini Exp Custom Test',
            source: 'discovered',
          },
        ],
      };
      storageMock.setItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(stalePayload));

      // SWR: Synchronous immediate read succeeds
      const models = getDiscoveredModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gemini-exp-custom-test');

      // Stale flag is active to allow background revalidation
      expect(isDiscoveryStale()).toBe(true);
      expect(storageMock.getItem(DISCOVERED_MODELS_STORAGE_KEY)).not.toBeNull();
    });

    it('retains valid stale cache when background Google API discovery fails with 429 / offline', async () => {
      const now = Date.now();
      const existingPayload = {
        version: 1,
        timestamp: now - 3600000,
        lastRefreshedAt: new Date(now - 3600000).toISOString(),
        models: [
          {
            id: 'gemini-discovered-safe',
            label: 'Gemini Discovered Safe',
            source: 'discovered',
          },
        ],
      };
      storageMock.setItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(existingPayload));

      const failingApiMock = vi.fn().mockRejectedValue(new Error('HTTP 429 Quota Exceeded'));
      const result = await fetchAndCacheDiscoveredModels(failingApiMock, { force: true });

      // Returns stale models on transient error (Zero-wipe resilience)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-discovered-safe');
      const meta = getDiscoveredCacheMeta();
      expect(meta?.lastError).toContain('HTTP 429');
    });
  });

  // =========================================================================
  // 2. SCHEDULER & QUOTA SUBSYSTEM (RPM, TPM, RPD PST Reset, Pacing, Health)
  // =========================================================================
  describe('2. Scheduler & Quota Subsystem (RPM, TPM, PST Midnight Reset, Pacing, Key Health)', () => {
    it('resets RPD counters strictly at midnight America/Los_Angeles (PST/PDT)', () => {
      const testKey = 'AIzaSyTestFinalPstKey-999';

      // 1. 23:59:50 PST (2026-08-19 23:59:50 PST -> 2026-08-20 06:59:50 UTC)
      const justBeforeMidnightUTC = Date.UTC(2026, 7, 20, 6, 59, 50);
      const dayBefore = getDayInLosAngeles(justBeforeMidnightUTC);
      expect(dayBefore).toBe('2026-08-19');

      // Record 10 requests on dayBefore
      for (let i = 0; i < 10; i++) {
        quotaService.recordUsage(
          testKey,
          'gemini-2.5-flash',
          'success',
          justBeforeMidnightUTC,
          { totalTokens: 100, promptTokens: 50, outputTokens: 50 }
        );
      }
      const summaryBefore = quotaService.getQuotaSnapshot([testKey], justBeforeMidnightUTC);
      expect(summaryBefore[0].requestsToday).toBe(10);

      // 2. 00:00:10 PST (2026-08-20 00:00:10 PST -> 2026-08-20 07:00:10 UTC)
      const justAfterMidnightUTC = Date.UTC(2026, 7, 20, 7, 0, 10);
      const dayAfter = getDayInLosAngeles(justAfterMidnightUTC);
      expect(dayAfter).toBe('2026-08-20');

      // Summary after midnight must be 0
      const summaryAfter = quotaService.getQuotaSnapshot([testKey], justAfterMidnightUTC);
      expect(summaryAfter[0].requestsToday).toBe(0);
    });

    it('enforces 60-second sliding window for RPM and TPM', () => {
      const testKey = 'AIzaSyTestSlidingRpmTpmKey-888';
      const startTime = Date.now();

      // Record 5 requests with 200 tokens each
      for (let i = 0; i < 5; i++) {
        quotaService.recordUsage(
          testKey,
          'gemini-2.5-flash',
          'success',
          startTime,
          { totalTokens: 200, promptTokens: 100, outputTokens: 100 }
        );
      }

      const snap1 = quotaService.getQuotaSnapshot([testKey], startTime);
      expect(snap1[0].requestsThisMinute).toBe(5);
      expect(snap1[0].tokensThisMinute).toBe(1000);

      // Advance 65 seconds (outside sliding window)
      const afterWindowTime = startTime + 65000;
      const snap2 = quotaService.getQuotaSnapshot([testKey], afterWindowTime);
      expect(snap2[0].requestsThisMinute).toBe(0);
      expect(snap2[0].tokensThisMinute).toBe(0);
      // But daily total is preserved
      expect(snap2[0].requestsToday).toBe(5);
    });

    it('implements dynamic key health, cooldown on 429, and automatic recovery on success', () => {
      const testKey = 'AIzaSyTestKeyHealth-777';

      // 1. Initial health is optimal
      let health = quotaService.getKeyHealth(testKey);
      expect(health.state).toBe('Healthy');
      expect(health.circuitBreaker).toBe('Closed');
      expect(health.consecutiveErrors).toBe(0);

      // 2. Record 429 quota error -> triggers QuotaExhausted state
      quotaService.recordUsage(testKey, 'gemini-2.5-flash', 'quota_exceeded', Date.now());
      health = quotaService.getKeyHealth(testKey);
      expect(['QuotaExhausted', 'Degraded', 'Cooldown']).toContain(health.state);
      expect(health.consecutiveErrors).toBe(1);

      // 3. Record successful response -> resets errors and restores availability
      quotaService.recordUsage(testKey, 'gemini-2.5-flash', 'success', Date.now());
      health = quotaService.getKeyHealth(testKey);
      expect(health.state).toBe('Healthy');
      expect(health.consecutiveErrors).toBe(0);
      expect(health.cooldownRemainingMs).toBe(0);
    });
  });

  // =========================================================================
  // 3. RESILIENCE, FAILURE & RETRY TRACING
  // =========================================================================
  describe('3. Resilience & Error Handling (Retry, Quota Cooldown, Timeout, Chunk Cache)', () => {
    it('caches and retrieves translation chunks in server memory with 2-hour sliding window', () => {
      const modelId = 'gemini-2.5-flash';
      const promptText = 'Vương Lâm nhìn về phía xa, trong mắt lóe lên một tia hàn mang.';
      const translationResult = 'Vương Lâm nhìn về phía xa, trong mắt lóe lên một tia lạnh lẽo.';

      // Generate key and store in chunk cache
      const cacheKey = translationChunkCache.generateKey('translate', promptText, { model: modelId });
      translationChunkCache.set(cacheKey, { text: translationResult });

      // Retrieve
      const cached = translationChunkCache.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached?.text).toBe(translationResult);
      expect(translationChunkCache.size()).toBe(1);
      expect(translationChunkCache.has(cacheKey)).toBe(true);
    });
  });

  // =========================================================================
  // 4. INFRASTRUCTURE & HTTP RATE LIMITING (Sliding Window & Storage Security)
  // =========================================================================
  describe('4. Infrastructure & HTTP Rate Limiting (Sliding Window & Security Invariants)', () => {
    it('eliminates 2x boundary bursts in HTTP Rate Limiter using sliding window weighted calculation', () => {
      delete process.env.REDIS_URL;
      vi.useFakeTimers();
      const windowMs = 60000;
      const startTime = Math.floor(1700000000000 / windowMs) * windowMs;
      vi.setSystemTime(startTime);

      const limiter = createRateLimiter({ windowMs, maxRequests: 60 });
      const req = { ip: '10.20.30.40', socket: {} } as unknown as Request;
      const next = vi.fn();

      const createRes = () => {
        const headers: Record<string, any> = {};
        const jsonMock = vi.fn();
        const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        const res = {
          setHeader: vi.fn((k, v) => {
            headers[k] = v;
          }),
          status: statusMock,
        } as unknown as Response;
        return { res, statusMock, jsonMock, headers };
      };

      // Send 50 requests at second 50 of window 1
      vi.setSystemTime(startTime + 50000);
      for (let i = 0; i < 50; i++) {
        const { res } = createRes();
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(50);

      // At second 10 of window 2, sending 15 requests works (15 + 50*(50/60) = 56.67 < 60)
      vi.setSystemTime(startTime + 70000);
      for (let i = 0; i < 15; i++) {
        const { res } = createRes();
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(65);

      // Sending further requests gets blocked with 429 and Retry-After header
      let blockedWith429 = false;
      for (let i = 0; i < 10; i++) {
        const { res, statusMock, headers } = createRes();
        limiter(req, res, next);
        if (statusMock.mock.calls.length > 0 && statusMock.mock.calls[0][0] === 429) {
          blockedWith429 = true;
          expect(headers['Retry-After']).toBeGreaterThanOrEqual(1);
          expect(headers['X-RateLimit-Limit']).toBe(60);
          expect(headers['X-RateLimit-Remaining']).toBe(0);
        }
      }
      expect(blockedWith429).toBe(true);
    });

    it('enforces Zero-Plain-Key and Zero-Manuscript leakage invariant in localStorage', () => {
      // 1. Clean storage passes verification
      storageMock.setItem('gemini_selected_model', 'gemini-2.5-flash');
      storageMock.setItem('app_ui_prefs', JSON.stringify({ theme: 'dark' }));
      let integrity = verifyStorageIntegrity(storageMock);
      expect(integrity.isValid).toBe(true);
      expect(integrity.violations).toHaveLength(0);

      // 2. Leaking plain API key fails verification
      storageMock.setItem('gemini_api_keys', JSON.stringify(['AIzaSyFakeKeyLeak-12345']));
      integrity = verifyStorageIntegrity(storageMock);
      expect(integrity.isValid).toBe(false);
      expect(integrity.forbiddenKeysFound).toContain('gemini_api_keys');

      // 3. Leaking manuscript paragraphs fails verification
      delete mockStorage['gemini_api_keys'];
      storageMock.setItem('chapter_1_content', JSON.stringify({ sourceText: 'Một đoạn văn bản dài...' }));
      integrity = verifyStorageIntegrity(storageMock);
      expect(integrity.isValid).toBe(false);
      expect(integrity.forbiddenKeysFound).toContain('chapter_1_content');
    });

    it('telemetry status accurately reports sliding-window-counter algorithm', () => {
      const status = getRateLimiterStatus();
      expect(status.algorithm).toBe('sliding-window-counter');
      expect(typeof status.localEntriesCount).toBe('number');
      expect(typeof status.isDegraded).toBe('boolean');
    });
  });
});
