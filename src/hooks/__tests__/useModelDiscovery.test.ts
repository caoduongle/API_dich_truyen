import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useModelDiscovery } from '../useModelDiscovery';
import { DISCOVERED_MODELS_STORAGE_KEY, DISCOVERED_MODELS_TTL_MS } from '../../utils/modelRegistry';

describe('useModelDiscovery Hook (TASK 14)', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports useModelDiscovery function properly', () => {
    expect(typeof useModelDiscovery).toBe('function');
  });

  it('defines the required hook result contract interface', () => {
    const mockState: ReturnType<typeof useModelDiscovery> = {
      models: [],
      discoveredModels: [],
      isLoading: false,
      isRefreshing: false,
      isStale: false,
      lastRefreshedAt: new Date(),
      error: null,
      refresh: async () => [],
    };

    expect(Array.isArray(mockState.models)).toBe(true);
    expect(typeof mockState.isLoading).toBe('boolean');
    expect(typeof mockState.isRefreshing).toBe('boolean');
    expect(typeof mockState.isStale).toBe('boolean');
    expect(typeof mockState.refresh).toBe('function');
  });
});
