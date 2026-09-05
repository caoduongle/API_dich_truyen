/**
 * Client-Side Quota Tracker & Key Health Monitor (Zero Backend)
 * Theo dõi hạn mức RPM/TPM, hạn mức ngày RPD (chu kỳ PST), Circuit Breaker và xoay vòng API key an toàn trực tiếp trên trình duyệt.
 */

import {
  KeyQuotaFullSnapshot,
  LogicalSummaryStats,
  ModelUsageStats,
  QuotaStatusResponse,
  KeyHealthState,
  KeyRuntimeStatus,
} from '../utils/apiClient';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface CallLogEntry {
  timestamp: number;
  tokens: number;
}

export interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  recentCalls: CallLogEntry[];
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
  recentCalls: CallLogEntry[];
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

export function hashApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return trimmed;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHash('sha256').update(trimmed).digest('hex');
    } catch {}
  }
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
}

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

  private loadFromStorage(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.summaryStats) {
        this.summaryStats = { ...this.summaryStats, ...data.summaryStats };
      }
      if (Array.isArray(data.keyStats)) {
        for (const item of data.keyStats) {
          const byModelMap = new Map<string, InternalModelStats>();
          if (item.byModel && typeof item.byModel === 'object') {
            for (const [mName, mStats] of Object.entries<any>(item.byModel)) {
              byModelMap.set(mName, {
                ...mStats,
                recentCalls: [],
              });
            }
          }
          this.keyStatsMap.set(item.keyHash, {
            ...item,
            recentCalls: [],
            byModel: byModelMap,
            healthState: item.healthState === 'AuthFailed' ? 'AuthFailed' : 'Healthy',
            circuitBreakerStatus: 'Closed',
            cooldownUntil: 0,
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
          tokensTotal: k.tokensTotal,
          tokensToday: k.tokensToday,
          lastResetDay: k.lastResetDay,
          healthState: k.healthState,
          transitionReason: k.transitionReason,
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
      stats = {
        keyHash,
        maskedKey: maskApiKey(key),
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        consecutiveErrors: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
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
        recentCalls: [],
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

    const mStats = this.getOrCreateModelStats(keyStats, model, now);
    mStats.requestsTotal++;
    mStats.requestsToday++;

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
    keyStats.recentCalls.push({ timestamp: now, tokens: totalTokens });

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
    mStats.recentCalls.push({ timestamp: now, tokens: totalTokens });

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
      isRateLimit?: boolean;
      isAuthError?: boolean;
      isOverload?: boolean;
    },
    now: number = Date.now()
  ): void {
    this.checkPstReset(now);
    this.summaryStats.failedAttemptsTotal++;
    this.summaryStats.failedAttemptsToday++;
    this.summaryStats.retriesTotal++;
    this.summaryStats.retriesToday++;

    const keyStats = this.getOrCreateKeyStats(key, now);
    keyStats.errorsTotal++;
    keyStats.consecutiveErrors++;
    keyStats.consecutiveSuccesses = 0;

    const mStats = this.getOrCreateModelStats(keyStats, model, now);
    mStats.errorsTotal++;
    mStats.errorsToday++;

    const msg = error.message || '';
    if (error.isAuthError || error.status === 401 || error.status === 403) {
      keyStats.healthState = 'AuthFailed';
      keyStats.circuitBreakerStatus = 'Open';
      keyStats.cooldownUntil = Number.MAX_SAFE_INTEGER;
      keyStats.transitionReason = `401/403: API key không hợp lệ hoặc bị từ chối (${msg.slice(0, 80)})`;
    } else if (error.isRateLimit || error.status === 429) {
      if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('daily') || msg.toLowerCase().includes('exhausted')) {
        keyStats.healthState = 'QuotaExhausted';
        keyStats.circuitBreakerStatus = 'Open';
        // Tạm dừng đến 00:00 PST ngày hôm sau (khoảng vài giờ)
        keyStats.cooldownUntil = now + 4 * 3600 * 1000;
        keyStats.transitionReason = '429: Hạn mức ngày đã hết (RPD Quota Exhausted)';
      } else {
        keyStats.healthState = 'RateLimited';
        keyStats.circuitBreakerStatus = 'Open';
        keyStats.cooldownUntil = now + 45 * 1000; // 45 giây cooldown cho RPM/TPM
        keyStats.transitionReason = '429: Đã chạm giới hạn tốc độ (RPM/TPM Rate Limit)';
      }
    } else if (error.isOverload || error.status === 503 || error.status === 500) {
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
   * Kiểm tra tình trạng sức khỏe hiện tại của một API key
   */
  public getKeyHealth(key: string, now: number = Date.now()): {
    state: KeyHealthState;
    circuitBreaker: CircuitBreakerStatus;
    cooldownRemainingMs: number;
    transitionReason?: string;
    isAvailable: boolean;
  } {
    const stats = this.getOrCreateKeyStats(key, now);

    // Kiểm tra hết hạn Cooldown
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
    };
  }

  /**
   * Xuất báo cáo Quota Snapshot đầy đủ cho danh sách các keys
   */
  public getQuotaStatus(keys: string[], now: number = Date.now()): QuotaStatusResponse {
    this.checkPstReset(now);
    const minuteThreshold = now - 60_000;
    const currentDay = getDayInLosAngeles(now);

    const cleanKeys = Array.isArray(keys)
      ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
      : [];

    const snapshotKeys: KeyQuotaFullSnapshot[] = cleanKeys.map((key, idx) => {
      const stats = this.getOrCreateKeyStats(key, now);
      const health = this.getKeyHealth(key, now);

      // Lọc các cuộc gọi trong 60 giây gần nhất để tính RPM & TPM
      stats.recentCalls = stats.recentCalls.filter((c) => c.timestamp > minuteThreshold);
      const requestsThisMinute = stats.recentCalls.length;
      const tokensThisMinute = stats.recentCalls.reduce((acc, c) => acc + c.tokens, 0);

      const byModelSnapshot: Record<string, ModelUsageStats> = {};
      for (const [mName, mStats] of stats.byModel.entries()) {
        mStats.recentCalls = mStats.recentCalls.filter((c) => c.timestamp > minuteThreshold);
        const mRpm = mStats.recentCalls.length;
        const mTpm = mStats.recentCalls.reduce((acc, c) => acc + c.tokens, 0);

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
