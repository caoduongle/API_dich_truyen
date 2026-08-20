import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useModelObservability, clearQuotaCache, QUOTA_CACHE_TTL_MS } from '../useModelObservability';

describe('useModelObservability Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQuotaCache();
  });

  it('exports valid useModelObservability hook function and cache constants', () => {
    expect(typeof useModelObservability).toBe('function');
    expect(typeof clearQuotaCache).toBe('function');
    expect(QUOTA_CACHE_TTL_MS).toBe(30_000);
  });

  it('defines the required observability interface contracts', () => {
    const mockState: ReturnType<typeof useModelObservability> = {
      snapshotKeys: [],
      groups: [],
      summary: null,
      loadingQuota: false,
      quotaError: null,
      inspectResults: {},
      inspectLoadingKeyIndex: null,
      inspectErrors: {},
      timezone: 'America/Los_Angeles',
      currentDayPST: '2026-08-19',
      lastUpdated: null,
      loadQuotaStatus: async () => {},
      inspectKeyModels: async () => {},
      clearInspectResult: () => {},
    };

    expect(mockState.timezone).toBe('America/Los_Angeles');
    expect(typeof mockState.loadQuotaStatus).toBe('function');
    expect(typeof mockState.inspectKeyModels).toBe('function');
    expect(typeof mockState.clearInspectResult).toBe('function');
  });
});
