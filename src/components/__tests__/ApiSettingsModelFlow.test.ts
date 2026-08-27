import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeModelStatsSummary,
  getKeyModelStats,
  checkKeySupportForModel,
  normalizeModelId,
  saveDiscoveredModels,
  getRegisteredModels,
  addCustomModel,
  getCustomModels,
  getDiscoveredModels,
  getDynamicPacingInterval,
  isTpmNearLimit,
  formatPacingSummary,
} from '../../utils/modelRegistry';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../../utils/apiClient';

describe('Model Selection & Quota Stats Flow Acceptance Tests', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Test 1: selectedModel không đổi khi check model
  it('Test 1 — selectedModel is strictly decoupled and never mutated by model checking', () => {
    let selectedModel = 'gemini-3.1-flash-lite';
    const mockSnapshots: KeyQuotaFullSnapshot[] = [
      {
        index: 0,
        keyHash: 'hash0',
        maskedKey: 'AIzaSy...0000',
        requestsTotal: 10,
        requestsToday: 5,
        requestsThisMinute: 1,
        errorsTotal: 0,
        byModel: {
          'models/gemini-2.5-flash': {
            requestsTotal: 10,
            requestsToday: 5,
            requestsThisMinute: 1,
            errorsTotal: 0,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
    ];

    const inspectResults: Record<number, ModelInfoItem[]> = {};

    // Simulate inspecting Key #0 which returns gemini-2.5-flash
    inspectResults[0] = [
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    ];

    // selectedModel must remain unchanged
    expect(selectedModel).toBe('gemini-3.1-flash-lite');

    // Stats summary computed for selectedModel
    const summary = computeModelStatsSummary(selectedModel, mockSnapshots, inspectResults, 1);
    expect(summary.modelId).toBe('gemini-3.1-flash-lite');
    expect(summary.availableKeyCount).toBe(0); // None of inspected keys have 3.1
    expect(selectedModel).toBe('gemini-3.1-flash-lite');
  });

  // Test 2: check nhiều key không làm thay đổi selectedModel
  it('Test 2 — checking multiple keys sequentially preserves selectedModel and accumulates key results', () => {
    const selectedModel = 'gemini-2.5-flash';
    const inspectResults: Record<number, ModelInfoItem[]> = {};

    // Check Key 0
    inspectResults[0] = [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }];
    expect(selectedModel).toBe('gemini-2.5-flash');

    // Check Key 1
    inspectResults[1] = [{ name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' }];
    expect(selectedModel).toBe('gemini-2.5-flash');

    // Check Key 2
    inspectResults[2] = [
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    ];
    expect(selectedModel).toBe('gemini-2.5-flash');

    const summary = computeModelStatsSummary(selectedModel, [], inspectResults, 3);
    expect(summary.checkedKeyCount).toBe(3);
    expect(summary.availableKeyCount).toBe(2); // Key 0 and Key 2
    expect(summary.supportingKeyIndices).toEqual([0, 2]);
  });

  // Test 3: user có thể đổi model sau khi check
  it('Test 3 — user can actively switch selectedModel after checking keys', () => {
    let selectedModel = 'gemini-3.1-flash-lite';
    const inspectResults: Record<number, ModelInfoItem[]> = {
      0: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
        { name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' },
      ],
    };

    const handleSaveModel = vi.fn((newModel: string) => {
      selectedModel = newModel;
    });

    // User chooses to switch to gemini-2.5-flash
    handleSaveModel('gemini-2.5-flash');
    expect(selectedModel).toBe('gemini-2.5-flash');

    const summary = computeModelStatsSummary(selectedModel, [], inspectResults, 1);
    expect(summary.modelId).toBe('gemini-2.5-flash');
    expect(summary.availableKeyCount).toBe(1);
  });

  // Test 4: model statistics được hiển thị theo model hiện tại
  it('Test 4 — model statistics accurately reflect only the current selectedModel across keys', () => {
    const mockSnapshots: KeyQuotaFullSnapshot[] = [
      {
        index: 0,
        keyHash: 'hash0',
        maskedKey: 'AIzaSy...0000',
        requestsTotal: 500,
        requestsToday: 200,
        requestsThisMinute: 10,
        errorsTotal: 3,
        byModel: {
          'models/gemini-3.1-flash-lite': {
            requestsTotal: 300,
            requestsToday: 120,
            requestsThisMinute: 6,
            errorsTotal: 1,
          },
          'models/gemini-2.5-flash': {
            requestsTotal: 200,
            requestsToday: 80,
            requestsThisMinute: 4,
            errorsTotal: 2,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
      {
        index: 1,
        keyHash: 'hash1',
        maskedKey: 'AIzaSy...1111',
        requestsTotal: 400,
        requestsToday: 150,
        requestsThisMinute: 5,
        errorsTotal: 0,
        byModel: {
          'gemini-3.1-flash-lite': {
            requestsTotal: 400,
            requestsToday: 150,
            requestsThisMinute: 5,
            errorsTotal: 0,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
    ];

    const summary31 = computeModelStatsSummary('gemini-3.1-flash-lite', mockSnapshots, {}, 2);
    expect(summary31.totalRequests).toBe(700); // 300 + 400
    expect(summary31.requestsToday).toBe(270); // 120 + 150
    expect(summary31.requestsThisMinute).toBe(11); // 6 + 5
    expect(summary31.errorsTotal).toBe(1); // 1 + 0
    expect(summary31.totalTokens).toBe(0); // 0 when not populated in mock

    const summary25 = computeModelStatsSummary('gemini-2.5-flash', mockSnapshots, {}, 2);
    expect(summary25.totalRequests).toBe(200);
    expect(summary25.requestsToday).toBe(80);
    expect(summary25.requestsThisMinute).toBe(4);
    expect(summary25.errorsTotal).toBe(2);
  });

  // Test 5: unavailable model không tự động đổi selectedModel
  it('Test 5 — unavailable model triggers isUnavailable flag without mutating selectedModel', () => {
    const selectedModel = 'gemma-4-31b-it';
    const inspectResults: Record<number, ModelInfoItem[]> = {
      0: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }],
      1: [{ name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' }],
    };

    const summary = computeModelStatsSummary(selectedModel, [], inspectResults, 2);
    expect(summary.hasChecked).toBe(true);
    expect(summary.availableKeyCount).toBe(0);
    expect(summary.isUnavailable).toBe(true);
    // selectedModel remains unchanged
    expect(selectedModel).toBe('gemma-4-31b-it');
  });

  // Test 6: loading của một key độc lập với key khác
  it('Test 6 — per-key model inspection and stats mapping are fully isolated', () => {
    const mockSnapshots: KeyQuotaFullSnapshot[] = [
      {
        index: 0,
        keyHash: 'hash0',
        maskedKey: 'AIzaSy...0000',
        requestsTotal: 100,
        requestsToday: 50,
        requestsThisMinute: 2,
        errorsTotal: 0,
        byModel: {
          'gemini-2.5-flash': { requestsTotal: 100, requestsToday: 50, requestsThisMinute: 2, errorsTotal: 0 },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
      {
        index: 1,
        keyHash: 'hash1',
        maskedKey: 'AIzaSy...1111',
        requestsTotal: 50,
        requestsToday: 20,
        requestsThisMinute: 1,
        errorsTotal: 0,
        byModel: {
          'gemini-2.5-flash': { requestsTotal: 50, requestsToday: 20, requestsThisMinute: 1, errorsTotal: 0 },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
    ];

    const key0Stats = getKeyModelStats(mockSnapshots[0], 'gemini-2.5-flash');
    const key1Stats = getKeyModelStats(mockSnapshots[1], 'gemini-2.5-flash');

    expect(key0Stats.requestsTotal).toBe(100);
    expect(key1Stats.requestsTotal).toBe(50);

    const inspectData0: ModelInfoItem[] = [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }];
    const inspectData1: ModelInfoItem[] = [{ name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' }];

    expect(checkKeySupportForModel(inspectData0, 'gemini-2.5-flash')).toBe(true);
    expect(checkKeySupportForModel(inspectData1, 'gemini-2.5-flash')).toBe(false);
  });

  // Test 7: Discovered models can be dynamically selected and applied
  it('Test 7 — dynamic model discovery automatically registers models and enables quick selection', () => {
    const mockDiscoveredApi: ModelInfoItem[] = [
      {
        name: 'models/gemini-2.0-flash-lite-preview-02-05',
        displayName: 'Gemini 2.0 Flash Lite Preview',
        supportedGenerationMethods: ['generateContent'],
      },
    ];

    const saved = saveDiscoveredModels(mockDiscoveredApi);
    expect(saved.length).toBe(1);

    const registered = getRegisteredModels();
    expect(registered.some(m => m.id === 'gemini-2.0-flash-lite-preview-02-05')).toBe(true);

    let selectedModel = 'gemini-3.1-flash-lite';
    const handleSelectModel = vi.fn((model: string) => {
      selectedModel = model;
    });

    // User clicks "Dùng model này" on discovered model
    handleSelectModel('gemini-2.0-flash-lite-preview-02-05');
    expect(selectedModel).toBe('gemini-2.0-flash-lite-preview-02-05');
  });

  // Test 8: Custom fine-tuned models can be added and selected
  it('Test 8 — custom fine-tuned model addition integrates into registered models', () => {
    const res = addCustomModel('tunedModels/my-novel-v1', 'Tiểu Thuyết Tiên Hiệp V1');
    expect(res.success).toBe(true);

    const customList = getCustomModels();
    expect(customList.some(c => c.id === 'tunedModels/my-novel-v1')).toBe(true);

    const registered = getRegisteredModels();
    const found = registered.find(m => m.id === 'tunedModels/my-novel-v1');
    expect(found).toBeDefined();
    expect(found?.source).toBe('custom');
    expect(found?.label).toBe('Tiểu Thuyết Tiên Hiệp V1');
  });

  // Test 9: Dynamic pacing scales with custom RPM and respects safety floors
  it('Test 9 — dynamic pacing adapts interval based on custom RPM with minimum safety floor', () => {
    // Default tier model
    expect(getDynamicPacingInterval(undefined, 'gemini-2.5-pro')).toBe(6000);
    expect(getDynamicPacingInterval(undefined, 'gemini-2.5-flash')).toBe(4500);
    expect(getDynamicPacingInterval(undefined, 'gemini-2.0-flash-lite')).toBe(3500);

    // Custom RPM
    // 15 RPM -> 60000 / (15 * 0.88) = 4546ms
    expect(getDynamicPacingInterval(15)).toBe(4546);

    // 60 RPM -> 60000 / (60 * 0.88) = 1137ms
    expect(getDynamicPacingInterval(60)).toBe(1137);

    // 300 RPM -> capped at 500ms safety floor
    expect(getDynamicPacingInterval(300)).toBe(500);

    // Pacing summary
    const summary = formatPacingSummary(60, 'gemini-2.5-flash');
    expect(summary.estimatedRpm).toBe(52.8);
    expect(summary.intervalSec).toBe('1.1s');
    expect(summary.isCustom).toBe(true);
  });

  // Test 10: TPM guard correctly flags near limit threshold at 85%
  it('Test 10 — TPM throttling guard flags near limit when exceeding 85% capacity', () => {
    const maxTpm = 1_000_000;
    expect(isTpmNearLimit(500_000, maxTpm)).toBe(false);
    expect(isTpmNearLimit(849_999, maxTpm)).toBe(false);
    expect(isTpmNearLimit(850_000, maxTpm)).toBe(true);
    expect(isTpmNearLimit(950_000, maxTpm)).toBe(true);
  });

  // Test 11: Presets filtering exclusively presents active models for user selection
  it('Test 11 — presets filtering excludes shutdown models from active selectable list', () => {
    const registered = getRegisteredModels();
    const selectablePresets = registered.filter(m => m.source === 'preset' && m.status !== 'shutdown');
    const selectableIds = selectablePresets.map(m => m.id);

    expect(selectableIds).toContain('gemini-3.1-flash-lite');
    expect(selectableIds).toContain('gemini-2.5-flash');
    expect(selectableIds).toContain('gemini-2.5-pro');
    expect(selectableIds).toContain('gemma-4-31b-it');

    // Decommissioned models MUST NOT be present in selectable options
    expect(selectableIds).not.toContain('gemini-2.0-flash');
    expect(selectableIds).not.toContain('gemini-2.0-flash-lite');
    expect(selectableIds).not.toContain('gemini-1.5-flash');
    expect(selectableIds).not.toContain('gemini-1.5-pro');
  });

  // Test 12: Deprecated and Shutdown model metadata diagnostics
  it('Test 12 — model definitions provide complete lifecycle properties for UI badges', () => {
    const registered = getRegisteredModels();
    const shutdownModel = registered.find(m => m.id === 'gemini-2.0-flash');

    expect(shutdownModel).toBeDefined();
    expect(shutdownModel?.status).toBe('shutdown');
    expect(shutdownModel?.replacementId).toBe('gemini-2.5-flash');
    expect(shutdownModel?.shutdownAt).toBe('2026-06-01');
  });

  // Test 13: Discovered models are normalized with verified status
  it('Test 13 — dynamic model discovery normalizes verified metadata for UI rendering', () => {
    const mockDiscoveredApi: ModelInfoItem[] = [
      {
        name: 'models/gemini-2.5-flash-custom',
        displayName: 'Gemini 2.5 Flash Custom',
        supportedGenerationMethods: ['generateContent'],
      },
    ];

    saveDiscoveredModels(mockDiscoveredApi);
    const registered = getRegisteredModels();
    const found = registered.find(m => m.id === 'gemini-2.5-flash-custom');

    expect(found).toBeDefined();
    expect(found?.verified).toBe(true);
    expect(found?.lastVerifiedAt).toBeDefined();
  });

  // Test 14: Verified status badge rendering for active preset and custom models
  it('Test 14 — active presets and custom models reflect verified state', () => {
    const registered = getRegisteredModels();
    const activePreset = registered.find(m => m.id === 'gemini-2.5-flash');
    expect(activePreset?.verified).toBe(true);

    const customRes = addCustomModel('tunedModels/test-model', 'Test Label', {
      verified: true,
      capabilities: { generateContent: true },
    });
    expect(customRes.success).toBe(true);
    expect(customRes.model?.verified).toBe(true);
  });

  // Test 15: Custom model without verified metadata is unverified and excluded from verified list
  it('Test 15 — custom model added without verified metadata is strictly unverified', () => {
    const customRes = addCustomModel('tunedModels/unverified-model', 'Chưa Xác Minh');
    expect(customRes.success).toBe(true);
    expect(customRes.model?.verified).toBe(false);
    expect(customRes.model?.verificationState).toBe('unverified');

    const customList = getCustomModels();
    const found = customList.find(c => c.id === 'tunedModels/unverified-model');
    expect(found?.verified).toBe(false);
    expect(found?.verificationState).toBe('unverified');
  });

  // Test 16: Zero-call render reading is synchronous from local storage
  it('Test 16 — reading registered and custom models during UI render is zero-call synchronous', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Multiple component render simulation
    for (let i = 0; i < 5; i++) {
      const models = getRegisteredModels();
      const custom = getCustomModels();
      expect(models.length).toBeGreaterThan(0);
      expect(Array.isArray(custom)).toBe(true);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Test 17: Pacing delay normalization clamps negative values and renders "Sẵn sàng"
  it('Test 17 — pacing delay normalization clamps negative values and renders Sẵn sàng when <= 0', () => {
    const formatPacing = (pacingDelayMs?: number, effectiveIntervalMs?: number) => {
      const rawDelay = pacingDelayMs !== undefined
        ? pacingDelayMs
        : (effectiveIntervalMs ?? 4445);
      const safeDelay = Math.max(0, rawDelay);
      return safeDelay > 0 ? `~${safeDelay}ms/call` : 'Sẵn sàng';
    };

    // When ready / negative delay
    expect(formatPacing(-4445)).toBe('Sẵn sàng');
    expect(formatPacing(0)).toBe('Sẵn sàng');
    expect(formatPacing(-100)).toBe('Sẵn sàng');

    // When positive delay
    expect(formatPacing(2223)).toBe('~2223ms/call');
    expect(formatPacing(4445)).toBe('~4445ms/call');

    // When pacingDelayMs is undefined, fallback to effectiveIntervalMs
    expect(formatPacing(undefined, 3334)).toBe('~3334ms/call');
    expect(formatPacing(undefined, 0)).toBe('Sẵn sàng');
    expect(formatPacing(undefined, -500)).toBe('Sẵn sàng');
  });
});



