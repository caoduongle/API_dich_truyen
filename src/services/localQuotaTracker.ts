/**
 * Client-Side Quota Tracker & Key Health Monitor (Zero Backend)
 * Theo dõi hạn mức RPM/TPM, hạn mức ngày RPD (chu kỳ PST), Circuit Breaker và xoay vòng API key an toàn trực tiếp trên trình duyệt.
 */

import type {
  KeyQuotaFullSnapshot,
  LogicalSummaryStats,
  ModelUsageStats,
  QuotaStatusResponse,
  KeyHealthState,
  KeyRuntimeStatus,
  CustomLimit,
  UnlockKeyResult,
} from '../types/quota';
import { getStoredCustomLimits } from '../utils/customLimitsStorage';
import {
  getDefaultReferenceLimitFallback,
  getFamilyReferenceLimits,
  normalizeModelId,
} from '../utils/modelReferenceLimits';
import { classifyGeminiError } from './gemini/geminiErrorClassifier';
import { RATE_LIMIT_RECOVERY_CONFIG } from '../config/constants';

const DEFAULT_FALLBACK_MAX_RPM = 15;
const DEFAULT_AMBIGUOUS_429_DAILY_REF = 500;
const MAX_PROACTIVE_WAIT_MS = 65_000;
const MAX_PROVIDER_DAILY_DELAY_MS = 48 * 3_600_000;

function sanitizePositiveLimit(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export interface PoolCooldownAnalysis {
  availableKeyIndex: number;
  minCooldownRemainingMs: number;
  nextRecoveringKeyIndex: number;
  hasRecoverableCooldown: boolean;
  allPermanentlyExhausted: boolean;
  isProactivePacingOnly?: boolean;
}

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
  isProactivePacing?: boolean;
  isLowUsageDailyExhaustion?: boolean;
}

export interface KeyHealthOptions {
  enforceProactiveLimits?: boolean;
  model?: string;
}

export interface CallAttemptEntry {
  timestamp: number;
}

export interface CallTokenEntry {
  timestamp: number;
  tokens: number;
}

export type CallLogEntry = CallTokenEntry;

export function sanitizeRecentAttempts(
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries: number = 100
): CallAttemptEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: CallAttemptEntry[] = [];
  for (const a of raw) {
    if (
      a &&
      typeof a === 'object' &&
      typeof (a as { timestamp?: unknown }).timestamp === 'number' &&
      (a as { timestamp: number }).timestamp > minuteThreshold &&
      (a as { timestamp: number }).timestamp <= maxFutureTimestamp
    ) {
      valid.push({ timestamp: (a as { timestamp: number }).timestamp });
    }
  }
  return valid.slice(-maxEntries);
}

export function sanitizeRecentTokens(
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries: number = 100
): CallTokenEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: CallTokenEntry[] = [];
  for (const t of raw) {
    if (
      t &&
      typeof t === 'object' &&
      typeof (t as { timestamp?: unknown }).timestamp === 'number' &&
      typeof (t as { tokens?: unknown }).tokens === 'number' &&
      (t as { timestamp: number }).timestamp > minuteThreshold &&
      (t as { timestamp: number }).timestamp <= maxFutureTimestamp &&
      (t as { tokens: number }).tokens >= 0
    ) {
      valid.push({
        timestamp: (t as { timestamp: number }).timestamp,
        tokens: (t as { tokens: number }).tokens,
      });
    }
  }
  return valid.slice(-maxEntries);
}

export interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  recentAttempts: CallAttemptEntry[];
  recentTokens: CallTokenEntry[];
  lastResetDay: string;
  healthState: KeyHealthState;
  circuitBreakerStatus: CircuitBreakerStatus;
  cooldownUntil: number;
  transitionReason?: string;
  lastTransitionAt: number;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
  consecutiveAmbiguous429: number;
  isLowUsageDailyExhaustion: boolean;
}

export interface InternalKeyStats {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  consecutiveErrors: number;
  tokensTotal: number;
  tokensToday: number;
  recentAttempts: CallAttemptEntry[];
  recentTokens: CallTokenEntry[];
  byModel: Map<string, InternalModelStats>;
  lastResetDay: string;
  lastRequestTimestamp?: number;
  healthState: KeyHealthState;
  transitionReason?: string;
  lastTransitionAt: number;
  consecutiveSuccesses: number;
  consecutiveAmbiguous429?: number;
  circuitBreakerStatus: CircuitBreakerStatus;
  cooldownUntil: number;
}

export function getDayInLosAngeles(timestamp: number = Date.now()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

/**
 * Tính toán chính xác thời điểm 00:00:00.000 ngày kế tiếp theo múi giờ America/Los_Angeles (PST/PDT)
 */
export function getNextPstMidnight(now: number = Date.now()): number {
  const currentDay = getDayInLosAngeles(now);
  const [year, month, day] = currentDay.split('-').map(Number);

  // Chọn mốc 12:00 UTC của ngày kế tiếp làm điểm neo (luôn rơi vào buổi sáng ngày kế tiếp tại Los Angeles)
  const nextDateUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0, 0));

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(nextDateUtc);
    let hour = 0;
    let minute = 0;
    let second = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = Number(part.value);
      if (part.type === 'minute') minute = Number(part.value);
      if (part.type === 'second') second = Number(part.value);
    }

    const elapsedSinceMidnightMs = (hour * 3600 + minute * 60 + second) * 1000;
    return nextDateUtc.getTime() - elapsedSinceMidnightMs;
  } catch {
    // Dự phòng khi môi trường không hỗ trợ timezone America/Los_Angeles (mặc định PST UTC-8)
    return Date.UTC(year, month - 1, day + 1, 8, 0, 0, 0);
  }
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }
  if (trimmed.length <= 10) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export {
  keyHashCache,
  legacyHashApiKey,
  sha256Sync,
  hashApiKey,
  hashApiKeyAsync,
} from '../utils/apiKeyHash';
import {
  hashApiKey,
  legacyHashApiKey,
} from '../utils/apiKeyHash';
import { migrateCustomLimits } from '../utils/customLimitsStorage';

const STORAGE_KEY = 'gemini_local_quota_tracker_v1';

export class LocalQuotaTracker {
  private keyStatsMap = new Map<string, InternalKeyStats>();
  private summaryStats: LogicalSummaryStats = {
    logicalRequestsTotal: 0,
    logicalRequestsToday: 0,
    successfulRequestsTotal: 0,
    successfulRequestsToday: 0,
    failedRequestsTotal: 0,
    failedRequestsToday: 0,
    retriesTotal: 0,
    retriesToday: 0,
    providerAttemptsTotal: 0,
    providerAttemptsToday: 0,
    successfulAttemptsTotal: 0,
    successfulAttemptsToday: 0,
    failedAttemptsTotal: 0,
    failedAttemptsToday: 0,
    lastResetDay: getDayInLosAngeles(),
  };
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDirty = false;

  constructor() {
    this.loadFromStorage();
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('pagehide', () => {
        this.flushToStorage();
      });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            this.flushToStorage();
          }
        });
      }
    } catch {
      // Ignore listener attachment in non-standard environments
    }
  }

  public scheduleSave(now: number = Date.now()): void {
    this.isDirty = true;
    if (this.saveTimeout !== null) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.flushToStorage(now);
    }, 300);
  }

  public flushToStorage(now: number = Date.now()): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (!this.isDirty) return;
    this.saveToStorage(now);
    this.isDirty = false;
  }

  public loadFromStorage(now: number = Date.now()): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.summaryStats) {
        this.summaryStats = { ...this.summaryStats, ...data.summaryStats };
      }
      if (Array.isArray(data.keyStats)) {
        const currentDay = getDayInLosAngeles(now);
        const minuteThreshold = now - 60_000;
        const maxFutureTimestamp = now + 5_000;

        for (const item of data.keyStats) {
          const isDayChanged = Boolean(item.lastResetDay && item.lastResetDay !== currentDay);
          const requestsToday = isDayChanged ? 0 : (item.requestsToday || 0);
          const errorsToday = isDayChanged ? 0 : (item.errorsToday || 0);
          const tokensToday = isDayChanged ? 0 : (item.tokensToday || 0);

          const byModelMap = new Map<string, InternalModelStats>();
          if (item.byModel && typeof item.byModel === 'object') {
            for (const [mName, mStats] of Object.entries<any>(item.byModel)) {
              const normModel = normalizeModelId(mName) || mName;
              const isModelDayChanged =
                isDayChanged || Boolean(mStats?.lastResetDay && mStats.lastResetDay !== currentDay);
              const mRecentAttempts: CallAttemptEntry[] = sanitizeRecentAttempts(
                mStats?.recentAttempts,
                minuteThreshold,
                maxFutureTimestamp
              );
              const mRecentTokens: CallTokenEntry[] = sanitizeRecentTokens(
                mStats?.recentTokens,
                minuteThreshold,
                maxFutureTimestamp
              );

              let mHealthState: KeyHealthState = 'Healthy';
              let mCircuitStatus: CircuitBreakerStatus = 'Closed';
              let mCooldownUntil = 0;
              let mTransitionReason: string | undefined = mStats?.transitionReason;
              let mIsLowUsageDailyExhaustion = Boolean(mStats?.isLowUsageDailyExhaustion);

              if (item.healthState === 'AuthFailed') {
                mHealthState = 'Healthy';
                mCircuitStatus = 'Closed';
                mCooldownUntil = 0;
              } else if (isModelDayChanged) {
                mHealthState = 'Healthy';
                mCircuitStatus = 'Closed';
                mCooldownUntil = 0;
                mTransitionReason = 'Hồi phục sau khi chuyển sang ngày mới (PST Reset)';
                mIsLowUsageDailyExhaustion = false;
              } else if (mStats?.healthState === 'QuotaExhausted') {
                mHealthState = 'QuotaExhausted';
                mCircuitStatus = mStats.circuitBreakerStatus || 'Open';
                mCooldownUntil =
                  mStats.cooldownUntil && mStats.cooldownUntil > now
                    ? mStats.cooldownUntil
                    : getNextPstMidnight(now);
              } else if (mStats?.healthState === 'RateLimited' || mStats?.healthState === 'Cooldown') {
                if (mStats.cooldownUntil && mStats.cooldownUntil > now) {
                  mHealthState = mStats.healthState;
                  mCircuitStatus = mStats.circuitBreakerStatus || 'Open';
                  mCooldownUntil = mStats.cooldownUntil;
                } else {
                  mHealthState = 'Healthy';
                  mCircuitStatus = 'Closed';
                  mCooldownUntil = 0;
                }
              } else if (mStats?.healthState === 'Degraded') {
                mHealthState = 'Degraded';
                mCircuitStatus = mStats.circuitBreakerStatus || 'HalfOpen';
                mCooldownUntil = mStats.cooldownUntil && mStats.cooldownUntil > now ? mStats.cooldownUntil : 0;
              }

              const existing = byModelMap.get(normModel);
              const normalizedEntry: InternalModelStats = {
                requestsTotal: mStats?.requestsTotal || 0,
                requestsToday: isModelDayChanged ? 0 : (mStats?.requestsToday || 0),
                errorsTotal: mStats?.errorsTotal || 0,
                errorsToday: isModelDayChanged ? 0 : (mStats?.errorsToday || 0),
                tokensTotal: mStats?.tokensTotal || 0,
                tokensToday: isModelDayChanged ? 0 : (mStats?.tokensToday || 0),
                totalLatencyMs: mStats?.totalLatencyMs || 0,
                lastResetDay: isModelDayChanged ? currentDay : (mStats?.lastResetDay || currentDay),
                recentAttempts: mRecentAttempts,
                recentTokens: mRecentTokens,
                healthState: mHealthState,
                circuitBreakerStatus: mCircuitStatus,
                cooldownUntil: mCooldownUntil,
                transitionReason: mTransitionReason,
                lastTransitionAt: mStats?.lastTransitionAt || now,
                consecutiveErrors: isModelDayChanged ? 0 : (mStats?.consecutiveErrors || 0),
                consecutiveSuccesses: mStats?.consecutiveSuccesses || 0,
                consecutiveAmbiguous429: isModelDayChanged ? 0 : (mStats?.consecutiveAmbiguous429 || 0),
                isLowUsageDailyExhaustion: mIsLowUsageDailyExhaustion,
              };

              if (!existing) {
                byModelMap.set(normModel, normalizedEntry);
              } else {
                const useNewHealth = normalizedEntry.lastTransitionAt >= existing.lastTransitionAt;
                byModelMap.set(normModel, {
                  ...existing,
                  requestsTotal: existing.requestsTotal + normalizedEntry.requestsTotal,
                  requestsToday: existing.requestsToday + normalizedEntry.requestsToday,
                  errorsTotal: existing.errorsTotal + normalizedEntry.errorsTotal,
                  errorsToday: existing.errorsToday + normalizedEntry.errorsToday,
                  tokensTotal: existing.tokensTotal + normalizedEntry.tokensTotal,
                  tokensToday: existing.tokensToday + normalizedEntry.tokensToday,
                  totalLatencyMs: existing.totalLatencyMs + normalizedEntry.totalLatencyMs,
                  recentAttempts: [...existing.recentAttempts, ...normalizedEntry.recentAttempts].slice(-100),
                  recentTokens: [...existing.recentTokens, ...normalizedEntry.recentTokens].slice(-100),
                  healthState: useNewHealth ? normalizedEntry.healthState : existing.healthState,
                  circuitBreakerStatus: useNewHealth ? normalizedEntry.circuitBreakerStatus : existing.circuitBreakerStatus,
                  cooldownUntil: Math.max(existing.cooldownUntil, normalizedEntry.cooldownUntil),
                  transitionReason: useNewHealth ? normalizedEntry.transitionReason : existing.transitionReason,
                  lastTransitionAt: Math.max(existing.lastTransitionAt, normalizedEntry.lastTransitionAt),
                  consecutiveErrors: Math.max(existing.consecutiveErrors, normalizedEntry.consecutiveErrors),
                  consecutiveSuccesses: useNewHealth ? normalizedEntry.consecutiveSuccesses : existing.consecutiveSuccesses,
                  consecutiveAmbiguous429: Math.max(existing.consecutiveAmbiguous429, normalizedEntry.consecutiveAmbiguous429),
                  isLowUsageDailyExhaustion: existing.isLowUsageDailyExhaustion || normalizedEntry.isLowUsageDailyExhaustion,
                });
              }
            }
          }

          let healthState: KeyHealthState = 'Healthy';
          let circuitBreakerStatus: CircuitBreakerStatus = 'Closed';
          let cooldownUntil = 0;

          if (item.healthState === 'AuthFailed') {
            healthState = 'AuthFailed';
            circuitBreakerStatus = 'Open';
          } else if (isDayChanged) {
            // Ngày mới PST: giải phóng QuotaExhausted về Healthy
            healthState = 'Healthy';
            circuitBreakerStatus = 'Closed';
            cooldownUntil = 0;
          } else {
            // Cùng ngày PST: bảo toàn trạng thái nghỉ nếu cooldown chưa hết
            if (item.healthState === 'QuotaExhausted') {
              healthState = 'QuotaExhausted';
              circuitBreakerStatus = item.circuitBreakerStatus || 'Open';
              cooldownUntil = item.cooldownUntil && item.cooldownUntil > now ? item.cooldownUntil : getNextPstMidnight(now);
            } else if (item.healthState === 'RateLimited' || item.healthState === 'Cooldown') {
              if (item.cooldownUntil && item.cooldownUntil > now) {
                healthState = item.healthState;
                circuitBreakerStatus = item.circuitBreakerStatus || 'Open';
                cooldownUntil = item.cooldownUntil;
              } else {
                healthState = 'Healthy';
                circuitBreakerStatus = 'Closed';
                cooldownUntil = 0;
              }
            } else if (item.healthState === 'Degraded') {
              healthState = 'Degraded';
              circuitBreakerStatus = item.circuitBreakerStatus || 'HalfOpen';
              cooldownUntil = item.cooldownUntil && item.cooldownUntil > now ? item.cooldownUntil : 0;
            } else {
              healthState = 'Healthy';
              circuitBreakerStatus = 'Closed';
              cooldownUntil = 0;
            }
          }

          let keyHash = item.keyHash;
          if (keyHash && !/^[0-9a-f]{64}$/.test(keyHash)) {
            keyHash = hashApiKey(keyHash);
          }

          const kRecentAttempts: CallAttemptEntry[] = sanitizeRecentAttempts(
            item.recentAttempts,
            minuteThreshold,
            maxFutureTimestamp
          );
          const kRecentTokens: CallTokenEntry[] = sanitizeRecentTokens(
            item.recentTokens,
            minuteThreshold,
            maxFutureTimestamp
          );

          this.keyStatsMap.set(keyHash, {
            ...item,
            keyHash,
            requestsToday,
            errorsToday,
            tokensToday,
            lastResetDay: isDayChanged ? currentDay : (item.lastResetDay || currentDay),
            recentAttempts: kRecentAttempts,
            recentTokens: kRecentTokens,
            byModel: byModelMap,
            healthState,
            circuitBreakerStatus,
            cooldownUntil,
            consecutiveErrors: isDayChanged ? 0 : (item.consecutiveErrors || 0),
            consecutiveSuccesses: item.consecutiveSuccesses || 0,
            consecutiveAmbiguous429: isDayChanged ? 0 : (item.consecutiveAmbiguous429 || 0),
            lastTransitionAt: item.lastTransitionAt || now,
          });
        }
      }
    } catch {
      // Ignore corrupted cache
    }
  }

  private saveToStorage(now: number = Date.now()): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const minuteThreshold = now - 60_000;
      const maxFutureTimestamp = now + 5_000;
      const serializableKeys = Array.from(this.keyStatsMap.values()).map((k) => {
        const byModelObj: Record<string, any> = {};
        for (const [mName, mStats] of k.byModel.entries()) {
          const mRecentAttempts = sanitizeRecentAttempts(mStats.recentAttempts, minuteThreshold, maxFutureTimestamp);
          const mRecentTokens = sanitizeRecentTokens(mStats.recentTokens, minuteThreshold, maxFutureTimestamp);

          byModelObj[mName] = {
            requestsTotal: mStats.requestsTotal,
            requestsToday: mStats.requestsToday,
            errorsTotal: mStats.errorsTotal,
            errorsToday: mStats.errorsToday,
            tokensTotal: mStats.tokensTotal,
            tokensToday: mStats.tokensToday,
            totalLatencyMs: mStats.totalLatencyMs,
            lastResetDay: mStats.lastResetDay,
            recentAttempts: mRecentAttempts,
            recentTokens: mRecentTokens,
            healthState: mStats.healthState,
            circuitBreakerStatus: mStats.circuitBreakerStatus,
            cooldownUntil: mStats.cooldownUntil,
            transitionReason: mStats.transitionReason,
            lastTransitionAt: mStats.lastTransitionAt,
            consecutiveErrors: mStats.consecutiveErrors,
            consecutiveSuccesses: mStats.consecutiveSuccesses,
            consecutiveAmbiguous429: mStats.consecutiveAmbiguous429,
            isLowUsageDailyExhaustion: mStats.isLowUsageDailyExhaustion,
          };
        }

        const kRecentAttempts = sanitizeRecentAttempts(k.recentAttempts, minuteThreshold, maxFutureTimestamp);
        const kRecentTokens = sanitizeRecentTokens(k.recentTokens, minuteThreshold, maxFutureTimestamp);

        return {
          keyHash: k.keyHash,
          maskedKey: k.maskedKey,
          requestsTotal: k.requestsTotal,
          requestsToday: k.requestsToday,
          errorsTotal: k.errorsTotal,
          consecutiveErrors: k.consecutiveErrors,
          consecutiveSuccesses: k.consecutiveSuccesses,
          consecutiveAmbiguous429: k.consecutiveAmbiguous429 || 0,
          tokensTotal: k.tokensTotal,
          tokensToday: k.tokensToday,
          lastResetDay: k.lastResetDay,
          healthState: k.healthState,
          circuitBreakerStatus: k.circuitBreakerStatus,
          cooldownUntil: k.cooldownUntil,
          transitionReason: k.transitionReason,
          lastTransitionAt: k.lastTransitionAt,
          recentAttempts: kRecentAttempts,
          recentTokens: kRecentTokens,
          byModel: byModelObj,
        };
      });

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          summaryStats: this.summaryStats,
          keyStats: serializableKeys,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }

  private getOrCreateKeyStats(key: string, now: number = Date.now()): InternalKeyStats {
    const keyHash = hashApiKey(key);
    const currentDay = getDayInLosAngeles(now);

    let stats = this.keyStatsMap.get(keyHash);
    if (!stats) {
      const legacyHash = legacyHashApiKey(key);
      if (legacyHash && legacyHash !== keyHash && this.keyStatsMap.has(legacyHash)) {
        stats = this.keyStatsMap.get(legacyHash)!;
        stats.keyHash = keyHash;
        stats.maskedKey = maskApiKey(key);
        this.keyStatsMap.set(keyHash, stats);
        this.keyStatsMap.delete(legacyHash);
      }
    }
    if (!stats) {
      stats = {
        keyHash,
        maskedKey: maskApiKey(key),
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        consecutiveErrors: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentAttempts: [],
        recentTokens: [],
        byModel: new Map(),
        lastResetDay: currentDay,
        healthState: 'Healthy',
        transitionReason: 'Khởi tạo trạng thái ban đầu',
        lastTransitionAt: now,
        consecutiveSuccesses: 0,
        consecutiveAmbiguous429: 0,
        circuitBreakerStatus: 'Closed',
        cooldownUntil: 0,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    // Reset daily counters if day changed in PST
    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.consecutiveErrors = 0;
      stats.consecutiveAmbiguous429 = 0;
      stats.lastResetDay = currentDay;
      if (stats.healthState === 'QuotaExhausted' || stats.healthState === 'RateLimited' || stats.healthState === 'Cooldown') {
        stats.healthState = 'Healthy';
        stats.circuitBreakerStatus = 'Closed';
        stats.cooldownUntil = 0;
        stats.transitionReason = 'Hồi phục sau khi chuyển sang ngày mới (PST Reset)';
      }
    }

    return stats;
  }

  private getOrCreateModelStats(keyStats: InternalKeyStats, model: string, now: number): InternalModelStats {
    const currentDay = getDayInLosAngeles(now);
    const normModel = normalizeModelId(model) || model;
    let mStats = keyStats.byModel.get(normModel);
    if (!mStats) {
      mStats = {
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        errorsToday: 0,
        tokensTotal: 0,
        tokensToday: 0,
        totalLatencyMs: 0,
        recentAttempts: [],
        recentTokens: [],
        lastResetDay: currentDay,
        healthState: 'Healthy',
        circuitBreakerStatus: 'Closed',
        cooldownUntil: 0,
        lastTransitionAt: now,
        consecutiveErrors: 0,
        consecutiveSuccesses: 0,
        consecutiveAmbiguous429: 0,
        isLowUsageDailyExhaustion: false,
      };
      keyStats.byModel.set(normModel, mStats);
    }

    if (mStats.lastResetDay !== currentDay) {
      mStats.requestsToday = 0;
      mStats.errorsToday = 0;
      mStats.tokensToday = 0;
      mStats.consecutiveErrors = 0;
      mStats.consecutiveAmbiguous429 = 0;
      mStats.isLowUsageDailyExhaustion = false;
      mStats.lastResetDay = currentDay;
      if (
        mStats.healthState === 'QuotaExhausted' ||
        mStats.healthState === 'RateLimited' ||
        mStats.healthState === 'Cooldown' ||
        mStats.healthState === 'Degraded'
      ) {
        mStats.healthState = 'Healthy';
        mStats.circuitBreakerStatus = 'Closed';
        mStats.cooldownUntil = 0;
        mStats.consecutiveSuccesses = 0;
        mStats.transitionReason = 'Hồi phục sau khi chuyển sang ngày mới (PST Reset)';
        mStats.lastTransitionAt = now;
      }
    }

    return mStats;
  }

  private checkPstReset(now: number = Date.now()): void {
    const currentDay = getDayInLosAngeles(now);
    if (this.summaryStats.lastResetDay !== currentDay) {
      this.summaryStats.logicalRequestsToday = 0;
      this.summaryStats.successfulRequestsToday = 0;
      this.summaryStats.failedRequestsToday = 0;
      this.summaryStats.retriesToday = 0;
      this.summaryStats.providerAttemptsToday = 0;
      this.summaryStats.successfulAttemptsToday = 0;
      this.summaryStats.failedAttemptsToday = 0;
      this.summaryStats.lastResetDay = currentDay;
    }
  }

  /**
   * Ghi nhận bắt đầu một yêu cầu dịch cấp người dùng (logical translation request)
   */
  public recordLogicalStart(now: number = Date.now()): void {
    this.checkPstReset(now);
    this.summaryStats.logicalRequestsTotal++;
    this.summaryStats.logicalRequestsToday++;
    this.scheduleSave(now);
  }

  /**
   * Bí danh cho recordLogicalStart tuân thủ hợp đồng IQuotaLifecycleTracker
   */
  public recordLogicalRequest(now: number = Date.now()): void {
    this.recordLogicalStart(now);
  }

  /**
   * Ghi nhận thất bại của một yêu cầu logic (Logical Request)
   * Được gọi khi tất cả các lượt thử thất bại hoặc gặp lỗi nghiêm trọng
   */
  public recordLogicalFailure(now: number = Date.now()): void {
    this.checkPstReset(now);
    this.summaryStats.failedRequestsTotal++;
    this.summaryStats.failedRequestsToday++;
    this.scheduleSave(now);
  }

  /**
   * Ghi nhận một hành vi thử lại (retry) hoặc xoay vòng sang khóa mới (key rotation)
   */
  public recordRetry(_key?: string, now: number = Date.now()): void {
    this.checkPstReset(now);
    this.summaryStats.retriesTotal++;
    this.summaryStats.retriesToday++;
    this.scheduleSave(now);
  }

  /**
   * Ghi nhận một lần gọi tới API Google (provider attempt)
   */
  public recordProviderAttempt(key: string, model: string, now: number = Date.now()): void {
    this.checkPstReset(now);
    this.summaryStats.providerAttemptsTotal++;
    this.summaryStats.providerAttemptsToday++;

    const keyStats = this.getOrCreateKeyStats(key, now);
    keyStats.requestsTotal++;
    keyStats.requestsToday++;
    keyStats.lastRequestTimestamp = now;
    keyStats.recentAttempts.push({ timestamp: now });

    const mStats = this.getOrCreateModelStats(keyStats, model, now);
    mStats.requestsTotal++;
    mStats.requestsToday++;
    mStats.recentAttempts.push({ timestamp: now });

    this.scheduleSave(now);
  }

  /**
   * Ghi nhận thành công cho API call
   */
  public recordSuccess(
    key: string,
    model: string,
    tokens: { promptTokens?: number; outputTokens?: number; totalTokens?: number },
    latencyMs: number = 0,
    now: number = Date.now()
  ): void {
    this.checkPstReset(now);
    this.summaryStats.successfulAttemptsTotal++;
    this.summaryStats.successfulAttemptsToday++;
    this.summaryStats.successfulRequestsTotal++;
    this.summaryStats.successfulRequestsToday++;

    const totalTokens = tokens.totalTokens || (tokens.promptTokens || 0) + (tokens.outputTokens || 0);

    const keyStats = this.getOrCreateKeyStats(key, now);
    keyStats.tokensTotal += totalTokens;
    keyStats.tokensToday += totalTokens;
    keyStats.consecutiveErrors = 0;
    keyStats.consecutiveAmbiguous429 = 0;
    keyStats.consecutiveSuccesses++;
    keyStats.recentTokens.push({ timestamp: now, tokens: totalTokens });

    // Cập nhật trạng thái Circuit Breaker cấp khóa (tương thích ngược)
    if (keyStats.circuitBreakerStatus === 'HalfOpen' && keyStats.consecutiveSuccesses >= 2) {
      keyStats.circuitBreakerStatus = 'Closed';
      keyStats.healthState = 'Healthy';
      keyStats.transitionReason = 'Phục hồi thành công sau chu kỳ cooldown';
      keyStats.cooldownUntil = 0;
    } else if (keyStats.healthState === 'Degraded') {
      keyStats.healthState = 'Healthy';
      keyStats.transitionReason = 'Đã kết nối ổn định trở lại';
    }

    const mStats = this.getOrCreateModelStats(keyStats, model, now);
    mStats.tokensTotal += totalTokens;
    mStats.tokensToday += totalTokens;
    mStats.totalLatencyMs += latencyMs;
    mStats.consecutiveErrors = 0;
    mStats.consecutiveAmbiguous429 = 0;
    mStats.consecutiveSuccesses++;
    mStats.isLowUsageDailyExhaustion = false;
    mStats.recentTokens.push({ timestamp: now, tokens: totalTokens });

    if (mStats.circuitBreakerStatus === 'HalfOpen' && mStats.consecutiveSuccesses >= 2) {
      mStats.circuitBreakerStatus = 'Closed';
      mStats.healthState = 'Healthy';
      mStats.transitionReason = 'Phục hồi thành công sau chu kỳ cooldown';
      mStats.cooldownUntil = 0;
      mStats.lastTransitionAt = now;
    } else if (mStats.healthState === 'Degraded') {
      mStats.healthState = 'Healthy';
      mStats.transitionReason = 'Đã kết nối ổn định trở lại';
      mStats.lastTransitionAt = now;
    }

    this.scheduleSave(now);
  }

  /**
   * Ghi nhận thất bại cho API call & cập nhật máy trạng thái cô lập theo (Khóa, Mô hình)
   */
  public recordFailure(
    key: string,
    model: string,
    error: {
      status?: number;
      message?: string;
      details?: unknown[];
      rawResponse?: any;
      retryAfterMs?: number;
      retryAfterHeader?: string | null;
      isRateLimit?: boolean;
      isAuthError?: boolean;
      isOverload?: boolean;
    },
    now: number = Date.now()
  ): void {
    this.checkPstReset(now);
    this.summaryStats.failedAttemptsTotal++;
    this.summaryStats.failedAttemptsToday++;

    const keyStats = this.getOrCreateKeyStats(key, now);
    keyStats.errorsTotal++;
    keyStats.consecutiveErrors++;
    keyStats.consecutiveSuccesses = 0;
    keyStats.lastTransitionAt = now;

    const normModel = normalizeModelId(model) || model;
    const mStats = this.getOrCreateModelStats(keyStats, normModel, now);
    mStats.errorsTotal++;
    mStats.errorsToday++;
    mStats.consecutiveErrors++;
    mStats.consecutiveSuccesses = 0;
    mStats.lastTransitionAt = now;

    const msg = error.message || '';
    const classified = classifyGeminiError(
      error.status || 0,
      error.rawResponse || { error: { message: msg, details: error.details, status: error.isRateLimit ? 'RESOURCE_EXHAUSTED' : undefined } },
      undefined,
      error.retryAfterHeader
    );

    const dynamicCooldownMs =
      typeof error.retryAfterMs === 'number' && error.retryAfterMs > 0
        ? error.retryAfterMs
        : classified.recommendedCooldownMs > 0
          ? classified.recommendedCooldownMs
          : undefined;

    const applyModelState = (
      state: KeyHealthState,
      cb: CircuitBreakerStatus,
      cooldownUntil: number,
      reason: string,
      isLowUsageDailyExhaustion: boolean = false
    ) => {
      mStats.healthState = state;
      mStats.circuitBreakerStatus = cb;
      mStats.cooldownUntil = cooldownUntil;
      mStats.transitionReason = reason;
      mStats.isLowUsageDailyExhaustion = isLowUsageDailyExhaustion;
      keyStats.healthState = state;
      keyStats.circuitBreakerStatus = cb;
      keyStats.cooldownUntil = cooldownUntil;
      keyStats.transitionReason = reason;
    };

    if (error.isAuthError || classified.category === 'AUTH_FAILURE') {
      const reason = `401/403: API key không hợp lệ hoặc bị từ chối (${msg.slice(0, 80)})`;
      keyStats.healthState = 'AuthFailed';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = Number.MAX_SAFE_INTEGER;
      keyStats.transitionReason = reason;
      mStats.transitionReason = reason;
    } else if (classified.category === 'QUOTA_EXHAUSTED_RPD') {
      const customLimits = getStoredCustomLimits();
      const customMaxRpd = sanitizePositiveLimit(customLimits?.[keyStats.keyHash]?.maxRpd);
      const refLimit =
        (getFamilyReferenceLimits(normModel) ?? getDefaultReferenceLimitFallback()).maxRpd ||
        DEFAULT_AMBIGUOUS_429_DAILY_REF;
      const dailyReference = customMaxRpd ?? refLimit;
      const hasAccurateLongDelay =
        typeof dynamicCooldownMs === 'number' &&
        dynamicCooldownMs > 60_000 &&
        dynamicCooldownMs <= MAX_PROVIDER_DAILY_DELAY_MS;
      const nextCooldownUntil = hasAccurateLongDelay ? now + dynamicCooldownMs! : getNextPstMidnight(now);
      const isLowUsage = mStats.requestsToday < dailyReference * 0.25;
      const reason = isLowUsage
        ? `429: Máy chủ báo cạn hạn mức ngày (per day/RPD) dù lượt gọi trên trình duyệt còn thấp (${mStats.requestsToday}/${dailyReference}) — có thể khóa đã tiêu hao từ ứng dụng/thiết bị khác hoặc chung dự án Google Cloud.`
        : '429: Hạn mức ngày đã hết (RPD Quota Exhausted)';

      applyModelState('QuotaExhausted', 'Open', nextCooldownUntil, reason, isLowUsage);
    } else if (classified.reason === 'MessageFallback_AmbiguousQuota') {
      const nextAmbiguousCount = (mStats.consecutiveAmbiguous429 || 0) + 1;
      mStats.consecutiveAmbiguous429 = nextAmbiguousCount;
      keyStats.consecutiveAmbiguous429 = nextAmbiguousCount;

      const customLimits = getStoredCustomLimits();
      const customMaxRpd = sanitizePositiveLimit(customLimits?.[keyStats.keyHash]?.maxRpd);
      const refLimit =
        (getFamilyReferenceLimits(normModel) ?? getDefaultReferenceLimitFallback()).maxRpd ||
        DEFAULT_AMBIGUOUS_429_DAILY_REF;
      const dailyReference = customMaxRpd ?? refLimit;

      // FR-009: Tuyệt đối không nâng cấp 429 mơ hồ thành QuotaExhausted khi chưa chạm ngưỡng ngày
      if (mStats.requestsToday < dailyReference) {
        const waitMs =
          nextAmbiguousCount <= 1
            ? (dynamicCooldownMs ?? 50_000)
            : nextAmbiguousCount === 2
              ? Math.max(dynamicCooldownMs ?? 0, 60_000)
              : Math.min(
                  RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS,
                  Math.max(dynamicCooldownMs ?? 0, 120_000)
                );
        const reason = `429: Tạm nghỉ nghi ngờ giới hạn tốc độ RPM lần ${nextAmbiguousCount} (~${Math.ceil(waitMs / 1000)}s, chưa chạm hạn mức ${dailyReference} RPD)`;
        applyModelState('RateLimited', 'Open', now + waitMs, reason, false);
      } else {
        const reason = `429: Hạn mức ngày đã hết sau khi đạt ngưỡng tham chiếu (${mStats.requestsToday}/${dailyReference} RPD)`;
        applyModelState('QuotaExhausted', 'Open', getNextPstMidnight(now), reason, false);
      }
    } else if (error.isRateLimit || classified.category === 'RATE_LIMIT_RPM') {
      const waitMs = dynamicCooldownMs ?? 45 * 1000;
      applyModelState(
        'RateLimited',
        'Open',
        now + waitMs,
        `429: Tạm nghỉ giới hạn tốc độ RPM (~${Math.ceil(waitMs / 1000)}s)`,
        false
      );
    } else if (error.isOverload || classified.category === 'SERVICE_OVERLOAD') {
      const waitMs = dynamicCooldownMs ?? 15 * 1000;
      applyModelState('Cooldown', 'Open', now + waitMs, '503: Máy chủ Gemini đang quá tải tạm thời', false);
    } else {
      if (mStats.consecutiveErrors >= 3) {
        applyModelState(
          'Degraded',
          'Open',
          now + 10 * 1000,
          `Gặp lỗi liên tiếp (${mStats.consecutiveErrors} lần)`,
          false
        );
      } else {
        applyModelState('Degraded', 'Closed', 0, `Lỗi: ${msg.slice(0, 60)}`, false);
      }
    }

    this.scheduleSave(now);
  }

  private evaluateProactiveLimits(
    state: KeyHealthState,
    circuitBreaker: CircuitBreakerStatus,
    recentAttempts: CallAttemptEntry[],
    recentTokens: CallTokenEntry[],
    now: number,
    customLimit?: CustomLimit,
    options?: KeyHealthOptions
  ): KeyHealthResult | null {
    if (customLimit === undefined && !options?.enforceProactiveLimits) {
      return null;
    }

    const minuteThreshold = now - 60_000;
    const effectiveMaxRpm =
      sanitizePositiveLimit(customLimit?.maxRpm) ??
      (options?.enforceProactiveLimits ? DEFAULT_FALLBACK_MAX_RPM : undefined);
    const effectiveMaxTpm = sanitizePositiveLimit(customLimit?.maxTpm);

    if (effectiveMaxRpm !== undefined) {
      const activeAttempts = recentAttempts.filter((a) => a.timestamp > minuteThreshold);
      if (activeAttempts.length >= effectiveMaxRpm) {
        const oldestTs = Math.min(...activeAttempts.map((a) => a.timestamp));
        const waitMs = Math.min(MAX_PROACTIVE_WAIT_MS, Math.max(250, oldestTs + 60_000 - now + 200));
        return {
          state,
          circuitBreaker,
          cooldownRemainingMs: waitMs,
          transitionReason: `Điều tiết chủ động: đạt ngưỡng ${activeAttempts.length}/${effectiveMaxRpm} RPM trong 60s`,
          isAvailable: false,
          isCustomLimitReached: false,
          isProactivePacing: true,
        };
      }
    }

    if (effectiveMaxTpm !== undefined) {
      const activeTokens = recentTokens.filter((t) => t.timestamp > minuteThreshold);
      const tokensThisMinute = activeTokens.reduce((acc, t) => acc + t.tokens, 0);
      if (tokensThisMinute >= effectiveMaxTpm && activeTokens.length > 0) {
        const oldestTs = Math.min(...activeTokens.map((t) => t.timestamp));
        const waitMs = Math.min(MAX_PROACTIVE_WAIT_MS, Math.max(250, oldestTs + 60_000 - now + 200));
        return {
          state,
          circuitBreaker,
          cooldownRemainingMs: waitMs,
          transitionReason: `Điều tiết chủ động: đạt ngưỡng ${tokensThisMinute}/${effectiveMaxTpm} TPM trong 60s`,
          isAvailable: false,
          isCustomLimitReached: false,
          isProactivePacing: true,
        };
      }
    }

    return null;
  }

  /**
   * Kiểm tra tình trạng sức khỏe hiện tại của một API key (cô lập theo cặp (Key, Model) khi options.model được cung cấp).
   */
  public getKeyHealth(
    key: string,
    now: number = Date.now(),
    customLimit?: CustomLimit,
    options?: KeyHealthOptions
  ): KeyHealthResult {
    const stats = this.getOrCreateKeyStats(key, now);
    const configuredMaxRpd = sanitizePositiveLimit(customLimit?.maxRpd);

    // 1. AuthFailed (401/403) luôn khóa toàn cục trên mọi mô hình
    if (stats.healthState === 'AuthFailed') {
      return {
        state: 'AuthFailed',
        circuitBreaker: stats.circuitBreakerStatus,
        cooldownRemainingMs: 0,
        transitionReason: stats.transitionReason,
        isAvailable: false,
        isCustomLimitReached: false,
        isProactivePacing: false,
      };
    }

    const normModel = options?.model ? (normalizeModelId(options.model) || options.model) : undefined;
    const existingModelStats = normModel ? stats.byModel.get(normModel) : undefined;
    if (normModel && !existingModelStats) {
      return {
        state: 'Healthy',
        circuitBreaker: 'Closed',
        cooldownRemainingMs: 0,
        transitionReason: stats.transitionReason,
        isAvailable: true,
        isCustomLimitReached: false,
        isProactivePacing: false,
      };
    }

    const targetState: {
      requestsToday: number;
      healthState: KeyHealthState;
      circuitBreakerStatus: CircuitBreakerStatus;
      cooldownUntil: number;
      transitionReason?: string;
      recentAttempts: CallAttemptEntry[];
      recentTokens: CallTokenEntry[];
      isLowUsageDailyExhaustion?: boolean;
    } = normModel ? this.getOrCreateModelStats(stats, normModel, now) : stats;

    // 2. Kiểm tra nếu vi phạm giới hạn cá nhân tự đặt (Max RPD)
    if (configuredMaxRpd !== undefined && targetState.requestsToday >= configuredMaxRpd) {
      return {
        state: 'QuotaExhausted',
        circuitBreaker: targetState.circuitBreakerStatus,
        cooldownRemainingMs: 0,
        transitionReason: `Đã chạm ngưỡng giới hạn cá nhân trong ngày (${targetState.requestsToday}/${configuredMaxRpd} RPD)`,
        isAvailable: false,
        isCustomLimitReached: true,
        isProactivePacing: false,
      };
    }

    // 3. Kiểm tra QuotaExhausted do upstream 429
    if (targetState.healthState === 'QuotaExhausted') {
      if (targetState.cooldownUntil > 0 && targetState.cooldownUntil <= now) {
        targetState.healthState = 'Healthy';
        targetState.circuitBreakerStatus = 'Closed';
        targetState.cooldownUntil = 0;
        targetState.isLowUsageDailyExhaustion = false;
        targetState.transitionReason = 'Hồi phục sau khi hết thời gian chờ hạn mức ngày';
      } else {
        const remaining = targetState.cooldownUntil > now ? Math.max(0, targetState.cooldownUntil - now) : 0;
        return {
          state: 'QuotaExhausted',
          circuitBreaker: targetState.circuitBreakerStatus,
          cooldownRemainingMs: remaining,
          transitionReason: targetState.transitionReason,
          isAvailable: false,
          isCustomLimitReached: false,
          isProactivePacing: false,
          isLowUsageDailyExhaustion: Boolean(targetState.isLowUsageDailyExhaustion),
        };
      }
    }

    // 4. Kiểm tra hết hạn Cooldown / RateLimited
    if (targetState.cooldownUntil > 0) {
      if (targetState.cooldownUntil > now) {
        const remaining = targetState.cooldownUntil === Number.MAX_SAFE_INTEGER
          ? 0
          : Math.max(0, targetState.cooldownUntil - now);

        return {
          state: targetState.healthState,
          circuitBreaker: targetState.circuitBreakerStatus,
          cooldownRemainingMs: remaining,
          transitionReason: targetState.transitionReason,
          isAvailable: false,
          isCustomLimitReached: false,
          isProactivePacing: false,
        };
      } else {
        targetState.cooldownUntil = 0;
        if (targetState.circuitBreakerStatus === 'Open') {
          targetState.circuitBreakerStatus = 'HalfOpen';
          targetState.healthState = 'Degraded';
          targetState.transitionReason = 'Thử nghiệm phục hồi sau thời gian tạm dừng';
        }
      }
    }

    const isAvail = targetState.healthState === 'Healthy' || targetState.healthState === 'Degraded';

    // 5. Cổng điều tiết chủ động cửa sổ trượt 60s (Proactive RPM/TPM Gate)
    if (isAvail) {
      const proactive = this.evaluateProactiveLimits(
        targetState.healthState,
        targetState.circuitBreakerStatus,
        targetState.recentAttempts,
        targetState.recentTokens,
        now,
        customLimit,
        options
      );
      if (proactive) {
        return proactive;
      }
    }

    return {
      state: targetState.healthState,
      circuitBreaker: targetState.circuitBreakerStatus,
      cooldownRemainingMs: 0,
      transitionReason: targetState.transitionReason,
      isAvailable: isAvail,
      isCustomLimitReached: false,
      isProactivePacing: false,
    };
  }

  /**
   * Di trú các mục thống kê khóa lưu trữ dưới mã băm cũ sang mã băm SHA-256 mới
   */
  public migrateLegacyKeyStats(keys: string[]): { migratedCount: number } {
    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];
    let migratedCount = 0;
    for (const rawKey of cleanKeys) {
      const legacyHash = legacyHashApiKey(rawKey);
      const newHash = hashApiKey(rawKey);
      if (legacyHash && legacyHash !== newHash && this.keyStatsMap.has(legacyHash)) {
        const stats = this.keyStatsMap.get(legacyHash)!;
        if (!this.keyStatsMap.has(newHash)) {
          stats.keyHash = newHash;
          stats.maskedKey = maskApiKey(rawKey);
          this.keyStatsMap.set(newHash, stats);
        }
        this.keyStatsMap.delete(legacyHash);
        migratedCount++;
      }
    }
    if (migratedCount > 0) {
      this.saveToStorage();
    }
    return { migratedCount };
  }

  /**
   * Quét danh sách các keys, ưu tiên khóa khả dụng nguội nhất (ít RPM 60s gần nhất và lastRequestTimestamp cũ nhất),
   * dùng khoảng cách vòng tròn từ startIndex để phá hòa. Trả về -1 nếu toàn bộ keys đều không khả dụng.
   */
  public findNextAvailableKeyIndex(
    keys: string[],
    startIndex: number = 0,
    customLimits?: Record<string, CustomLimit>,
    now: number = Date.now(),
    options?: KeyHealthOptions
  ): number {
    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];

    if (cleanKeys.length === 0) return -1;

    migrateCustomLimits(cleanKeys);
    this.migrateLegacyKeyStats(cleanKeys);

    const effectiveLimits = customLimits || getStoredCustomLimits();
    const safeStart = startIndex >= 0 ? startIndex % cleanKeys.length : 0;
    const minuteThreshold = now - 60_000;
    const normModel = options?.model ? (normalizeModelId(options.model) || options.model) : undefined;

    let bestIdx = -1;
    let bestRpmCount = Number.MAX_SAFE_INTEGER;
    let bestLastTs = Number.MAX_SAFE_INTEGER;
    let bestOffset = Number.MAX_SAFE_INTEGER;

    for (let offset = 0; offset < cleanKeys.length; offset++) {
      const idx = (safeStart + offset) % cleanKeys.length;
      const key = cleanKeys[idx];
      const keyHash = hashApiKey(key);
      const limit = effectiveLimits ? effectiveLimits[keyHash] : undefined;
      const health = this.getKeyHealth(key, now, limit, options);

      if (!health.isAvailable) {
        continue;
      }

      const stats = this.keyStatsMap.get(keyHash);
      const recentSource = normModel
        ? stats?.byModel.get(normModel)?.recentAttempts
        : stats?.recentAttempts;
      const rpmCount = recentSource
        ? recentSource.filter((a) => a.timestamp > minuteThreshold).length
        : 0;
      const lastTs = stats?.lastRequestTimestamp ?? 0;

      if (
        bestIdx === -1 ||
        rpmCount < bestRpmCount ||
        (rpmCount === bestRpmCount && lastTs < bestLastTs) ||
        (rpmCount === bestRpmCount && lastTs === bestLastTs && offset < bestOffset)
      ) {
        bestIdx = idx;
        bestRpmCount = rpmCount;
        bestLastTs = lastTs;
        bestOffset = offset;
      }
    }

    return bestIdx;
  }

  /**
   * Phân tích khả năng hồi phục của toàn bộ pool API key khi tất cả key tạm thời không khả dụng.
   */
  public getPoolCooldownAnalysis(
    keys: string[],
    customLimits?: Record<string, CustomLimit>,
    now: number = Date.now(),
    options?: KeyHealthOptions
  ): PoolCooldownAnalysis {
    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];

    if (cleanKeys.length === 0) {
      return {
        availableKeyIndex: -1,
        minCooldownRemainingMs: 0,
        nextRecoveringKeyIndex: -1,
        hasRecoverableCooldown: false,
        allPermanentlyExhausted: true,
        isProactivePacingOnly: false,
      };
    }

    migrateCustomLimits(cleanKeys);
    this.migrateLegacyKeyStats(cleanKeys);
    const effectiveLimits = customLimits || getStoredCustomLimits();

    let minProactiveMs = Number.MAX_SAFE_INTEGER;
    let nextProactiveIndex = -1;
    let minErrorCooldownMs = Number.MAX_SAFE_INTEGER;
    let nextErrorIndex = -1;

    for (let idx = 0; idx < cleanKeys.length; idx++) {
      const key = cleanKeys[idx];
      const limit = effectiveLimits ? effectiveLimits[hashApiKey(key)] : undefined;
      const health = this.getKeyHealth(key, now, limit, options);

      if (health.isAvailable) {
        return {
          availableKeyIndex: idx,
          minCooldownRemainingMs: 0,
          nextRecoveringKeyIndex: idx,
          hasRecoverableCooldown: false,
          allPermanentlyExhausted: false,
          isProactivePacingOnly: false,
        };
      }

      if (health.isProactivePacing && health.cooldownRemainingMs > 0) {
        if (health.cooldownRemainingMs < minProactiveMs) {
          minProactiveMs = health.cooldownRemainingMs;
          nextProactiveIndex = idx;
        }
        continue;
      }

      if (
        !health.isCustomLimitReached &&
        (health.state === 'RateLimited' || health.state === 'Cooldown' || health.state === 'Degraded') &&
        health.cooldownRemainingMs > 0
      ) {
        if (health.cooldownRemainingMs < minErrorCooldownMs) {
          minErrorCooldownMs = health.cooldownRemainingMs;
          nextErrorIndex = idx;
        }
      }
    }

    if (nextProactiveIndex === -1 && nextErrorIndex === -1) {
      return {
        availableKeyIndex: -1,
        minCooldownRemainingMs: 0,
        nextRecoveringKeyIndex: -1,
        hasRecoverableCooldown: false,
        allPermanentlyExhausted: true,
        isProactivePacingOnly: false,
      };
    }

    const useProactive = nextProactiveIndex !== -1 && minProactiveMs <= minErrorCooldownMs;
    const minCooldownRemainingMs = useProactive ? minProactiveMs : minErrorCooldownMs;
    const nextRecoveringKeyIndex = useProactive ? nextProactiveIndex : nextErrorIndex;
    const isRecoverable =
      minCooldownRemainingMs <= RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS;

    return {
      availableKeyIndex: -1,
      minCooldownRemainingMs,
      nextRecoveringKeyIndex,
      hasRecoverableCooldown: isRecoverable,
      allPermanentlyExhausted: !isRecoverable,
      isProactivePacingOnly: useProactive,
    };
  }

  /**
   * Mở khóa thủ công trạng thái lỗi của một khóa API (theo mô hình chọn hoặc toàn bộ mô hình).
   * Luôn bảo toàn bộ đếm requestsToday để không tự ý phá vỡ giới hạn Max RPD người dùng cài đặt.
   */
  public unlockKey(
    key: string,
    model?: string,
    options?: { customLimit?: CustomLimit; now?: number; skipFlush?: boolean }
  ): UnlockKeyResult {
    const now = options?.now ?? Date.now();
    const stats = this.getOrCreateKeyStats(key, now);
    if (stats.healthState === 'AuthFailed') {
      return { unlocked: false };
    }

    const resetModelRecord = (mStats: InternalModelStats) => {
      mStats.healthState = 'Healthy';
      mStats.circuitBreakerStatus = 'Closed';
      mStats.cooldownUntil = 0;
      mStats.consecutiveErrors = 0;
      mStats.consecutiveSuccesses = 0;
      mStats.consecutiveAmbiguous429 = 0;
      mStats.isLowUsageDailyExhaustion = false;
      mStats.transitionReason = 'Đã mở khóa thủ công bởi người dùng';
      mStats.lastTransitionAt = now;
    };

    const normModel = model ? (normalizeModelId(model) || model) : undefined;
    let targetRequestsToday = stats.requestsToday;

    if (normModel) {
      const mStats = stats.byModel.get(normModel);
      if (mStats) {
        resetModelRecord(mStats);
        targetRequestsToday = mStats.requestsToday;
      } else {
        targetRequestsToday = 0;
      }
    } else {
      for (const mStats of stats.byModel.values()) {
        resetModelRecord(mStats);
      }
    }

    const anyOtherModelStillExhausted = Array.from(stats.byModel.values()).some(
      (m) => m.healthState === 'QuotaExhausted' && m.cooldownUntil > now
    );
    if (!normModel || !anyOtherModelStillExhausted) {
      stats.healthState = 'Healthy';
      stats.circuitBreakerStatus = 'Closed';
      stats.cooldownUntil = 0;
      stats.consecutiveErrors = 0;
      stats.consecutiveSuccesses = 0;
      stats.consecutiveAmbiguous429 = 0;
      stats.transitionReason = 'Đã mở khóa thủ công bởi người dùng';
      stats.lastTransitionAt = now;
    }

    this.isDirty = true;
    if (!options?.skipFlush) {
      this.flushToStorage(now);
    }

    const effectiveLimit = options?.customLimit ?? getStoredCustomLimits()?.[stats.keyHash];
    const configuredMaxRpd = sanitizePositiveLimit(effectiveLimit?.maxRpd);
    if (configuredMaxRpd !== undefined && targetRequestsToday >= configuredMaxRpd) {
      return {
        unlocked: true,
        blockedByCustomLimit: true,
        remainingCustomCooldownReason: `Khóa đã xóa cờ lỗi nhưng vẫn chạm ngưỡng giới hạn cá nhân (${targetRequestsToday}/${configuredMaxRpd} RPD). Hãy tăng Max RPD trong Ngưỡng cá nhân nếu muốn tiếp tục.`,
      };
    }

    return { unlocked: true };
  }

  /**
   * Mở khóa hàng loạt toàn bộ danh sách khóa đang chọn (bảo toàn bộ đếm Max RPD cá nhân).
   */
  public unlockAllKeys(
    keys: string[],
    model?: string,
    customLimits?: Record<string, CustomLimit>,
    now: number = Date.now()
  ): { unlockedCount: number; customBlockedCount: number } {
    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];
    const effectiveLimits = customLimits || getStoredCustomLimits();
    let unlockedCount = 0;
    let customBlockedCount = 0;

    for (const rawKey of cleanKeys) {
      const keyHash = hashApiKey(rawKey);
      const res = this.unlockKey(rawKey, model, {
        customLimit: effectiveLimits?.[keyHash],
        now,
        skipFlush: true,
      });
      if (res.unlocked) unlockedCount++;
      if (res.blockedByCustomLimit) customBlockedCount++;
    }

    if (unlockedCount > 0) {
      this.isDirty = true;
      this.flushToStorage(now);
    }

    return { unlockedCount, customBlockedCount };
  }

  /**
   * Xuất báo cáo Quota Snapshot đầy đủ cho danh sách các keys (ưu tiên trạng thái của selectedModel khi được truyền).
   */
  public getQuotaStatus(
    keys: string[],
    now: number = Date.now(),
    customLimits?: Record<string, CustomLimit>,
    selectedModel?: string
  ): QuotaStatusResponse {
    this.checkPstReset(now);
    const minuteThreshold = now - 60_000;
    const currentDay = getDayInLosAngeles(now);

    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];

    if (cleanKeys.length > 0) {
      migrateCustomLimits(cleanKeys);
      this.migrateLegacyKeyStats(cleanKeys);
    }

    const effectiveLimits = customLimits || getStoredCustomLimits();

    const snapshotKeys: KeyQuotaFullSnapshot[] = cleanKeys.map((key, idx) => {
      const stats = this.getOrCreateKeyStats(key, now);
      const limit = effectiveLimits ? effectiveLimits[stats.keyHash] : undefined;
      const health = this.getKeyHealth(
        key,
        now,
        limit,
        selectedModel ? { model: selectedModel } : undefined
      );

      // Lọc các cuộc gọi trong 60 giây gần nhất để tính RPM (attempts) & TPM (tokens)
      stats.recentAttempts = stats.recentAttempts.filter((c) => c.timestamp > minuteThreshold);
      stats.recentTokens = stats.recentTokens.filter((c) => c.timestamp > minuteThreshold);
      const requestsThisMinute = stats.recentAttempts.length;
      const tokensThisMinute = stats.recentTokens.reduce((acc, c) => acc + c.tokens, 0);

      const byModelSnapshot: Record<string, ModelUsageStats> = {};
      for (const [mName, mStats] of stats.byModel.entries()) {
        mStats.recentAttempts = mStats.recentAttempts.filter((c) => c.timestamp > minuteThreshold);
        mStats.recentTokens = mStats.recentTokens.filter((c) => c.timestamp > minuteThreshold);
        const mRpm = mStats.recentAttempts.length;
        const mTpm = mStats.recentTokens.reduce((acc, c) => acc + c.tokens, 0);
        const mHealth = this.getKeyHealth(key, now, limit, { model: mName });

        byModelSnapshot[mName] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mRpm,
          errorsTotal: mStats.errorsTotal,
          errorsToday: mStats.lastResetDay === currentDay ? mStats.errorsToday : 0,
          tokensTotal: mStats.tokensTotal,
          tokensToday: mStats.lastResetDay === currentDay ? mStats.tokensToday : 0,
          tokensThisMinute: mTpm,
          healthState: mHealth.state,
          circuitBreakerState: mHealth.circuitBreaker,
          cooldownRemainingMs: mHealth.cooldownRemainingMs,
          transitionReason: mHealth.transitionReason,
          isLowUsageDailyExhaustion: mHealth.isLowUsageDailyExhaustion,
        };
      }

      const runtime: KeyRuntimeStatus = {
        isBlacklisted: !health.isAvailable && !health.isProactivePacing,
        blacklistRemainingMs: health.isProactivePacing ? 0 : health.cooldownRemainingMs,
        isRateLimited: health.state === 'RateLimited',
        nextAllowedRemainingMs: health.state === 'RateLimited'
          ? health.cooldownRemainingMs
          : health.isProactivePacing
            ? health.cooldownRemainingMs
            : 0,
        healthState: health.state,
        transitionReason: health.transitionReason,
        isCustomLimitReached: health.isCustomLimitReached,
        isProactivePacing: health.isProactivePacing,
        isLowUsageDailyExhaustion: health.isLowUsageDailyExhaustion,
      };

      return {
        index: idx,
        keyHash: stats.keyHash,
        maskedKey: stats.maskedKey,
        providerAttemptsTotal: stats.requestsTotal,
        providerAttemptsToday: stats.requestsToday,
        providerAttemptsThisMinute: requestsThisMinute,
        requestsTotal: stats.requestsTotal,
        requestsToday: stats.requestsToday,
        requestsThisMinute,
        errorsTotal: stats.errorsTotal,
        tokensTotal: stats.tokensTotal,
        tokensToday: stats.tokensToday,
        tokensThisMinute,
        byModel: byModelSnapshot,
        runtime,
        healthState: health.state,
        transitionReason: health.transitionReason,
        isCustomLimitReached: health.isCustomLimitReached,
        circuitBreakerState: health.circuitBreaker,
        cooldownRemainingMs: health.cooldownRemainingMs,
        lastRequestTimestamp: stats.lastRequestTimestamp,
      };
    });

    return {
      timestamp: new Date(now).toISOString(),
      timezone: 'America/Los_Angeles',
      currentDayPST: currentDay,
      summary: { ...this.summaryStats },
      groups: [],
      keys: snapshotKeys,
    };
  }

  /**
   * Đặt lại toàn bộ số liệu thống kê (phục vụ test hoặc reset thủ công)
   */
  public resetMetrics(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.isDirty = false;
    this.keyStatsMap.clear();
    this.summaryStats = {
      logicalRequestsTotal: 0,
      logicalRequestsToday: 0,
      successfulRequestsTotal: 0,
      successfulRequestsToday: 0,
      failedRequestsTotal: 0,
      failedRequestsToday: 0,
      retriesTotal: 0,
      retriesToday: 0,
      providerAttemptsTotal: 0,
      providerAttemptsToday: 0,
      successfulAttemptsTotal: 0,
      successfulAttemptsToday: 0,
      failedAttemptsTotal: 0,
      failedAttemptsToday: 0,
      lastResetDay: getDayInLosAngeles(),
    };
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
}

export const localQuotaTracker = new LocalQuotaTracker();
