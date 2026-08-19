import crypto from 'crypto';
import { AIErrorCode, AIErrorNormalized } from '../constants/errors';

export type QuotaAttemptStatus = 'success' | 'overloaded' | 'quota_exceeded' | 'safety' | 'error';

export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface TokenStats {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallLogEntry {
  timestamp: number;
  tokens: number;
}

export interface ModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
}

interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  recentCalls: CallLogEntry[];
  lastResetDay: string;
}

interface InternalKeyStats {
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
  circuitBreakerStatus: CircuitBreakerStatus;
  cooldownUntil: number;
  disabledReason?: string;
}

export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  healthState: KeyHealthState;
  circuitBreakerState: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  consecutiveErrors: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  byModel: Record<string, ModelUsageStats>;
  lastRequestTimestamp?: number;
}

export function hashApiKey(key: string): string {
  if (!key) return '';
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function getDayInLosAngeles(timestamp: number = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}

const CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 phút

class QuotaService {
  private keyStatsMap = new Map<string, InternalKeyStats>();

  private getOrCreateStats(key: string, timestamp: number = Date.now()): InternalKeyStats {
    const trimmedKey = key.trim();
    const keyHash = hashApiKey(trimmedKey);
    const maskedKey = maskApiKey(trimmedKey);
    const currentDay = getDayInLosAngeles(timestamp);

    let stats = this.keyStatsMap.get(keyHash);
    if (!stats) {
      stats = {
        keyHash,
        maskedKey,
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        consecutiveErrors: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
        byModel: new Map<string, InternalModelStats>(),
        lastResetDay: currentDay,
        healthState: 'Healthy',
        circuitBreakerStatus: 'Closed',
        cooldownUntil: 0,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.lastResetDay = currentDay;
    }

    return stats;
  }

  /**
   * Đọc trạng thái Key Health hiện tại
   */
  public getKeyHealth(key: string, now: number = Date.now()): {
    state: KeyHealthState;
    consecutiveErrors: number;
    cooldownRemainingMs: number;
    circuitBreaker: CircuitBreakerStatus;
    isAvailable: boolean;
  } {
    if (!key || !key.trim()) {
      return {
        state: 'Disabled',
        consecutiveErrors: 0,
        cooldownRemainingMs: 0,
        circuitBreaker: 'Open',
        isAvailable: false,
      };
    }

    const stats = this.getOrCreateStats(key, now);

    // Kiểm tra cooldown expiration
    if (stats.cooldownUntil > 0) {
      if (now >= stats.cooldownUntil) {
        // Cooldown hết hạn -> chuyển sang Half-Open để thử nghiệm
        stats.cooldownUntil = 0;
        if (stats.circuitBreakerStatus === 'Open') {
          stats.circuitBreakerStatus = 'HalfOpen';
        }
        if (stats.healthState === 'Cooldown' || stats.healthState === 'RateLimited') {
          stats.healthState = 'Degraded';
        }
      }
    }

    const cooldownRemainingMs = Math.max(0, stats.cooldownUntil - now);
    const isAvailable =
      stats.healthState !== 'AuthFailed' &&
      stats.healthState !== 'Disabled' &&
      stats.circuitBreakerStatus !== 'Open' &&
      cooldownRemainingMs === 0;

    return {
      state: stats.healthState,
      consecutiveErrors: stats.consecutiveErrors,
      cooldownRemainingMs,
      circuitBreaker: stats.circuitBreakerStatus,
      isAvailable,
    };
  }

  /**
   * Ghi nhận 1 lượt sử dụng API key và model tương ứng với số token tiêu thụ
   */
  public recordUsage(
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats
  ): void {
    if (!key || !key.trim()) return;

    const stats = this.getOrCreateStats(key, timestamp);
    const currentDay = getDayInLosAngeles(timestamp);
    const normalizedModel = modelName ? (modelName.startsWith('models/') ? modelName : `models/${modelName}`) : 'unknown';
    const tokens = tokenStats?.totalTokens || 0;

    stats.requestsTotal++;
    stats.requestsToday++;
    stats.tokensTotal += tokens;
    stats.tokensToday += tokens;
    stats.lastRequestTimestamp = timestamp;
    stats.recentCalls.push({ timestamp, tokens });

    // Cập nhật State Machine dựa trên status
    if (status === 'success') {
      stats.consecutiveErrors = 0;
      stats.circuitBreakerStatus = 'Closed';
      stats.healthState = 'Healthy';
      stats.cooldownUntil = 0;
    } else {
      stats.errorsTotal++;
      stats.consecutiveErrors++;

      if (status === 'quota_exceeded') {
        stats.healthState = 'QuotaExhausted';
      } else if (status === 'overloaded') {
        stats.healthState = 'Cooldown';
      } else {
        if (stats.consecutiveErrors >= CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD) {
          stats.circuitBreakerStatus = 'Open';
          stats.healthState = 'Cooldown';
          stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
        } else {
          stats.healthState = 'Degraded';
        }
      }
    }

    // Sliding Window 60s
    const minuteThreshold = timestamp - 60000;
    stats.recentCalls = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);

    // Cập nhật thống kê theo từng model
    let modelStats = stats.byModel.get(normalizedModel);
    if (!modelStats) {
      modelStats = {
        requestsTotal: 0,
        requestsToday: 0,
        errorsTotal: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
        lastResetDay: currentDay,
      };
      stats.byModel.set(normalizedModel, modelStats);
    }

    if (modelStats.lastResetDay !== currentDay) {
      modelStats.requestsToday = 0;
      modelStats.tokensToday = 0;
      modelStats.lastResetDay = currentDay;
    }

    modelStats.requestsTotal++;
    modelStats.requestsToday++;
    modelStats.tokensTotal += tokens;
    modelStats.tokensToday += tokens;
    modelStats.recentCalls.push({ timestamp, tokens });
    modelStats.recentCalls = modelStats.recentCalls.filter(c => c.timestamp > minuteThreshold);

    if (status !== 'success') {
      modelStats.errorsTotal++;
    }
  }

  /**
   * Ghi nhận lỗi có phân loại rõ ràng (Error Taxonomy Integration)
   */
  public recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp: number = Date.now()
  ): void {
    if (!key || !key.trim()) return;
    const stats = this.getOrCreateStats(key, timestamp);

    stats.errorsTotal++;
    stats.consecutiveErrors++;

    switch (error.code) {
      case AIErrorCode.AUTH_FAILED:
        stats.healthState = 'AuthFailed';
        stats.circuitBreakerStatus = 'Open';
        stats.disabledReason = error.message;
        break;
      case AIErrorCode.QUOTA_EXCEEDED:
        stats.healthState = 'QuotaExhausted';
        stats.circuitBreakerStatus = 'Open';
        stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
        break;
      case AIErrorCode.RATE_LIMITED:
        stats.healthState = 'RateLimited';
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 5000);
        break;
      case AIErrorCode.SERVER_ERROR:
        stats.healthState = 'Cooldown';
        stats.cooldownUntil = timestamp + 3000;
        break;
      default:
        if (stats.consecutiveErrors >= CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD) {
          stats.circuitBreakerStatus = 'Open';
          stats.healthState = 'Cooldown';
          stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
        } else {
          stats.healthState = 'Degraded';
        }
        break;
    }

    this.recordUsage(key, modelName, 'error', timestamp);
  }

  /**
   * Chấm điểm độ ưu tiên của một API Key cho request dự kiến (Predictive Candidate Scoring)
   */
  public calculateKeyScore(
    key: string,
    _modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now()
  ): { score: number; isEligible: boolean; rejectReason?: string } {
    const health = this.getKeyHealth(key, now);
    if (!health.isAvailable) {
      return { score: -1000, isEligible: false, rejectReason: `Key đang ở trạng thái ${health.state} (Cooldown: ${health.cooldownRemainingMs}ms)` };
    }

    const stats = this.getOrCreateStats(key, now);
    const minuteThreshold = now - 60000;
    const recentCalls = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);
    const currentTokensThisMinute = recentCalls.reduce((sum, c) => sum + c.tokens, 0);

    // Kiểm tra Predictive TPM (Hạn mức định mức 1,000,000 TPM cho Gemini Flash)
    const MAX_SAFE_TPM = 1000000;
    if (currentTokensThisMinute + estimatedTokens > MAX_SAFE_TPM * 0.95) {
      return { score: -500, isEligible: false, rejectReason: `Dự toán token (${estimatedTokens}) sẽ vượt ngưỡng an toàn TPM (${currentTokensThisMinute}/${MAX_SAFE_TPM})` };
    }

    // Scoring: Điểm càng cao càng ưu tiên
    // 1. Quota còn lại trong 1 phút (max 1000 điểm)
    const tpmCapacityScore = Math.max(0, (MAX_SAFE_TPM - currentTokensThisMinute) / 1000);
    // 2. Thời gian rảnh rỗi kể từ lần dùng cuối (càng lâu càng tốt, tối đa 500 điểm)
    const idleSeconds = stats.lastRequestTimestamp ? Math.min(500, Math.floor((now - stats.lastRequestTimestamp) / 1000)) : 500;
    // 3. Phạt lỗi liên tiếp (-150 điểm mỗi lỗi)
    const errorPenalty = stats.consecutiveErrors * 150;

    const totalScore = tpmCapacityScore + idleSeconds - errorPenalty;
    return { score: totalScore, isEligible: true };
  }

  /**
   * Lấy snapshot thống kê sử dụng và token metrics cho danh sách keys
   */
  public getQuotaSnapshot(keys: string[], timestamp: number = Date.now()): KeyQuotaSnapshot[] {
    const currentDay = getDayInLosAngeles(timestamp);
    const minuteThreshold = timestamp - 60000;

    return keys.map((key) => {
      const trimmedKey = key.trim();
      const keyHash = hashApiKey(trimmedKey);
      const masked = maskApiKey(trimmedKey);
      const health = this.getKeyHealth(trimmedKey, timestamp);

      const stats = this.keyStatsMap.get(keyHash);
      if (!stats) {
        return {
          keyHash,
          maskedKey: masked,
          healthState: 'Healthy',
          circuitBreakerState: 'Closed',
          cooldownRemainingMs: 0,
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          errorsTotal: 0,
          consecutiveErrors: 0,
          tokensTotal: 0,
          tokensToday: 0,
          tokensThisMinute: 0,
          byModel: {},
        };
      }

      const recentCallsInWindow = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);
      const requestsThisMinute = recentCallsInWindow.length;
      const tokensThisMinute = recentCallsInWindow.reduce((sum, c) => sum + c.tokens, 0);

      const requestsToday = stats.lastResetDay === currentDay ? stats.requestsToday : 0;
      const tokensToday = stats.lastResetDay === currentDay ? stats.tokensToday : 0;

      const byModelSnapshot: Record<string, ModelUsageStats> = {};
      for (const [model, mStats] of stats.byModel.entries()) {
        const mRecentCalls = mStats.recentCalls.filter(c => c.timestamp > minuteThreshold);
        byModelSnapshot[model] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mRecentCalls.length,
          errorsTotal: mStats.errorsTotal,
          tokensTotal: mStats.tokensTotal,
          tokensToday: mStats.lastResetDay === currentDay ? mStats.tokensToday : 0,
          tokensThisMinute: mRecentCalls.reduce((sum, c) => sum + c.tokens, 0),
        };
      }

      return {
        keyHash,
        maskedKey: stats.maskedKey || masked,
        healthState: health.state,
        circuitBreakerState: health.circuitBreaker,
        cooldownRemainingMs: health.cooldownRemainingMs,
        requestsTotal: stats.requestsTotal,
        requestsToday,
        requestsThisMinute,
        errorsTotal: stats.errorsTotal,
        consecutiveErrors: stats.consecutiveErrors,
        tokensTotal: stats.tokensTotal,
        tokensToday,
        tokensThisMinute,
        byModel: byModelSnapshot,
        lastRequestTimestamp: stats.lastRequestTimestamp,
      };
    });
  }

  /**
   * Reset toàn bộ dữ liệu in-memory (dùng cho testing)
   */
  public resetAll(): void {
    this.keyStatsMap.clear();
  }
}

export const quotaService = new QuotaService();
