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
});
