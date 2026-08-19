import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService, getDayInLosAngeles } from '../quotaService';
import { _testMaps } from '../geminiService';

describe('Decoupling Logical Requests and Provider Attempts', () => {
  beforeEach(() => {
    quotaService.resetAll();
    _testMaps.blacklistedKeys.clear();
    _testMaps.nextAllowedTimeByKey.clear();
    _testMaps.resetActiveRequests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Story 1: Runtime Metric Decoupling & Lifecycle Tracking', () => {
    const model = 'gemini-2.5-flash';
    const now = Date.now();

    it('records a single successful attempt accurately', () => {
      // 1 Logical Request, 1 Provider Attempt, 0 Retries
      quotaService.recordLogicalRequest(model, 'success', 1, 0, now);

      const summary = quotaService.getLogicalSummary(now);
      expect(summary.logicalRequestsTotal).toBe(1);
      expect(summary.logicalRequestsToday).toBe(1);
      expect(summary.successfulRequestsTotal).toBe(1);
      expect(summary.successfulRequestsToday).toBe(1);
      expect(summary.failedRequestsTotal).toBe(0);

      expect(summary.providerAttemptsTotal).toBe(1);
      expect(summary.providerAttemptsToday).toBe(1);
      expect(summary.successfulAttemptsTotal).toBe(1);
      expect(summary.failedAttemptsTotal).toBe(0);
      expect(summary.retriesTotal).toBe(0);
      expect(summary.retriesToday).toBe(0);
    });

    it('records a single retry with rotation accurately', () => {
      // 1 Logical Request, 2 Provider Attempts, 1 Retry, 1 Success
      quotaService.recordLogicalRequest(model, 'success', 2, 1, now);

      const summary = quotaService.getLogicalSummary(now);
      expect(summary.logicalRequestsTotal).toBe(1);
      expect(summary.successfulRequestsTotal).toBe(1);
      expect(summary.failedRequestsTotal).toBe(0);

      expect(summary.providerAttemptsTotal).toBe(2);
      expect(summary.successfulAttemptsTotal).toBe(1);
      expect(summary.failedAttemptsTotal).toBe(1);
      expect(summary.retriesTotal).toBe(1);
    });

    it('records multiple key rotation with 3 attempts and 2 retries', () => {
      // 1 Logical Request, 3 Provider Attempts (Key 1 fail, Key 2 fail, Key 3 success)
      quotaService.recordLogicalRequest(model, 'success', 3, 2, now);

      const summary = quotaService.getLogicalSummary(now);
      expect(summary.logicalRequestsTotal).toBe(1);
      expect(summary.successfulRequestsTotal).toBe(1);
      expect(summary.failedRequestsTotal).toBe(0);

      expect(summary.providerAttemptsTotal).toBe(3);
      expect(summary.successfulAttemptsTotal).toBe(1);
      expect(summary.failedAttemptsTotal).toBe(2);
      expect(summary.retriesTotal).toBe(2);
    });

    it('records all attempts failed exhaustion scenario', () => {
      // 1 Logical Request, 3 Provider Attempts (all 3 keys failed)
      quotaService.recordLogicalRequest(model, 'failure', 3, 2, now);

      const summary = quotaService.getLogicalSummary(now);
      expect(summary.logicalRequestsTotal).toBe(1);
      expect(summary.successfulRequestsTotal).toBe(0);
      expect(summary.failedRequestsTotal).toBe(1);

      expect(summary.providerAttemptsTotal).toBe(3);
      expect(summary.successfulAttemptsTotal).toBe(0);
      expect(summary.failedAttemptsTotal).toBe(3);
      expect(summary.retriesTotal).toBe(2);
    });
  });

  describe('User Story 2: Daily Reset Synchronization in America/Los_Angeles', () => {
    const model = 'gemini-2.5-flash';

    it('resets both logical and provider daily counters at midnight PST', () => {
      const day1 = new Date('2026-08-20T10:00:00Z').getTime(); // Day 1 in LA
      const day2 = new Date('2026-08-21T10:00:00Z').getTime(); // Day 2 in LA (next day)

      // Day 1: 2 translations, 4 attempts, 2 retries
      quotaService.recordLogicalRequest(model, 'success', 2, 1, day1);
      quotaService.recordLogicalRequest(model, 'success', 2, 1, day1);

      const summaryDay1 = quotaService.getLogicalSummary(day1);
      expect(summaryDay1.logicalRequestsTotal).toBe(2);
      expect(summaryDay1.logicalRequestsToday).toBe(2);
      expect(summaryDay1.providerAttemptsToday).toBe(4);
      expect(summaryDay1.retriesToday).toBe(2);

      // Day 2 check: *Today counters reset to 0, *Total counters preserved
      const summaryDay2 = quotaService.getLogicalSummary(day2);
      expect(summaryDay2.logicalRequestsTotal).toBe(2);
      expect(summaryDay2.logicalRequestsToday).toBe(0);
      expect(summaryDay2.providerAttemptsTotal).toBe(4);
      expect(summaryDay2.providerAttemptsToday).toBe(0);
      expect(summaryDay2.retriesTotal).toBe(2);
      expect(summaryDay2.retriesToday).toBe(0);
    });
  });

  describe('User Story 3: Backward-Compatible Per-Key Snapshots with Provider Semantics', () => {
    it('populates providerAttempts* alongside requests* aliases in key snapshots', () => {
      const key = 'AIzaSyTestProviderSemanticsKey';
      const model = 'gemini-2.5-flash';
      const now = Date.now();

      quotaService.recordUsage(key, model, 'success', now, {
        promptTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      const snapshots = quotaService.getQuotaSnapshot([key], now);
      expect(snapshots).toHaveLength(1);
      const snap = snapshots[0];

      expect(snap.providerAttemptsTotal).toBe(1);
      expect(snap.providerAttemptsToday).toBe(1);
      expect(snap.providerAttemptsThisMinute).toBe(1);

      // Backward compatible aliases
      expect(snap.requestsTotal).toBe(1);
      expect(snap.requestsToday).toBe(1);
      expect(snap.requestsThisMinute).toBe(1);
    });
  });
});
