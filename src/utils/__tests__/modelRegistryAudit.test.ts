import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDiscoveredModels,
  saveDiscoveredModels,
  migrateModelSelection,
  normalizeModelId,
  isDiscoveryStale,
} from '../modelRegistry';
import { DEFAULT_MODEL_ID } from '../../constants/models';
import { verifyStorageIntegrity } from '../storageAudit';

describe('User Story 4: Model Registry & UI Preference Hierarchy (TASK 13)', () => {
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
  });

  it('enforces 1-hour TTL expiration on discovered models cache', () => {
    const now = Date.now();
    const freshData = {
      timestamp: now - 30 * 60 * 1000, // 30 minutes ago (Fresh)
      models: [
        {
          id: 'gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          source: 'discovered',
        },
      ],
    };
    storageMock.setItem('gemini_discovered_models', JSON.stringify(freshData));

    // Fresh data is returned
    let discovered = getDiscoveredModels();
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe('gemini-2.5-flash');

    // Stale data (> 1 hour old)
    const staleData = {
      timestamp: now - 70 * 60 * 1000, // 70 minutes ago (Expired)
      models: [
        {
          id: 'gemini-old-model',
          displayName: 'Old Expired Model',
          source: 'discovered',
        },
      ],
    };
    storageMock.setItem('gemini_discovered_models', JSON.stringify(staleData));

    // Stale data (> 1 hour old) returns immediately for SWR, with isDiscoveryStale = true
    discovered = getDiscoveredModels();
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe('gemini-old-model');
    expect(isDiscoveryStale()).toBe(true);
  });

  it('migrates deprecated or missing models to DEFAULT_MODEL_ID', () => {
    // 1. Shutdown Gemini 1.5 Flash -> Fallback to replacement gemini-2.5-flash
    const migration1 = migrateModelSelection('gemini-1.5-flash');
    expect(migration1.isShutdown).toBe(true);
    expect(migration1.wasMigrated).toBe(true);
    expect(migration1.effectiveModelId).toBe('gemini-2.5-flash');

    // 2. Non-existent/empty model -> Fallback to default
    const migration2 = migrateModelSelection('');
    expect(migration2.effectiveModelId).toBe(DEFAULT_MODEL_ID);

    // 3. Valid active model -> Preserved
    const migration3 = migrateModelSelection('gemini-2.5-flash');
    expect(migration3.isDeprecated).toBe(false);
    expect(migration3.isShutdown).toBe(false);
    expect(migration3.effectiveModelId).toBe('gemini-2.5-flash');
  });

  it('maintains clean storage integrity report when saving model preferences', () => {
    storageMock.setItem('gemini_selected_model', 'gemini-2.5-flash');
    storageMock.setItem('app_locale', 'vi');

    saveDiscoveredModels([
      {
        name: 'models/gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash Exp',
        supportedGenerationMethods: ['generateContent'],
      },
    ]);

    const report = verifyStorageIntegrity(storageMock);
    expect(report.isValid).toBe(true);
    expect(report.violations).toHaveLength(0);
  });
});
