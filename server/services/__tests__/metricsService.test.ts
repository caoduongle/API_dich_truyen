import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from '../metricsService';
import { Logger } from '../../utils/logger';

describe('Metrics & Structured Logger System', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService();
  });

  it('records requests, status codes, and latency accurately', () => {
    metrics.recordRequest('POST', '/api/translate-raw', 200, 150);
    metrics.recordRequest('POST', '/api/translate-raw', 200, 250);
    metrics.recordRequest('POST', '/api/polish-translation', 500, 500);

    const summary = metrics.getMetrics();
    expect(summary.totalRequests).toBe(3);
    expect(summary.totalErrors).toBe(1);
    expect(summary.errorRatePercent).toBe(33.3);
    expect(summary.avgLatencyMs).toBe(300);
    expect(summary.statusCodes['200']).toBe(2);
    expect(summary.statusCodes['500']).toBe(1);

    expect(summary.endpoints['POST /api/translate-raw'].count).toBe(2);
    expect(summary.endpoints['POST /api/translate-raw'].avgLatencyMs).toBe(200);
    expect(summary.endpoints['POST /api/translate-raw'].errorCount).toBe(0);

    expect(summary.endpoints['POST /api/polish-translation'].errorCount).toBe(1);
  });

  it('provides formatted uptime and memory usage', () => {
    const uptimeStr = metrics.getFormattedUptime();
    expect(typeof uptimeStr).toBe('string');
    expect(uptimeStr.length).toBeGreaterThan(0);

    const mem = metrics.getMemoryUsage();
    expect(mem).toHaveProperty('rssMb');
    expect(mem).toHaveProperty('heapUsedMb');
  });

  it('tracks logical requests vs provider attempts and retries independently (Core Law 3)', () => {
    // 1 user request that needed 2 retries (3 provider attempts) and succeeded
    metrics.recordLogicalRequest(true);
    metrics.recordProviderAttempt('gemini-2.5-flash', false, 100);
    metrics.recordRetry();
    metrics.recordProviderAttempt('gemini-2.5-flash', false, 120);
    metrics.recordRetry();
    metrics.recordProviderAttempt('gemini-2.5-flash', true, 250);

    const summary = metrics.getMetrics();
    expect(summary.logicalRequestsTotal).toBe(1);
    expect(summary.successfulLogicalRequests).toBe(1);
    expect(summary.failedLogicalRequests).toBe(0);
    expect(summary.providerAttemptsTotal).toBe(3);
    expect(summary.retriesTotal).toBe(2);
  });
});
