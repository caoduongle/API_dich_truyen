import { describe, it, expect, beforeEach } from 'vitest';
import { quotaService } from '../quotaService';
import { AIErrorCode } from '../../constants/errors';

describe('Canonical Metrics Hierarchy & Zero Semantic Overlap (TASK 10)', () => {
  const model = 'gemini-2.5-flash';
  const key1 = 'AIzaSyCanonicalKeyAlpha111';
  const key2 = 'AIzaSyCanonicalKeyBeta222';
  const key3 = 'AIzaSyCanonicalKeyGamma333';

  beforeEach(() => {
    quotaService.resetAll();
    quotaService.ensureKeyGroup(key1);
    quotaService.ensureKeyGroup(key2);
    quotaService.ensureKeyGroup(key3);
  });

  // 1. 1 request / 1 attempt
  it('1 request / 1 attempt: records 1 logical success, 1 provider attempt, 0 retries, 1 key attempt', () => {
    // 1 logical request succeeds immediately on key1
    quotaService.recordUsage(key1, model, 'success');
    quotaService.recordLogicalRequest(model, 'success', 1, 0);

    const logical = quotaService.getCanonicalLogicalMetrics();
    expect(logical.logicalRequests).toBe(1);
    expect(logical.successfulRequests).toBe(1);
    expect(logical.failedRequests).toBe(0);

    const provider = quotaService.getCanonicalProviderMetrics();
    expect(provider.providerAttempts).toBe(1);
    expect(provider.retries).toBe(0);
    expect(provider.providerFailures).toBe(0);

    const keyStats1 = quotaService.getKeyActivityMetrics(key1);
    expect(keyStats1.keyAttempts).toBe(1);
    expect(keyStats1.keyFailures).toBe(0);
    expect(keyStats1.keyCooldowns).toBe(0);

    // Kiểm tra Backward Compatibility Snapshot
    const snapshot = quotaService.getQuotaSnapshot([key1]);
    expect(snapshot[0].keyAttempts).toBe(1);
    expect(snapshot[0].requestsTotal).toBe(1); // Alias compatibility
    expect(snapshot[0].providerAttemptsTotal).toBe(1); // Alias compatibility
  });

  // 2. 1 request / 3 attempts
  it('1 request / 3 attempts: records 1 logical success, 3 provider attempts, 2 retries, 2 provider failures', () => {
    // Attempt 1: key1 fails
    quotaService.recordCategorizedError(key1, model, {
      code: AIErrorCode.SERVER_ERROR,
      message: '500 Server Error',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 500,
    });
    // Attempt 2: key2 fails
    quotaService.recordCategorizedError(key2, model, {
      code: AIErrorCode.RATE_LIMITED,
      message: '429 Rate Limit',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 429,
    });
    // Attempt 3: key3 succeeds
    quotaService.recordUsage(key3, model, 'success');

    // 1 logical request, 3 provider attempts, 2 retries
    quotaService.recordLogicalRequest(model, 'success', 3, 2);

    const logical = quotaService.getCanonicalLogicalMetrics();
    expect(logical.logicalRequests).toBe(1);
    expect(logical.successfulRequests).toBe(1);
    expect(logical.failedRequests).toBe(0);

    const provider = quotaService.getCanonicalProviderMetrics();
    expect(provider.providerAttempts).toBe(3);
    expect(provider.retries).toBe(2);
    expect(provider.providerFailures).toBe(2);

    // Key activity layer
    const k1 = quotaService.getKeyActivityMetrics(key1);
    expect(k1.keyAttempts).toBe(1);
    expect(k1.keyFailures).toBe(1);

    const k2 = quotaService.getKeyActivityMetrics(key2);
    expect(k2.keyAttempts).toBe(1);
    expect(k2.keyFailures).toBe(1);

    const k3 = quotaService.getKeyActivityMetrics(key3);
    expect(k3.keyAttempts).toBe(1);
    expect(k3.keyFailures).toBe(0);
  });

  // 3. multiple logical requests
  it('multiple logical requests: accurately aggregates across successful and failed logical requests', () => {
    // Req 1: Success in 1 attempt
    quotaService.recordUsage(key1, model, 'success');
    quotaService.recordLogicalRequest(model, 'success', 1, 0);

    // Req 2: Success in 2 attempts (1 retry)
    quotaService.recordCategorizedError(key2, model, {
      code: AIErrorCode.OVERLOADED,
      message: '503 Overloaded',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 503,
    });
    quotaService.recordUsage(key1, model, 'success');
    quotaService.recordLogicalRequest(model, 'success', 2, 1);

    // Req 3: Fail after 3 attempts (2 retries)
    quotaService.recordCategorizedError(key1, model, {
      code: AIErrorCode.SERVER_ERROR,
      message: '500 Error',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 500,
    });
    quotaService.recordCategorizedError(key2, model, {
      code: AIErrorCode.SERVER_ERROR,
      message: '500 Error',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 500,
    });
    quotaService.recordCategorizedError(key3, model, {
      code: AIErrorCode.SERVER_ERROR,
      message: '500 Error',
      isRetryable: true,
      recommendedAction: 'rotate_key',
      httpStatus: 500,
    });
    quotaService.recordLogicalRequest(model, 'failure', 3, 2);

    // Req 4: Success in 1 attempt
    quotaService.recordUsage(key3, model, 'success');
    quotaService.recordLogicalRequest(model, 'success', 1, 0);

    // Req 5: Fail after 1 attempt
    quotaService.recordCategorizedError(key1, model, {
      code: AIErrorCode.AUTH_FAILED,
      message: '401 Auth Error',
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 401,
    });
    quotaService.recordLogicalRequest(model, 'failure', 1, 0);

    const logical = quotaService.getCanonicalLogicalMetrics();
    expect(logical.logicalRequests).toBe(5);
    expect(logical.successfulRequests).toBe(3);
    expect(logical.failedRequests).toBe(2);

    const provider = quotaService.getCanonicalProviderMetrics();
    // Total attempts: 1 + 2 + 3 + 1 + 1 = 8
    expect(provider.providerAttempts).toBe(8);
    // Total retries: 0 + 1 + 2 + 0 + 0 = 3
    expect(provider.retries).toBe(3);
    // Total provider failures: 0 + 1 + 3 + 0 + 1 = 5
    expect(provider.providerFailures).toBe(5);

    // Summary stats
    const summary = quotaService.getLogicalSummary();
    expect(summary.logicalRequests).toBe(5);
    expect(summary.successfulRequests).toBe(3);
    expect(summary.failedRequests).toBe(2);
    expect(summary.logicalRequestsTotal).toBe(5); // Deprecated alias
  });

  // 4. all retries fail
  it('all retries fail: records 1 logical failure, N provider attempts, N-1 retries, N provider failures', () => {
    const keys = [key1, key2, key3];
    // All 3 keys fail
    keys.forEach((k) =>
      quotaService.recordCategorizedError(k, model, {
        code: AIErrorCode.SERVER_ERROR,
        message: '500 All Down',
        isRetryable: true,
        recommendedAction: 'rotate_key',
        httpStatus: 500,
      })
    );

    quotaService.recordLogicalRequest(model, 'failure', 3, 2);

    const logical = quotaService.getCanonicalLogicalMetrics();
    expect(logical.logicalRequests).toBe(1);
    expect(logical.successfulRequests).toBe(0);
    expect(logical.failedRequests).toBe(1);

    const provider = quotaService.getCanonicalProviderMetrics();
    expect(provider.providerAttempts).toBe(3);
    expect(provider.retries).toBe(2);
    expect(provider.providerFailures).toBe(3);
  });
});
