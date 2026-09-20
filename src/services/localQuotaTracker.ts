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
} from '../types/quota';
import { getStoredCustomLimits } from '../utils/customLimitsStorage';
import { classifyGeminiError } from './gemini/geminiErrorClassifier';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
}

export interface CallAttemptEntry {
  timestamp: number;
}

export interface CallTokenEntry {
  timestamp: number;
  tokens: number;
}

export type CallLogEntry = CallTokenEntry;

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

class LocalQuotaTracker {
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

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(now: number = Date.now()): void {
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

        for (const item of data.keyStats) {
          const isDayChanged = Boolean(item.lastResetDay && item.lastResetDay !== currentDay);
          const requestsToday = isDayChanged ? 0 : (item.requestsToday || 0);
          const errorsToday = isDayChanged ? 0 : (item.errorsToday || 0);
          const tokensToday = isDayChanged ? 0 : (item.tokensToday || 0);

          const byModelMap = new Map<string, InternalModelStats>();
          if (item.byModel && typeof item.byModel === 'object') {
            for (const [mName, mStats] of Object.entries<any>(item.byModel)) {
              byModelMap.set(mName, {
                ...mStats,
                requestsToday: isDayChanged ? 0 : (mStats.requestsToday || 0),
                errorsToday: isDayChanged ? 0 : (mStats.errorsToday || 0),
                tokensToday: isDayChanged ? 0 : (mStats.tokensToday || 0),
                lastResetDay: isDayChanged ? currentDay : (mStats.lastResetDay || currentDay),
                recentAttempts: [],
                recentTokens: [],
              });
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

          this.keyStatsMap.set(keyHash, {
            ...item,
            keyHash,
            requestsToday,
            errorsToday,
            tokensToday,
            lastResetDay: isDayChanged ? currentDay : (item.lastResetDay || currentDay),
            recentAttempts: [],
            recentTokens: [],
            byModel: byModelMap,
            healthState,
            circuitBreakerStatus,
            cooldownUntil,
            consecutiveErrors: isDayChanged ? 0 : (item.consecutiveErrors || 0),
            consecutiveSuccesses: item.consecutiveSuccesses || 0,
            lastTransitionAt: item.lastTransitionAt || now,
          });
        }
      }
    } catch {
      // Ignore corrupted cache
    }
  }

  private saveToStorage(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const serializableKeys = Array.from(this.keyStatsMap.values()).map((k) => {
        const byModelObj: Record<string, any> = {};
        for (const [mName, mStats] of k.byModel.entries()) {
          byModelObj[mName] = {
            requestsTotal: mStats.requestsTotal,
            requestsToday: mStats.requestsToday,
            errorsTotal: mStats.errorsTotal,
            errorsToday: mStats.errorsToday,
            tokensTotal: mStats.tokensTotal,
            tokensToday: mStats.tokensToday,
            totalLatencyMs: mStats.totalLatencyMs,
            lastResetDay: mStats.lastResetDay,
          };
        }
        return {
          keyHash: k.keyHash,
          maskedKey: k.maskedKey,
          requestsTotal: k.requestsTotal,
          requestsToday: k.requestsToday,
          errorsTotal: k.errorsTotal,
          consecutiveErrors: k.consecutiveErrors,
          consecutiveSuccesses: k.consecutiveSuccesses,
          tokensTotal: k.tokensTotal,
          tokensToday: k.tokensToday,
          lastResetDay: k.lastResetDay,
          healthState: k.healthState,
          circuitBreakerStatus: k.circuitBreakerStatus,
          cooldownUntil: k.cooldownUntil,
          transitionReason: k.transitionReason,
          lastTransitionAt: k.lastTransitionAt,
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
        circuitBreakerStatus: 'Closed',
        cooldownUntil: 0,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    // Reset daily counters if day changed in PST
    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.lastResetDay = currentDay;
      if (stats.healthState === 'QuotaExhausted') {
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
    let mStats = keyStats.byModel.get(model);
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
      };
      keyStats.byModel.set(model, mStats);
    }

    if (mStats.lastResetDay !== currentDay) {
      mStats.requestsToday = 0;
      mStats.errorsToday = 0;
      mStats.tokensToday = 0;
      mStats.lastResetDay = currentDay;
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
    this.saveToStorage();
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
    this.saveToStorage();
  }

  /**
   * Ghi nhận một hành vi thử lại (retry) hoặc xoay vòng sang khóa mới (key rotation)
   */
  public recordRetry(_key?: string, now: number = Date.now()): void {
    this.checkPstReset(now);
    this.summaryStats.retriesTotal++;
    this.summaryStats.retriesToday++;
    this.saveToStorage();
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

    this.saveToStorage();
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
    keyStats.consecutiveSuccesses++;
    keyStats.recentTokens.push({ timestamp: now, tokens: totalTokens });

    // Cập nhật trạng thái Circuit Breaker
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
    mStats.recentTokens.push({ timestamp: now, tokens: totalTokens });

    this.saveToStorage();
  }

  /**
   * Ghi nhận thất bại cho API call & cập nhật Key Health State Machine
   */
  public recordFailure(
    key: string,
    model: string,
    error: {
      status?: number;
      message?: string;
      details?: unknown[];
      rawResponse?: any;
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

    const mStats = this.getOrCreateModelStats(keyStats, model, now);
    mStats.errorsTotal++;
    mStats.errorsToday++;

    const msg = error.message || '';
    const classified = classifyGeminiError(
      error.status || 0,
      error.rawResponse || { error: { message: msg, details: error.details, status: error.isRateLimit ? 'RESOURCE_EXHAUSTED' : undefined } }
    );

    if (error.isAuthError || classified.category === 'AUTH_FAILURE') {
      keyStats.healthState = 'AuthFailed';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = Number.MAX_SAFE_INTEGER;
      keyStats.transitionReason = `401/403: API key không hợp lệ hoặc bị từ chối (${msg.slice(0, 80)})`;
    } else if (classified.category === 'QUOTA_EXHAUSTED_RPD') {
      keyStats.healthState = 'QuotaExhausted';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = getNextPstMidnight(now);
      keyStats.transitionReason = '429: Hạn mức ngày đã hết (RPD Quota Exhausted)';
    } else if (error.isRateLimit || classified.category === 'RATE_LIMIT_RPM') {
      keyStats.healthState = 'RateLimited';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = now + 45 * 1000; // 45 giây cooldown cho RPM/TPM
      keyStats.transitionReason = '429: Đã chạm giới hạn tốc độ (RPM/TPM Rate Limit)';
    } else if (error.isOverload || classified.category === 'SERVICE_OVERLOAD') {
      keyStats.healthState = 'Cooldown';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = now + 15 * 1000; // 15 giây cooldown
      keyStats.transitionReason = '503: Máy chủ Gemini đang quá tải tạm thời';
    } else {
      if (keyStats.consecutiveErrors >= 3) {
        keyStats.healthState = 'Degraded';
        keyStats.circuitBreakerStatus = 'Open';
        keyStats.cooldownUntil = now + 10 * 1000;
        keyStats.transitionReason = `Gặp lỗi liên tiếp (${keyStats.consecutiveErrors} lần)`;
      } else {
        keyStats.healthState = 'Degraded';
        keyStats.transitionReason = `Lỗi: ${msg.slice(0, 60)}`;
      }
    }

    this.saveToStorage();
  }

  /**
   * Kiểm tra tình trạng sức khỏe hiện tại của một API key, kết hợp cả máy trạng thái và ngưỡng cá nhân (Max RPD)
   */
  public getKeyHealth(
    key: string,
    now: number = Date.now(),
    customLimit?: CustomLimit
  ): KeyHealthResult {
    const stats = this.getOrCreateKeyStats(key, now);

    // 1. Kiểm tra nếu vi phạm giới hạn cá nhân tự đặt (Max RPD)
    if (customLimit && typeof customLimit.maxRpd === 'number' && customLimit.maxRpd > 0) {
      if (stats.requestsToday >= customLimit.maxRpd) {
        return {
          state: 'QuotaExhausted',
          circuitBreaker: stats.circuitBreakerStatus,
          cooldownRemainingMs: 0,
          transitionReason: `Đã chạm ngưỡng giới hạn cá nhân trong ngày (${stats.requestsToday}/${customLimit.maxRpd} RPD)`,
          isAvailable: false,
          isCustomLimitReached: true,
        };
      }
    }

    // 2. Kiểm tra AuthFailed (401/403)
    if (stats.healthState === 'AuthFailed') {
      return {
        state: 'AuthFailed',
        circuitBreaker: stats.circuitBreakerStatus,
        cooldownRemainingMs: 0,
        transitionReason: stats.transitionReason,
        isAvailable: false,
        isCustomLimitReached: false,
      };
    }

    // 3. Kiểm tra QuotaExhausted do upstream 429
    if (stats.healthState === 'QuotaExhausted') {
      const remaining = stats.cooldownUntil > now ? Math.max(0, stats.cooldownUntil - now) : 0;
      return {
        state: 'QuotaExhausted',
        circuitBreaker: stats.circuitBreakerStatus,
        cooldownRemainingMs: remaining,
        transitionReason: stats.transitionReason,
        isAvailable: false,
        isCustomLimitReached: false,
      };
    }

    // 4. Kiểm tra hết hạn Cooldown / RateLimited
    if (stats.cooldownUntil > 0) {
      if (stats.cooldownUntil > now) {
        const remaining = stats.cooldownUntil === Number.MAX_SAFE_INTEGER
          ? 0
          : Math.max(0, stats.cooldownUntil - now);

        return {
          state: stats.healthState,
          circuitBreaker: stats.circuitBreakerStatus,
          cooldownRemainingMs: remaining,
          transitionReason: stats.transitionReason,
          isAvailable: false,
          isCustomLimitReached: false,
        };
      } else {
        // Cooldown đã kết thúc -> chuyển sang HalfOpen để thử nghiệm
        stats.cooldownUntil = 0;
        if (stats.circuitBreakerStatus === 'Open') {
          stats.circuitBreakerStatus = 'HalfOpen';
          stats.healthState = 'Degraded';
          stats.transitionReason = 'Thử nghiệm phục hồi sau thời gian tạm dừng';
        }
      }
    }

    const isAvail = stats.healthState === 'Healthy' || stats.healthState === 'Degraded';

    return {
      state: stats.healthState,
      circuitBreaker: stats.circuitBreakerStatus,
      cooldownRemainingMs: 0,
      transitionReason: stats.transitionReason,
      isAvailable: isAvail,
      isCustomLimitReached: false,
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
   * Quét danh sách các keys bắt đầu từ startIndex để tìm key đầu tiên khả dụng (chưa chạm quota/cooldown)
   * Trả về -1 nếu toàn bộ keys đều không khả dụng.
   */
  public findNextAvailableKeyIndex(
    keys: string[],
    startIndex: number = 0,
    customLimits?: Record<string, CustomLimit>,
    now: number = Date.now()
  ): number {
    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];

    if (cleanKeys.length === 0) return -1;

    migrateCustomLimits(cleanKeys);
    this.migrateLegacyKeyStats(cleanKeys);

    const effectiveLimits = customLimits || getStoredCustomLimits();
    const safeStart = startIndex >= 0 ? startIndex % cleanKeys.length : 0;

    for (let attempt = 0; attempt < cleanKeys.length; attempt++) {
      const idx = (safeStart + attempt) % cleanKeys.length;
      const key = cleanKeys[idx];
      const keyHash = hashApiKey(key);
      const limit = effectiveLimits ? effectiveLimits[keyHash] : undefined;
      const health = this.getKeyHealth(key, now, limit);

      if (health.isAvailable) {
        return idx;
      }
    }

    return -1;
  }

  /**
   * Xuất báo cáo Quota Snapshot đầy đủ cho danh sách các keys
   */
  public getQuotaStatus(
    keys: string[],
    now: number = Date.now(),
    customLimits?: Record<string, CustomLimit>
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
      const health = this.getKeyHealth(key, now, limit);

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

        byModelSnapshot[mName] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mRpm,
          errorsTotal: mStats.errorsTotal,
          errorsToday: mStats.lastResetDay === currentDay ? mStats.errorsToday : 0,
          tokensTotal: mStats.tokensTotal,
          tokensToday: mStats.lastResetDay === currentDay ? mStats.tokensToday : 0,
          tokensThisMinute: mTpm,
        };
      }

      const runtime: KeyRuntimeStatus = {
        isBlacklisted: !health.isAvailable,
        blacklistRemainingMs: health.cooldownRemainingMs,
        isRateLimited: health.state === 'RateLimited',
        nextAllowedRemainingMs: health.state === 'RateLimited' ? health.cooldownRemainingMs : 0,
        healthState: health.state,
        transitionReason: health.transitionReason,
        isCustomLimitReached: health.isCustomLimitReached,
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
