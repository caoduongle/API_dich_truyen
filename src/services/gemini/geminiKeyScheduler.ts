/**
 * Gemini API Key Scheduler
 * Điều phối, kiểm tra trạng thái sức khỏe và xoay vòng danh sách API keys
 */

import { localQuotaTracker, hashApiKey } from '../localQuotaTracker';
import { getStoredCustomLimits } from '../../utils/customLimitsStorage';
import { CustomLimit } from '../../types/quota';

export interface KeyScheduleState {
  rawKeys: string[];
  customLimits: Record<string, CustomLimit>;
  currentKeyIdx: number;
  attemptsCount: number;
}

export function initKeySchedule(apiKeys: string[], startKeyIndex?: number): KeyScheduleState {
  const rawKeys = Array.isArray(apiKeys)
    ? apiKeys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
    : [];

  if (rawKeys.length === 0) {
    throw new Error('Không tìm thấy API Key nào. Vui lòng cấu hình API Key cá nhân trong phần Cấu hình AI.');
  }

  // Tự động kích hoạt di trú cấu hình hạn mức từ mã băm cũ sang SHA-256 mới
  const customLimits = getStoredCustomLimits(rawKeys);
  const startIdx = startKeyIndex && startKeyIndex >= 0 ? startKeyIndex % rawKeys.length : 0;
  const initialAvailableIdx = localQuotaTracker.findNextAvailableKeyIndex(rawKeys, startIdx, customLimits);

  if (initialAvailableIdx === -1) {
    const quotaErr = new Error(
      'Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED hoặc đã chạm ngưỡng cá nhân). Vui lòng kiểm tra Bảng điều khiển Quota.'
    );
    (quotaErr as any).code = 'ALL_KEYS_EXHAUSTED';
    throw quotaErr;
  }

  return {
    rawKeys,
    customLimits,
    currentKeyIdx: initialAvailableIdx,
    attemptsCount: 0,
  };
}

export function isKeyAvailable(key: string, customLimits: Record<string, CustomLimit>): boolean {
  const keyHash = hashApiKey(key);
  const keyLimit = customLimits[keyHash];
  const health = localQuotaTracker.getKeyHealth(key, Date.now(), keyLimit);
  return health.isAvailable;
}

export function findNextKey(
  rawKeys: string[],
  currentKeyIdx: number,
  customLimits: Record<string, CustomLimit>
): number {
  return localQuotaTracker.findNextAvailableKeyIndex(
    rawKeys,
    (currentKeyIdx + 1) % rawKeys.length,
    customLimits
  );
}
