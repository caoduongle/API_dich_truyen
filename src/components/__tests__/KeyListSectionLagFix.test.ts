import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { migrateAndLoadApiKeys } from '../../hooks/useAIConfig';
import { computeModelStatsSummary } from '../../utils/modelRegistry';
import type { KeyQuotaFullSnapshot } from '../../types/quota';

describe('Key Configuration Lag & Lifecycle Fixes (Feature 118)', () => {
  let mockLocalStorage: Record<string, string> = {};
  let mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};

    const localStorageMock = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
      removeItem: (key: string) => { delete mockLocalStorage[key]; },
      clear: () => { mockLocalStorage = {}; },
    };

    const sessionStorageMock = {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, value: string) => { mockSessionStorage[key] = value; },
      removeItem: (key: string) => { delete mockSessionStorage[key]; },
      clear: () => { mockSessionStorage = {}; },
    };

    (global as any).localStorage = localStorageMock;
    (global as any).sessionStorage = sessionStorageMock;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores persisted keys from app_ui_prefs when sessionStorage is empty and rememberKeys is true', () => {
    mockLocalStorage['app_ui_prefs'] = JSON.stringify({
      rememberKeys: true,
      savedKeys: ['AIzaSySavedKey1', 'AIzaSySavedKey2'],
    });

    const keys = migrateAndLoadApiKeys();
    expect(keys).toEqual(['AIzaSySavedKey1', 'AIzaSySavedKey2']);
    // Restored to active sessionStorage
    expect(JSON.parse(mockSessionStorage['gemini_api_keys'])).toEqual(['AIzaSySavedKey1', 'AIzaSySavedKey2']);
  });

  it('does not restore keys if rememberKeys was explicitly set to false in app_ui_prefs', () => {
    mockLocalStorage['app_ui_prefs'] = JSON.stringify({
      rememberKeys: false,
      savedKeys: ['AIzaSySavedKey1'],
    });

    const keys = migrateAndLoadApiKeys();
    expect(keys).toEqual([]);
    expect(mockSessionStorage['gemini_api_keys']).toBeUndefined();
  });

  it('preset models avoid false negative unavailable banner when keys are configured and uninspected', () => {
    // When 2 keys are configured, but no keys have been inspected yet (inspectResults is empty)
    const summary = computeModelStatsSummary('gemini-2.5-flash', [], {}, 2);

    expect(summary.totalKeys).toBe(2);
    expect(summary.checkedKeyCount).toBe(0);
    expect(summary.hasChecked).toBe(false);
    expect(summary.isUnavailable).toBe(false);
  });

  it('custom or non-preset models remain with availableKeyCount 0 until actively inspected', () => {
    const summary = computeModelStatsSummary('custom-fine-tuned-model', [], {}, 2);

    expect(summary.totalKeys).toBe(2);
    expect(summary.availableKeyCount).toBe(0);
    expect(summary.hasChecked).toBe(false);
    expect(summary.isUnavailable).toBe(false);
  });
});
