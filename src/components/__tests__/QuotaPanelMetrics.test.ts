import { describe, it, expect } from 'vitest';
import { computeModelStatsSummary, getKeyModelStats } from '../../utils/modelRegistry';
import { KeyQuotaFullSnapshot, LogicalSummaryStats } from '../../utils/apiClient';

describe('QuotaPanel Metrics & Decoupled Semantics Unit Tests', () => {
  it('handles snapshots with provider attempt metrics properly', () => {
    const mockSnapshot: KeyQuotaFullSnapshot = {
      index: 0,
      keyHash: 'hash123',
      maskedKey: 'AIzaSy...1234',
      providerAttemptsTotal: 10,
      providerAttemptsToday: 5,
      providerAttemptsThisMinute: 2,
      requestsTotal: 10,
      requestsToday: 5,
      requestsThisMinute: 2,
      errorsTotal: 1,
      tokensTotal: 50000,
      tokensToday: 20000,
      tokensThisMinute: 4000,
      byModel: {
        'models/gemini-2.5-flash': {
          requestsTotal: 10,
          requestsToday: 5,
          requestsThisMinute: 2,
          errorsTotal: 1,
          tokensTotal: 50000,
          tokensToday: 20000,
          tokensThisMinute: 4000,
        },
      },
      runtime: {
        isBlacklisted: false,
        blacklistRemainingMs: 0,
        isRateLimited: false,
        nextAllowedRemainingMs: 0,
      },
    };

    const modelStats = getKeyModelStats(mockSnapshot, 'gemini-2.5-flash');
    expect(modelStats.requestsTotal).toBe(10);
    expect(modelStats.requestsToday).toBe(5);
    expect(modelStats.requestsThisMinute).toBe(2);
    expect(modelStats.errorsTotal).toBe(1);

    const summary = computeModelStatsSummary('gemini-2.5-flash', [mockSnapshot], {}, 1);
    expect(summary.totalRequests).toBe(10);
    expect(summary.requestsToday).toBe(5);
    expect(summary.requestsThisMinute).toBe(2);
  });

  it('validates logical summary stats structure', () => {
    const summary: LogicalSummaryStats = {
      logicalRequestsTotal: 10,
      logicalRequestsToday: 4,
      successfulRequestsTotal: 9,
      successfulRequestsToday: 4,
      failedRequestsTotal: 1,
      failedRequestsToday: 0,
      retriesTotal: 5,
      retriesToday: 2,
      providerAttemptsTotal: 15,
      providerAttemptsToday: 6,
      successfulAttemptsTotal: 9,
      successfulAttemptsToday: 4,
      failedAttemptsTotal: 6,
      failedAttemptsToday: 2,
      lastResetDay: '2026-08-20',
    };

    expect(summary.logicalRequestsTotal).toBe(10);
    expect(summary.providerAttemptsTotal).toBe(15);
    expect(summary.retriesTotal).toBe(5);
    expect(summary.successfulRequestsTotal).toBe(9);
  });
});
