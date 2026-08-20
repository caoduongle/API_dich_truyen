import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  quotaService,
  hashApiKey,
  maskApiKey,
  getDayInLosAngeles,
} from '../quotaService';

describe('quotaService', () => {
  beforeEach(() => {
    quotaService.resetAll();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Utility functions', () => {
    it('should correctly hash API keys using SHA-256', () => {
      const key1 = 'AIzaSyExampleKey123456789';
      const key2 = 'AIzaSyExampleKey123456789';
      const key3 = 'DifferentKey987654321';

      const hash1 = hashApiKey(key1);
      const hash2 = hashApiKey(key2);
      const hash3 = hashApiKey(key3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });

    it('should mask API keys properly without leaking the full key', () => {
      expect(maskApiKey('AIzaSyAbc12345Def6789Ghi')).toBe('AIzaSy...9Ghi');
      expect(maskApiKey('shortKey')).toBe('***');
      expect(maskApiKey('')).toBe('');
    });

    it('should format date string in America/Los_Angeles timezone', () => {
      // 2026-08-19T07:00:00Z is 2026-08-19 00:00:00 PDT (UTC-7)
      const datePST = new Date('2026-08-19T07:00:00.000Z').getTime();
      expect(getDayInLosAngeles(datePST)).toBe('2026-08-19');

      // 2026-08-19T06:59:59Z is 2026-08-18 23:59:59 PDT
      const dateBeforeMidnight = new Date('2026-08-19T06:59:59.000Z').getTime();
      expect(getDayInLosAngeles(dateBeforeMidnight)).toBe('2026-08-18');
    });
  });

  describe('Recording usage & Snapshot retrieval', () => {
    const testKey1 = 'AIzaSyKeyOneSample12345678';
    const testKey2 = 'AIzaSyKeyTwoSample87654321';

    it('should return 0 counts for unused keys', () => {
      const snapshot = quotaService.getQuotaSnapshot([testKey1]);
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].requestsTotal).toBe(0);
      expect(snapshot[0].requestsToday).toBe(0);
      expect(snapshot[0].requestsThisMinute).toBe(0);
      expect(snapshot[0].errorsTotal).toBe(0);
      expect(snapshot[0].tokensTotal).toBe(0);
      expect(snapshot[0].tokensToday).toBe(0);
      expect(snapshot[0].tokensThisMinute).toBe(0);
      expect(snapshot[0].maskedKey).toBe(maskApiKey(testKey1));
    });

    it('should record success requests and update request & token counters', () => {
      const now = Date.now();
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', now, {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', now + 1000, {
        promptTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      });

      const snapshot = quotaService.getQuotaSnapshot([testKey1], now + 2000);
      expect(snapshot[0].requestsTotal).toBe(2);
      expect(snapshot[0].requestsToday).toBe(2);
      expect(snapshot[0].requestsThisMinute).toBe(2);
      expect(snapshot[0].errorsTotal).toBe(0);
      expect(snapshot[0].tokensTotal).toBe(4500);
      expect(snapshot[0].tokensToday).toBe(4500);
      expect(snapshot[0].tokensThisMinute).toBe(4500);

      const modelStats = snapshot[0].byModel['models/gemini-2.5-flash'];
      expect(modelStats).toBeDefined();
      expect(modelStats.requestsTotal).toBe(2);
      expect(modelStats.tokensTotal).toBe(4500);
      expect(modelStats.tokensThisMinute).toBe(4500);
      expect(modelStats.errorsTotal).toBe(0);
    });

    it('should record error and overload attempts to errorsTotal with 0 tokens if not provided', () => {
      const now = Date.now();
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'overloaded', now);
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'quota_exceeded', now + 500);
      quotaService.recordUsage(testKey1, 'gemini-2.5-pro', 'safety', now + 1000);
      quotaService.recordUsage(testKey1, 'gemini-2.5-pro', 'error', now + 1500);

      const snapshot = quotaService.getQuotaSnapshot([testKey1], now + 2000);
      expect(snapshot[0].requestsTotal).toBe(4);
      expect(snapshot[0].errorsTotal).toBe(4);
      expect(snapshot[0].tokensTotal).toBe(0);

      expect(snapshot[0].byModel['models/gemini-2.5-flash'].errorsTotal).toBe(2);
      expect(snapshot[0].byModel['models/gemini-2.5-pro'].errorsTotal).toBe(2);
    });

    it('should handle sliding 60-second window properly with fake timers for RPM and TPM', () => {
      vi.useFakeTimers();
      const baseTime = new Date('2026-08-19T12:00:00.000Z').getTime();
      vi.setSystemTime(baseTime);

      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', baseTime, {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', baseTime + 10000, {
        promptTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      });

      let snapshot = quotaService.getQuotaSnapshot([testKey1], baseTime + 20000);
      expect(snapshot[0].requestsThisMinute).toBe(2);
      expect(snapshot[0].tokensThisMinute).toBe(4500);
      expect(snapshot[0].requestsTotal).toBe(2);
      expect(snapshot[0].tokensTotal).toBe(4500);

      // Advance past 60s from first request (70s total)
      const futureTime = baseTime + 70000;
      snapshot = quotaService.getQuotaSnapshot([testKey1], futureTime);
      expect(snapshot[0].requestsThisMinute).toBe(0);
      expect(snapshot[0].tokensThisMinute).toBe(0);
      expect(snapshot[0].requestsTotal).toBe(2); // Total remains unchanged
      expect(snapshot[0].tokensTotal).toBe(4500); // Total tokens remain unchanged
    });

    it('should automatically reset requestsToday and tokensToday when transitioning past midnight in America/Los_Angeles', () => {
      // 2026-08-19 23:59:00 PDT -> 2026-08-20T06:59:00.000Z
      const day1Time = new Date('2026-08-20T06:59:00.000Z').getTime();
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', day1Time, {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', day1Time + 30000, {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      let snapshot = quotaService.getQuotaSnapshot([testKey1], day1Time + 40000);
      expect(snapshot[0].requestsToday).toBe(2);
      expect(snapshot[0].tokensToday).toBe(3000);
      expect(snapshot[0].requestsTotal).toBe(2);
      expect(snapshot[0].tokensTotal).toBe(3000);

      // 2 minutes later: 2026-08-20 00:01:00 PDT -> 2026-08-20T07:01:00.000Z (Next Day in PST)
      const day2Time = new Date('2026-08-20T07:01:00.000Z').getTime();
      snapshot = quotaService.getQuotaSnapshot([testKey1], day2Time);
      expect(snapshot[0].requestsToday).toBe(0);
      expect(snapshot[0].tokensToday).toBe(0);
      expect(snapshot[0].requestsTotal).toBe(2);
      expect(snapshot[0].tokensTotal).toBe(3000);

      // New request on Day 2
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', day2Time, {
        promptTokens: 2000,
        outputTokens: 500,
        totalTokens: 2500,
      });
      snapshot = quotaService.getQuotaSnapshot([testKey1], day2Time + 1000);
      expect(snapshot[0].requestsToday).toBe(1);
      expect(snapshot[0].tokensToday).toBe(2500);
      expect(snapshot[0].requestsTotal).toBe(3);
      expect(snapshot[0].tokensTotal).toBe(5500);
    });

    it('should separate request and token metrics between multiple different API keys', () => {
      const now = Date.now();
      quotaService.recordUsage(testKey1, 'gemini-2.5-flash', 'success', now, {
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      quotaService.recordUsage(testKey2, 'gemini-2.5-flash', 'success', now, {
        promptTokens: 3000,
        outputTokens: 1000,
        totalTokens: 4000,
      });
      quotaService.recordUsage(testKey2, 'gemini-2.5-pro', 'error', now + 1000);

      const snapshots = quotaService.getQuotaSnapshot([testKey1, testKey2], now + 2000);
      expect(snapshots).toHaveLength(2);

      expect(snapshots[0].requestsTotal).toBe(1);
      expect(snapshots[0].tokensTotal).toBe(1500);
      expect(snapshots[0].errorsTotal).toBe(0);

      expect(snapshots[1].requestsTotal).toBe(2);
      expect(snapshots[1].tokensTotal).toBe(4000);
      expect(snapshots[1].errorsTotal).toBe(1);
    });
  });

  describe('KeyHealth State Machine & Candidate Scoring', () => {
    const keyA = 'AIzaSyKeyCandidateA12345';
    const keyB = 'AIzaSyKeyCandidateB67890';

    it('should start in Healthy state and transition to Degraded and Open on consecutive errors', () => {
      const initialHealth = quotaService.getKeyHealth(keyA);
      expect(initialHealth.state).toBe('Healthy');
      expect(initialHealth.circuitBreaker).toBe('Closed');
      expect(initialHealth.isAvailable).toBe(true);

      // 1 error -> Degraded
      quotaService.recordUsage(keyA, 'gemini-2.5-flash', 'error');
      expect(quotaService.getKeyHealth(keyA).state).toBe('Degraded');
      expect(quotaService.getKeyHealth(keyA).consecutiveErrors).toBe(1);

      // 3 consecutive errors -> Circuit Breaker Open
      quotaService.recordUsage(keyA, 'gemini-2.5-flash', 'error');
      quotaService.recordUsage(keyA, 'gemini-2.5-flash', 'error');
      const healthAfter3 = quotaService.getKeyHealth(keyA);
      expect(healthAfter3.circuitBreaker).toBe('Open');
      expect(healthAfter3.state).toBe('Cooldown');
      expect(healthAfter3.isAvailable).toBe(false);
    });

    it('should prioritize healthy least-error keys when selecting best key in group', () => {
      const now = Date.now();
      quotaService.registerQuotaGroup({
        id: 'group_test_scoring',
        configuredRpm: 15,
        keyIds: [keyA, keyB],
      });

      // Key A: healthy and recently succeeded
      quotaService.recordGroupUsage('group_test_scoring', keyA, 'gemini-2.5-flash', 'success', now, {
        promptTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      // Key B: encountered consecutive errors (Degraded)
      quotaService.recordUsage(keyB, 'gemini-2.5-flash', 'error', now);

      const healthA = quotaService.getKeyHealth(keyA, now);
      const healthB = quotaService.getKeyHealth(keyB, now);
      expect(healthA.state).toBe('Healthy');
      expect(healthB.state).toBe('Degraded');

      const bestKey = quotaService.selectBestKeyInGroup('group_test_scoring', [keyA, keyB], now);
      expect(bestKey).not.toBeNull();
      expect(bestKey!.key).toBe(keyA);
    });
  });
});

