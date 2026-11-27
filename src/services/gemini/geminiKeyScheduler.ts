/**
 * Gemini API Key Scheduler
 * Điều phối, kiểm tra trạng thái sức khỏe và xoay vòng danh sách API keys
 */

import { localQuotaTracker, hashApiKey, type PoolCooldownAnalysis } from '../localQuotaTracker';
import { getStoredCustomLimits } from '../../utils/customLimitsStorage';
import { CustomLimit } from '../../types/quota';
import { GeminiRequestError } from './types';

export interface KeyScheduleState {
  rawKeys: string[];
  customLimits: Record<string, CustomLimit>;
  currentKeyIdx: number;
  attemptsCount: number;
}

export function inspectKeyPoolCooldown(
  apiKeys: string[],
  customLimits?: Record<string, CustomLimit>,
  now: number = Date.now()
): PoolCooldownAnalysis {
  return localQuotaTracker.getPoolCooldownAnalysis(apiKeys, customLimits, now);
}

export function buildAllKeysUnavailableError(
  rawKeys: string[],
  customLimits: Record<string, CustomLimit>,
  detailMessage?: string
): GeminiRequestError {
  const pool = localQuotaTracker.getPoolCooldownAnalysis(rawKeys, customLimits);
  if (pool.hasRecoverableCooldown && pool.minCooldownRemainingMs > 0) {
    const waitSec = Math.ceil(pool.minCooldownRemainingMs / 1000);
    return new GeminiRequestError(
      `Toàn bộ API Key đang tạm nghỉ do chạm hạn mức 429 RPM (chờ hồi phục sau ~${waitSec}s).${detailMessage ? ` Chi tiết: ${detailMessage}` : ''}`,
      {
        code: 'ALL_KEYS_EXHAUSTED',
        category: 'RATE_LIMIT_RPM',
        status: 429,
        isRetryable: true,
        retryAfterMs: pool.minCooldownRemainingMs,
      }
    );
  }

  return new GeminiRequestError(
    detailMessage
      ? `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${detailMessage}`
      : 'Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED hoặc đã chạm ngưỡng cá nhân). Vui lòng kiểm tra Bảng điều khiển Quota.',
    {
      code: 'ALL_KEYS_EXHAUSTED',
      category: 'QUOTA_EXHAUSTED_RPD',
      status: 429,
      isRetryable: false,
    }
  );
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
    throw buildAllKeysUnavailableError(rawKeys, customLimits);
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
