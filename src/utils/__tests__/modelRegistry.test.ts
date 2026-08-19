import { describe, it, expect } from 'vitest';
import {
  normalizeModelId,
  getModelDisplayName,
  computeModelStatsSummary,
  getKeyModelStats,
  checkKeySupportForModel,
} from '../modelRegistry';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../apiClient';

describe('modelRegistry utils', () => {
  describe('normalizeModelId', () => {
    it('strips leading models/ prefix and lowercases string', () => {
      expect(normalizeModelId('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
      expect(normalizeModelId('models/Gemini-3.1-Flash-Lite')).toBe('gemini-3.1-flash-lite');
      expect(normalizeModelId('gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(normalizeModelId('')).toBe('');
    });
  });

  describe('getModelDisplayName', () => {
    it('resolves Vietnamese label from AVAILABLE_MODELS', () => {
      expect(getModelDisplayName('gemini-2.5-flash')).toContain('Gemini 2.5 Flash');
      expect(getModelDisplayName('models/gemini-3.1-flash-lite')).toContain('Gemini 3.1 Flash Lite');
      expect(getModelDisplayName('unknown-model')).toBe('unknown-model');
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
        byModel: {
          'models/gemini-3.1-flash-lite': {
            requestsTotal: 60,
            requestsToday: 25,
            requestsThisMinute: 3,
            errorsTotal: 1,
          },
          'gemini-2.5-flash': {
            requestsTotal: 40,
            requestsToday: 15,
            requestsThisMinute: 2,
            errorsTotal: 1,
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
        byModel: {
          'gemini-3.1-flash-lite': {
            requestsTotal: 80,
            requestsToday: 30,
            requestsThisMinute: 4,
            errorsTotal: 0,
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

    it('accurately sums request metrics for the selected model across all keys', () => {
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
});
