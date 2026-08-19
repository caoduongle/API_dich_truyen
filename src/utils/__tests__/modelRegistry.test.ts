import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeModelId,
  getModelDisplayName,
  computeModelStatsSummary,
  getKeyModelStats,
  checkKeySupportForModel,
  isValidModelIdFormat,
  getPresetModels,
  getDiscoveredModels,
  getCustomModels,
  getRegisteredModels,
  saveDiscoveredModels,
  addCustomModel,
  removeCustomModel,
  clearDiscoveredModels,
  formatTokenCount,
  getDynamicPacingInterval,
  isTpmNearLimit,
  formatPacingSummary,
} from '../modelRegistry';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../apiClient';

describe('modelRegistry utils', () => {
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

  describe('isValidModelIdFormat', () => {
    it('validates safe model strings properly', () => {
      expect(isValidModelIdFormat('gemini-2.5-flash')).toBe(true);
      expect(isValidModelIdFormat('gemini-2.0-flash-lite-preview-02-05')).toBe(true);
      expect(isValidModelIdFormat('tunedModels/my-model-1')).toBe(true);
      expect(isValidModelIdFormat('custom.model_v1')).toBe(true);

      expect(isValidModelIdFormat('../evil/path')).toBe(false);
      expect(isValidModelIdFormat('has space')).toBe(false);
      expect(isValidModelIdFormat('\0nullbyte')).toBe(false);
      expect(isValidModelIdFormat('')).toBe(false);
      expect(isValidModelIdFormat('a'.repeat(129))).toBe(false);
    });
  });

  describe('normalizeModelId', () => {
    it('strips leading models/ prefix and lowercases string', () => {
      expect(normalizeModelId('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
      expect(normalizeModelId('models/Gemini-3.1-Flash-Lite')).toBe('gemini-3.1-flash-lite');
      expect(normalizeModelId('gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(normalizeModelId('')).toBe('');
    });
  });

  describe('Dynamic Registry: saveDiscoveredModels & getRegisteredModels', () => {
    it('filters models with generateContent and deduplicates with presets', () => {
      const mockApiModels: ModelInfoItem[] = [
        {
          name: 'models/gemini-2.5-flash', // Trùng Preset -> Không trùng lặp
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/text-embedding-004', // Không có generateContent -> Bị lọc bỏ
          displayName: 'Text Embedding 004',
          supportedGenerationMethods: ['embedContent'],
        },
        {
          name: 'models/gemini-2.0-flash-exp', // Model mới hợp lệ -> Được lưu
          displayName: 'Gemini 2.0 Flash Experimental',
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      const saved = saveDiscoveredModels(mockApiModels);
      expect(saved.length).toBe(1);
      expect(saved[0].id).toBe('gemini-2.0-flash-exp');
      expect(saved[0].source).toBe('discovered');

      const allRegistered = getRegisteredModels();
      // 5 Presets + 1 Discovered = 6
      expect(allRegistered.length).toBe(getPresetModels().length + 1);
      expect(allRegistered.some(m => m.id === 'gemini-2.0-flash-exp')).toBe(true);
    });
  });

  describe('Dynamic Registry: addCustomModel & removeCustomModel', () => {
    it('adds valid custom model and prevents adding existing presets', () => {
      const res = addCustomModel('tunedModels/my-special-model', 'My Fine-tuned Novel Model');
      expect(res.success).toBe(true);
      expect(res.model?.id).toBe('tunedModels/my-special-model');
      expect(res.model?.source).toBe('custom');

      const customList = getCustomModels();
      expect(customList.length).toBe(1);

      // Attempting to add a duplicate of preset must fail
      const dupPreset = addCustomModel('gemini-2.5-flash');
      expect(dupPreset.success).toBe(false);
      expect(dupPreset.error).toContain('khuyên dùng');

      // Attempting to add duplicate custom model must fail
      const dupCustom = addCustomModel('tunedModels/my-special-model');
      expect(dupCustom.success).toBe(false);
      expect(dupCustom.error).toContain('tồn tại');
    });

    it('removes custom model cleanly', () => {
      addCustomModel('custom-model-1');
      addCustomModel('custom-model-2');
      expect(getCustomModels().length).toBe(2);

      const afterRemove = removeCustomModel('custom-model-1');
      expect(afterRemove.length).toBe(1);
      expect(afterRemove[0].id).toBe('custom-model-2');
    });
  });

  describe('getModelDisplayName', () => {
    it('resolves Vietnamese label from AVAILABLE_MODELS and registered models', () => {
      expect(getModelDisplayName('gemini-2.5-flash')).toContain('Gemini 2.5 Flash');
      expect(getModelDisplayName('models/gemini-3.1-flash-lite')).toContain('Gemini 3.1 Flash Lite');

      addCustomModel('my-custom-model', 'Bản Dịch Thần Thoại V1');
      expect(getModelDisplayName('my-custom-model')).toBe('Bản Dịch Thần Thoại V1');
    });
  });

  describe('formatTokenCount', () => {
    it('formats token numbers cleanly with k and M suffixes', () => {
      expect(formatTokenCount(500)).toBe('500');
      expect(formatTokenCount(1500)).toBe('1.5k');
      expect(formatTokenCount(250000)).toBe('250k');
      expect(formatTokenCount(1200000)).toBe('1.2M');
      expect(formatTokenCount(0)).toBe('0');
    });
  });

  describe('computeModelStatsSummary', () => {
    const mockSnapshots: KeyQuotaFullSnapshot[] = [
      {
        index: 0,
        keyHash: 'hash1',
        maskedKey: 'AIzaSy...1111',
        requestsTotal: 100,
        requestsToday: 40,
        requestsThisMinute: 5,
        errorsTotal: 2,
        tokensTotal: 150000,
        tokensToday: 60000,
        tokensThisMinute: 7500,
        byModel: {
          'models/gemini-3.1-flash-lite': {
            requestsTotal: 60,
            requestsToday: 25,
            requestsThisMinute: 3,
            errorsTotal: 1,
            tokensTotal: 90000,
            tokensToday: 35000,
            tokensThisMinute: 4500,
          },
          'gemini-2.5-flash': {
            requestsTotal: 40,
            requestsToday: 15,
            requestsThisMinute: 2,
            errorsTotal: 1,
            tokensTotal: 60000,
            tokensToday: 25000,
            tokensThisMinute: 3000,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
      {
        index: 1,
        keyHash: 'hash2',
        maskedKey: 'AIzaSy...2222',
        requestsTotal: 80,
        requestsToday: 30,
        requestsThisMinute: 4,
        errorsTotal: 0,
        tokensTotal: 120000,
        tokensToday: 45000,
        tokensThisMinute: 6000,
        byModel: {
          'gemini-3.1-flash-lite': {
            requestsTotal: 80,
            requestsToday: 30,
            requestsThisMinute: 4,
            errorsTotal: 0,
            tokensTotal: 120000,
            tokensToday: 45000,
            tokensThisMinute: 6000,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      },
    ];

    const mockInspectResults: Record<number, ModelInfoItem[]> = {
      0: [
        { name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' },
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      ],
      1: [
        { name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' },
      ],
    };

    it('accurately sums request and token metrics for the selected model across all keys', () => {
      const summary = computeModelStatsSummary(
        'gemini-3.1-flash-lite',
        mockSnapshots,
        mockInspectResults,
        2
      );

      expect(summary.totalRequests).toBe(140); // 60 + 80
      expect(summary.requestsToday).toBe(55); // 25 + 30
      expect(summary.requestsThisMinute).toBe(7); // 3 + 4
      expect(summary.errorsTotal).toBe(1); // 1 + 0
      expect(summary.totalTokens).toBe(210000); // 90k + 120k
      expect(summary.tokensToday).toBe(80000); // 35k + 45k
      expect(summary.tokensThisMinute).toBe(10500); // 4500 + 6000
      expect(summary.totalKeys).toBe(2);
      expect(summary.checkedKeyCount).toBe(2);
      expect(summary.availableKeyCount).toBe(2);
      expect(summary.supportingKeyIndices).toEqual([0, 1]);
      expect(summary.hasChecked).toBe(true);
      expect(summary.isUnavailable).toBe(false);
    });

    it('reports partial key availability accurately', () => {
      const summary = computeModelStatsSummary(
        'gemini-2.5-flash',
        mockSnapshots,
        mockInspectResults,
        2
      );

      expect(summary.totalRequests).toBe(40);
      expect(summary.checkedKeyCount).toBe(2);
      expect(summary.availableKeyCount).toBe(1); // Only key 0 has gemini-2.5-flash
      expect(summary.supportingKeyIndices).toEqual([0]);
      expect(summary.isUnavailable).toBe(false);
    });

    it('identifies unavailable model when checked keys do not support it', () => {
      const summary = computeModelStatsSummary(
        'gemini-2.5-pro',
        mockSnapshots,
        mockInspectResults,
        2
      );

      expect(summary.totalRequests).toBe(0);
      expect(summary.checkedKeyCount).toBe(2);
      expect(summary.availableKeyCount).toBe(0);
      expect(summary.hasChecked).toBe(true);
      expect(summary.isUnavailable).toBe(true);
    });

    it('handles uninspected state gracefully', () => {
      const summary = computeModelStatsSummary(
        'gemini-3.1-flash-lite',
        mockSnapshots,
        {}, // No keys inspected yet
        2
      );

      expect(summary.checkedKeyCount).toBe(0);
      expect(summary.availableKeyCount).toBe(0);
      expect(summary.hasChecked).toBe(false);
      expect(summary.isUnavailable).toBe(false);
    });
  });

  describe('getKeyModelStats', () => {
    it('returns specific model metrics for a single key', () => {
      const keySnapshot: KeyQuotaFullSnapshot = {
        index: 0,
        keyHash: 'hash1',
        maskedKey: 'AIzaSy...1111',
        requestsTotal: 50,
        requestsToday: 20,
        requestsThisMinute: 2,
        errorsTotal: 0,
        byModel: {
          'models/gemini-2.5-pro': {
            requestsTotal: 30,
            requestsToday: 10,
            requestsThisMinute: 1,
            errorsTotal: 0,
          },
        },
        runtime: { isBlacklisted: false, blacklistRemainingMs: 0, isRateLimited: false, nextAllowedRemainingMs: 0 },
      };

      const stats = getKeyModelStats(keySnapshot, 'gemini-2.5-pro');
      expect(stats.requestsTotal).toBe(30);
      expect(stats.requestsToday).toBe(10);

      const nonExistent = getKeyModelStats(keySnapshot, 'gemini-2.5-flash');
      expect(nonExistent.requestsTotal).toBe(0);
    });
  });

  describe('checkKeySupportForModel', () => {
    it('returns uninspected when list is undefined or empty', () => {
      expect(checkKeySupportForModel(undefined, 'gemini-2.5-flash')).toBe('uninspected');
      expect(checkKeySupportForModel([], 'gemini-2.5-flash')).toBe('uninspected');
    });

    it('returns true when model is in inspected list', () => {
      const models: ModelInfoItem[] = [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      ];
      expect(checkKeySupportForModel(models, 'gemini-2.5-flash')).toBe(true);
      expect(checkKeySupportForModel(models, 'models/gemini-2.5-flash')).toBe(true);
    });

    it('returns false when inspected list does not contain model', () => {
      const models: ModelInfoItem[] = [
        { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
      ];
      expect(checkKeySupportForModel(models, 'gemini-2.5-flash')).toBe(false);
    });
  });

  describe('Dynamic Pacing & Rate Limiting Helpers', () => {
    describe('getDynamicPacingInterval', () => {
      it('calculates safe interval for standard Free Tier (15 RPM)', () => {
        const interval = getDynamicPacingInterval(15);
        // 60000 / (15 * 0.88) = ~4545.45 -> ceil = 4546
        expect(interval).toBe(4546);
      });

      it('calculates safe interval for Pay-as-you-go Tier (60 RPM & 120 RPM)', () => {
        const interval60 = getDynamicPacingInterval(60);
        // 60000 / (60 * 0.88) = ~1136.36 -> ceil = 1137
        expect(interval60).toBe(1137);

        const interval120 = getDynamicPacingInterval(120);
        // 60000 / (120 * 0.88) = ~568.18 -> ceil = 569
        expect(interval120).toBe(569);
      });

      it('enforces safety floor of 500ms for very high RPM (300 RPM)', () => {
        const interval300 = getDynamicPacingInterval(300);
        // 60000 / (300 * 0.88) = 227ms -> Clamped to floor 500ms
        expect(interval300).toBe(500);
      });

      it('falls back to model tier defaults when custom RPM is not provided or <= 0', () => {
        expect(getDynamicPacingInterval(undefined, 'gemini-2.5-flash')).toBe(4500);
        expect(getDynamicPacingInterval(0, 'gemini-2.5-pro')).toBe(6000);
        expect(getDynamicPacingInterval(undefined, 'gemini-3.1-flash-lite')).toBe(3500);
      });
    });

    describe('isTpmNearLimit', () => {
      it('returns true when current TPM reaches or exceeds 85% of limit', () => {
        expect(isTpmNearLimit(850000, 1000000)).toBe(true);
        expect(isTpmNearLimit(920000, 1000000)).toBe(true);
        expect(isTpmNearLimit(840000, 1000000)).toBe(false);
        expect(isTpmNearLimit(0, 1000000)).toBe(false);
      });
    });

    describe('formatPacingSummary', () => {
      it('formats pacing summary object accurately', () => {
        const summary = formatPacingSummary(60);
        expect(summary.isCustom).toBe(true);
        expect(summary.intervalSec).toBe('1.1s');
        expect(summary.estimatedRpm).toBeCloseTo(52.8, 1);

        const defaultSummary = formatPacingSummary(undefined, 'gemini-2.5-flash');
        expect(defaultSummary.isCustom).toBe(false);
        expect(defaultSummary.intervalMs).toBe(4500);
        expect(defaultSummary.intervalSec).toBe('4.5s');
      });
    });
  });
});
