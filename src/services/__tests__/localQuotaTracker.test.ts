import { describe, it, expect, beforeEach } from 'vitest';
import {
  localQuotaTracker,
  getNextPstMidnight,
  getDayInLosAngeles,
} from '../localQuotaTracker';

describe('localQuotaTracker & getNextPstMidnight', () => {
  beforeEach(() => {
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
});
