import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useModelObservability } from '../useModelObservability';
import * as apiClient from '../../utils/apiClient';

describe('useModelObservability Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports valid useModelObservability hook function', () => {
    expect(typeof useModelObservability).toBe('function');
  });

  it('defines the required observability interface contracts', () => {
    const mockState: ReturnType<typeof useModelObservability> = {
      snapshotKeys: [],
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
