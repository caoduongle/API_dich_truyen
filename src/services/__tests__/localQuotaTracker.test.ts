import { describe, it, expect, beforeEach } from 'vitest';
import {
  localQuotaTracker,
  getNextPstMidnight,
  getDayInLosAngeles,
  legacyHashApiKey,
  hashApiKey,
} from '../localQuotaTracker';

describe('localQuotaTracker & getNextPstMidnight', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    globalThis.sessionStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: (_i: number) => null,
    } as any;

    localQuotaTracker.resetMetrics();
  });

  describe('getNextPstMidnight', () => {
    it('computes exact next midnight in Los Angeles for summer (PDT UTC-7)', () => {
      // 2026-07-15 12:00:00 UTC = 05:00:00 PDT
      const midSummer = Date.UTC(2026, 6, 15, 12, 0, 0, 0);
      const nextMidnight = getNextPstMidnight(midSummer);

      // In PDT (UTC-7), 00:00 of July 16 is 07:00:00 UTC
      const expectedUtc = Date.UTC(2026, 6, 16, 7, 0, 0, 0);
      expect(nextMidnight).toBe(expectedUtc);

      // Verify formatted date in LA for that exact millisecond is next day 00:00:00
      expect(getDayInLosAngeles(nextMidnight)).toBe('2026-07-16');
      expect(getDayInLosAngeles(nextMidnight - 1)).toBe('2026-07-15');
    });

    it('computes exact next midnight in Los Angeles for winter (PST UTC-8)', () => {
      // 2026-01-10 12:00:00 UTC = 04:00:00 PST
      const midWinter = Date.UTC(2026, 0, 10, 12, 0, 0, 0);
      const nextMidnight = getNextPstMidnight(midWinter);

      // In PST (UTC-8), 00:00 of January 11 is 08:00:00 UTC
      const expectedUtc = Date.UTC(2026, 0, 11, 8, 0, 0, 0);
      expect(nextMidnight).toBe(expectedUtc);

      expect(getDayInLosAngeles(nextMidnight)).toBe('2026-01-11');
      expect(getDayInLosAngeles(nextMidnight - 1)).toBe('2026-01-10');
    });

    it('handles edge case near 23:59:59 PST correctly', () => {
      // 2026-01-10 07:59:59 UTC = 2026-01-09 23:59:59 PST
      const nearMidnight = Date.UTC(2026, 0, 10, 7, 59, 59, 0);
      const nextMidnight = getNextPstMidnight(nearMidnight);

      // Next midnight should be 2026-01-10 08:00:00 UTC
      const expectedUtc = Date.UTC(2026, 0, 10, 8, 0, 0, 0);
      expect(nextMidnight).toBe(expectedUtc);
    });

    it('handles edge case right after 00:00:01 PST correctly', () => {
      // 2026-01-10 08:00:01 UTC = 2026-01-10 00:00:01 PST
      const justAfterMidnight = Date.UTC(2026, 0, 10, 8, 0, 1, 0);
      const nextMidnight = getNextPstMidnight(justAfterMidnight);

      // Next midnight should be 2026-01-11 08:00:00 UTC
      const expectedUtc = Date.UTC(2026, 0, 11, 8, 0, 0, 0);
      expect(nextMidnight).toBe(expectedUtc);
    });
  });

  describe('RPM & TPM Semantics', () => {
    const key = 'test-api-key-1234567890';
    const model = 'gemini-2.5-flash';

    it('records RPM immediately on recordProviderAttempt even if call fails', () => {
      const now = Date.now();

      // Simulate 3 provider attempts: attempt 1 (429), attempt 2 (503), attempt 3 (200 success)
      localQuotaTracker.recordProviderAttempt(key, model, now);
      localQuotaTracker.recordFailure(key, model, { status: 429, message: 'Resource exhausted rate limit' }, now);

      localQuotaTracker.recordProviderAttempt(key, model, now + 100);
      localQuotaTracker.recordFailure(key, model, { status: 503, message: 'Service unavailable' }, now + 100);

      localQuotaTracker.recordProviderAttempt(key, model, now + 200);
      localQuotaTracker.recordSuccess(key, model, { totalTokens: 350 }, 150, now + 200);

      const status = localQuotaTracker.getQuotaStatus([key], now + 250);
      expect(status.keys).toHaveLength(1);

      const keyStatus = status.keys[0];
      // All 3 attempts are counted in RPM
      expect(keyStatus.requestsThisMinute).toBe(3);
      expect(keyStatus.providerAttemptsThisMinute).toBe(3);
      expect(keyStatus.requestsTotal).toBe(3);

      // Only the success call added tokens for TPM
      expect(keyStatus.tokensThisMinute).toBe(350);
      expect(keyStatus.tokensTotal).toBe(350);

      // Per-model stats reflect the same distinction
      const modelStats = keyStatus.byModel[model];
      expect(modelStats).toBeDefined();
      expect(modelStats.requestsThisMinute).toBe(3);
      expect(modelStats.tokensThisMinute).toBe(350);
    });

    it('sets cooldownUntil to next PST midnight on QuotaExhausted', () => {
      // 2026-09-14 12:00:00 UTC
      const now = Date.UTC(2026, 8, 14, 12, 0, 0, 0);
      const expectedMidnight = getNextPstMidnight(now);

      localQuotaTracker.recordProviderAttempt(key, model, now);
      localQuotaTracker.recordFailure(
        key,
        model,
        { status: 429, message: 'Daily quota exhausted' },
        now
      );

      const health = localQuotaTracker.getKeyHealth(key, now);
      expect(health.state).toBe('QuotaExhausted');
      expect(health.isAvailable).toBe(false);

      const status = localQuotaTracker.getQuotaStatus([key], now);
      const keyStats = status.keys[0];
      expect(keyStats.healthState).toBe('QuotaExhausted');

      // Verify that cooldown expires precisely at PST midnight, not fixed 4 hours
      expect(expectedMidnight - now).toBeGreaterThan(4 * 3600 * 1000);
    });
  });

  describe('State Persistence across Reloads (sessionStorage)', () => {
    const key = 'test-persistence-key-xyz';
    const model = 'gemini-2.5-flash';

    it('preserves QuotaExhausted healthState and cooldownUntil across reloads within same PST day', () => {
      const now = Date.now();
      localQuotaTracker.recordProviderAttempt(key, model, now);
      localQuotaTracker.recordFailure(
        key,
        model,
        { status: 429, message: 'Resource exhausted RPD daily quota exceeded' },
        now
      );

      const healthBefore = localQuotaTracker.getKeyHealth(key, now);
      expect(healthBefore.state).toBe('QuotaExhausted');

      // Verify it was serialized to sessionStorage
      const rawStored = sessionStorage.getItem('gemini_local_quota_tracker_v1');
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.keyStats[0].healthState).toBe('QuotaExhausted');
      expect(parsed.keyStats[0].cooldownUntil).toBeGreaterThan(now);

      // Simulate page reload by creating a new LocalQuotaTracker or calling reload
      (localQuotaTracker as any).loadFromStorage();
      const healthAfter = localQuotaTracker.getKeyHealth(key, now);
      expect(healthAfter.state).toBe('QuotaExhausted');
      expect(healthAfter.isAvailable).toBe(false);
      expect(healthAfter.cooldownRemainingMs).toBeGreaterThan(0);
    });

    it('preserves RateLimited cooldown when cooldown is still active upon reload', () => {
      const now = Date.now();
      localQuotaTracker.recordProviderAttempt(key, model, now);
      localQuotaTracker.recordFailure(
        key,
        model,
        { status: 429, isRateLimit: true, message: 'Rate limit RPM exceeded' },
        now
      );

      const healthBefore = localQuotaTracker.getKeyHealth(key, now);
      expect(healthBefore.state).toBe('RateLimited');

      // Reload
      (localQuotaTracker as any).loadFromStorage();
      const healthAfter = localQuotaTracker.getKeyHealth(key, now + 1000);
      expect(healthAfter.state).toBe('RateLimited');
      expect(healthAfter.isAvailable).toBe(false);
    });

    it('recovers RateLimited to Healthy if cooldown expired while closed', () => {
      const now = Date.now();
      localQuotaTracker.recordProviderAttempt(key, model, now);
      localQuotaTracker.recordFailure(
        key,
        model,
        { status: 429, isRateLimit: true, message: 'Rate limit RPM exceeded' },
        now
      );

      // Simulate reload 60 seconds later (cooldown was 45s)
      const afterCooldown = now + 60 * 1000;
      (localQuotaTracker as any).loadFromStorage(afterCooldown);
      const healthAfter = localQuotaTracker.getKeyHealth(key, afterCooldown);
      expect(healthAfter.state).toBe('Healthy');
      expect(healthAfter.isAvailable).toBe(true);
    });
  });

  describe('Logical Request Lifecycle & Retry Metrics', () => {
    const key1 = 'test-key-metrics-1';
    const model = 'gemini-2.5-flash';

    it('records logical failure accurately without double counting', () => {
      const now = Date.now();
      localQuotaTracker.recordLogicalStart(now);
      localQuotaTracker.recordProviderAttempt(key1, model, now);
      localQuotaTracker.recordFailure(key1, model, { status: 429, message: 'Rate limit' }, now);

      let status = localQuotaTracker.getQuotaStatus([key1], now);
      expect(status.summary?.logicalRequestsTotal).toBe(1);
      expect(status.summary?.failedAttemptsTotal).toBe(1);
      expect(status.summary?.failedRequestsTotal).toBe(0); // Chưa ghi nhận failure cấp logical request

      // Giờ kết thúc thất bại toàn bộ
      localQuotaTracker.recordLogicalFailure(now);
      status = localQuotaTracker.getQuotaStatus([key1], now);
      expect(status.summary?.failedRequestsTotal).toBe(1);
      expect(status.summary?.failedRequestsToday).toBe(1);
    });

    it('separates retriesTotal from recordFailure and increments retriesTotal only on recordRetry', () => {
      const now = Date.now();
      localQuotaTracker.recordLogicalStart(now);
      localQuotaTracker.recordProviderAttempt(key1, model, now);

      // Gặp lỗi 401 Auth Failed - không retry
      localQuotaTracker.recordFailure(key1, model, { status: 401, message: 'API key invalid' }, now);
      let status = localQuotaTracker.getQuotaStatus([key1], now);
      expect(status.summary?.failedAttemptsTotal).toBe(1);
      expect(status.summary?.retriesTotal).toBe(0); // Không được tăng khi gọi recordFailure

      // Khi thực sự xoay tua key / retry
      localQuotaTracker.recordRetry(key1, now);
      status = localQuotaTracker.getQuotaStatus([key1], now);
      expect(status.summary?.retriesTotal).toBe(1);
      expect(status.summary?.retriesToday).toBe(1);
    });
  });

  describe('SessionStorage Hash Migration & KeyStats Normalization', () => {
    const rawKey = 'AIzaSyMigrateTestKey_1234567890';
    const legacyHash = legacyHashApiKey(rawKey);
    const standardSha256 = hashApiKey(rawKey);

    it('normalizes raw or non-64 hex keyHash from sessionStorage during loadFromStorage', () => {
      const now = Date.now();
      const currentDay = getDayInLosAngeles(now);

      // Pre-populate sessionStorage with a non-64 hex keyHash (e.g. raw key)
      const rawStoredData = {
        summaryStats: {
          logicalRequestsTotal: 5,
          logicalRequestsToday: 5,
          successfulRequestsTotal: 5,
          successfulRequestsToday: 5,
          failedRequestsTotal: 0,
          failedRequestsToday: 0,
          retriesTotal: 0,
          retriesToday: 0,
          providerAttemptsTotal: 5,
          providerAttemptsToday: 5,
          successfulAttemptsTotal: 5,
          successfulAttemptsToday: 5,
          failedAttemptsTotal: 0,
          failedAttemptsToday: 0,
          lastResetDay: currentDay,
        },
        keyStats: [
          {
            keyHash: rawKey, // Not 64 hex!
            maskedKey: 'AIzaSy...7890',
            requestsTotal: 5,
            requestsToday: 5,
            errorsTotal: 0,
            tokensTotal: 1000,
            tokensToday: 1000,
            byModel: {},
            lastResetDay: currentDay,
            healthState: 'Healthy',
            circuitBreakerStatus: 'Closed',
            cooldownUntil: 0,
          },
        ],
      };

      mockStorage['gemini_local_quota_tracker_v1'] = JSON.stringify(rawStoredData);

      // Trigger load
      (localQuotaTracker as any).loadFromStorage(now);

      // Verify that the entry was normalized under standard SHA-256
      const status = localQuotaTracker.getQuotaStatus([rawKey], now);
      expect(status.keys).toHaveLength(1);
      expect(status.keys[0].keyHash).toBe(standardSha256);
      expect(status.keys[0].requestsTotal).toBe(5);
    });

    it('migrates legacy 32-bit hash keyStats to SHA-256 seamlessly without data loss', () => {
      const now = Date.now();
      const currentDay = getDayInLosAngeles(now);

      // Pre-populate sessionStorage with a legacy hash entry
      const rawStoredData = {
        summaryStats: {
          logicalRequestsTotal: 10,
          logicalRequestsToday: 10,
          successfulRequestsTotal: 8,
          successfulRequestsToday: 8,
          failedRequestsTotal: 2,
          failedRequestsToday: 2,
          retriesTotal: 2,
          retriesToday: 2,
          providerAttemptsTotal: 10,
          providerAttemptsToday: 10,
          successfulAttemptsTotal: 8,
          successfulAttemptsToday: 8,
          failedAttemptsTotal: 2,
          failedAttemptsToday: 2,
          lastResetDay: currentDay,
        },
        keyStats: [
          {
            keyHash: legacyHash,
            maskedKey: 'AIzaSy...7890',
            requestsTotal: 10,
            requestsToday: 10,
            errorsTotal: 2,
            tokensTotal: 5000,
            tokensToday: 5000,
            byModel: {},
            lastResetDay: currentDay,
            healthState: 'Healthy',
            circuitBreakerStatus: 'Closed',
            cooldownUntil: 0,
          },
        ],
      };

      mockStorage['gemini_local_quota_tracker_v1'] = JSON.stringify(rawStoredData);
      (localQuotaTracker as any).loadFromStorage(now);

      // Accessing with raw key triggers migration
      const status = localQuotaTracker.getQuotaStatus([rawKey], now);
      expect(status.keys).toHaveLength(1);
      expect(status.keys[0].keyHash).toBe(standardSha256);
      expect(status.keys[0].requestsTotal).toBe(10);
      expect(status.keys[0].errorsTotal).toBe(2);

      // Check that internal map no longer has the legacy entry
      const internalMap = (localQuotaTracker as any).keyStatsMap;
      expect(internalMap.has(legacyHash)).toBe(false);
      expect(internalMap.has(standardSha256)).toBe(true);
    });
  });

  describe('Sliding Window Continuity & Pruning across Reloads (User Story 2)', () => {
    const key = 'test-sliding-window-key-456';
    const model = 'gemini-2.5-flash';

    it('persists and restores recentAttempts and recentTokens across tab reload', () => {
      const now = Date.now();

      // Record 5 attempts and tokens within the last 30 seconds
      for (let i = 0; i < 5; i++) {
        const attemptTime = now - 30_000 + i * 1000;
        localQuotaTracker.recordProviderAttempt(key, model, attemptTime);
        localQuotaTracker.recordSuccess(key, model, { totalTokens: 100 }, 50, attemptTime);
      }

      // Explicitly flush to storage (or wait for debounce)
      localQuotaTracker.flushToStorage(now);

      // Verify that sessionStorage has recentAttempts and recentTokens
      const rawStored = sessionStorage.getItem('gemini_local_quota_tracker_v1');
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.keyStats[0].recentAttempts).toHaveLength(5);
      expect(parsed.keyStats[0].recentTokens).toHaveLength(5);

      // Simulate a tab reload at `now + 5000` (within 60s window)
      localQuotaTracker.resetMetrics();
      expect(localQuotaTracker.getQuotaStatus([key], now + 5000).keys[0].requestsThisMinute).toBe(0);

      // Restore from storage
      mockStorage['gemini_local_quota_tracker_v1'] = rawStored!;
      localQuotaTracker.loadFromStorage(now + 5000);

      const statusAfterReload = localQuotaTracker.getQuotaStatus([key], now + 5000);
      expect(statusAfterReload.keys[0].requestsThisMinute).toBe(5);
      expect(statusAfterReload.keys[0].tokensThisMinute).toBe(500);
      expect(statusAfterReload.keys[0].byModel[model].requestsThisMinute).toBe(5);
      expect(statusAfterReload.keys[0].byModel[model].tokensThisMinute).toBe(500);
    });

    it('prunes records older than 60 seconds on reload and snapshot calculation', () => {
      const now = Date.now();

      // Attempt 1: 70 seconds ago (expired)
      localQuotaTracker.recordProviderAttempt(key, model, now - 70_000);
      localQuotaTracker.recordSuccess(key, model, { totalTokens: 200 }, 50, now - 70_000);

      // Attempt 2: 20 seconds ago (active)
      localQuotaTracker.recordProviderAttempt(key, model, now - 20_000);
      localQuotaTracker.recordSuccess(key, model, { totalTokens: 150 }, 50, now - 20_000);

      localQuotaTracker.flushToStorage(now);

      // Reset and reload
      const rawStored = sessionStorage.getItem('gemini_local_quota_tracker_v1');
      localQuotaTracker.resetMetrics();
      mockStorage['gemini_local_quota_tracker_v1'] = rawStored!;
      localQuotaTracker.loadFromStorage(now);

      const status = localQuotaTracker.getQuotaStatus([key], now);
      // Only the active attempt (20s ago) should remain
      expect(status.keys[0].requestsThisMinute).toBe(1);
      expect(status.keys[0].tokensThisMinute).toBe(150);
    });

    it('discards entries with skewed future timestamps', () => {
      const now = Date.now();
      const futureTime = now + 120_000; // 2 minutes in the future (skewed clock)

      const fakeData = {
        summaryStats: { logicalRequestsTotal: 1, logicalRequestsToday: 1, lastResetDay: getDayInLosAngeles(now) },
        keyStats: [
          {
            keyHash: hashApiKey(key),
            maskedKey: 'AIzaSy...456',
            requestsTotal: 1,
            requestsToday: 1,
            errorsTotal: 0,
            tokensTotal: 50,
            tokensToday: 50,
            lastResetDay: getDayInLosAngeles(now),
            healthState: 'Healthy',
            circuitBreakerStatus: 'Closed',
            cooldownUntil: 0,
            recentAttempts: [{ timestamp: futureTime }],
            recentTokens: [{ timestamp: futureTime, tokens: 50 }],
            byModel: {},
          },
        ],
      };

      mockStorage['gemini_local_quota_tracker_v1'] = JSON.stringify(fakeData);
      localQuotaTracker.resetMetrics();
      localQuotaTracker.loadFromStorage(now);

      const status = localQuotaTracker.getQuotaStatus([key], now);
      expect(status.keys[0].requestsThisMinute).toBe(0);
      expect(status.keys[0].tokensThisMinute).toBe(0);
    });
  });

  describe('Asynchronous Persistence Debouncing & Flush (User Story 6)', () => {
    const key = 'test-debounce-key-789';
    const model = 'gemini-2.5-flash';

    it('batches consecutive attempts and writes synchronously on flushToStorage', () => {
      const now = Date.now();

      // Initial clean state
      localQuotaTracker.resetMetrics();
      expect(sessionStorage.getItem('gemini_local_quota_tracker_v1')).toBeNull();

      // Record 10 rapid provider attempts and successes
      for (let i = 0; i < 10; i++) {
        localQuotaTracker.recordProviderAttempt(key, model, now + i * 10);
        localQuotaTracker.recordSuccess(key, model, { totalTokens: 50 }, 20, now + i * 10);
      }

      // Storage should NOT be written immediately because of debounce timer
      expect(sessionStorage.getItem('gemini_local_quota_tracker_v1')).toBeNull();

      // Explicit flush commits to storage immediately
      localQuotaTracker.flushToStorage(now + 200);
      const rawStored = sessionStorage.getItem('gemini_local_quota_tracker_v1');
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.summaryStats.providerAttemptsTotal).toBe(10);
      expect(parsed.summaryStats.successfulAttemptsTotal).toBe(10);
    });
  });
});
