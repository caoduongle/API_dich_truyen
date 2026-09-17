import { describe, it, expect, beforeEach } from 'vitest';
import {
  initKeySchedule,
  isKeyAvailable,
  findNextKey,
} from '../geminiKeyScheduler';
import {
  saveStoredCustomLimits,
  clearStoredCustomLimits,
  DEFAULT_CUSTOM_LIMIT,
  legacyHashApiKey,
  hashApiKey,
} from '../../../utils/customLimitsStorage';
import { localQuotaTracker } from '../../localQuotaTracker';

describe('geminiKeyScheduler & Runtime Custom Limits Migration', () => {
  const testKey1 = 'AIzaSySchedulerTestKey_11111111111';
  const testKey2 = 'AIzaSySchedulerTestKey_22222222222';

  beforeEach(() => {
    clearStoredCustomLimits();
    localQuotaTracker.resetMetrics();
  });

  it('automatically triggers custom limits migration during initKeySchedule', () => {
    const legacyHash1 = legacyHashApiKey(testKey1);
    const sha256Hash1 = hashApiKey(testKey1);

    // Lưu cấu hình dưới mã băm cũ (32-bit hex chunk lặp)
    saveStoredCustomLimits({
      [legacyHash1]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 120 },
    });

    const state = initKeySchedule([testKey1, testKey2]);

    expect(state.rawKeys).toEqual([testKey1, testKey2]);
    expect(state.currentKeyIdx).toBe(0);

    // Cấu hình phải được di trú sang SHA-256 trong customLimits của scheduler
    expect(state.customLimits[legacyHash1]).toBeUndefined();
    expect(state.customLimits[sha256Hash1]).toBeDefined();
    expect(state.customLimits[sha256Hash1].maxRpd).toBe(120);
  });

  it('throws error when no valid keys are provided', () => {
    expect(() => initKeySchedule([])).toThrow('Không tìm thấy API Key nào');
    expect(() => initKeySchedule(['   ', ''])).toThrow('Không tìm thấy API Key nào');
  });

  it('correctly tracks isKeyAvailable and findNextKey with custom limits', () => {
    const key = testKey1;
    const sha256 = hashApiKey(key);
    const customLimits = {
      [sha256]: { ...DEFAULT_CUSTOM_LIMIT, maxRpd: 1 },
    };

    expect(isKeyAvailable(key, customLimits)).toBe(true);

    // Gọi 1 request thành công
    localQuotaTracker.recordProviderAttempt(key, 'gemini-2.5-flash');
    localQuotaTracker.recordSuccess(key, 'gemini-2.5-flash', { totalTokens: 100 });

    // Giờ đã chạm ngưỡng maxRpd = 1
    expect(isKeyAvailable(key, customLimits)).toBe(false);

    // findNextKey với key thứ 2 còn hạn mức
    const nextIdx = findNextKey([testKey1, testKey2], 0, customLimits);
    expect(nextIdx).toBe(1);
  });
});
