import { AIErrorCode, AIErrorNormalized } from '../../constants/errors';
import { KeyHealthState, CircuitBreakerStatus } from '../../../shared/models';
import { hashApiKey, maskApiKey, getDayInLosAngeles } from './quotaUtils';
import { computeQuotaSnapshot, computeAggregatedModelStats } from './quotaSnapshot';

export type QuotaAttemptStatus = 'success' | 'overloaded' | 'quota_exceeded' | 'safety' | 'error';

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
  errorsToday?: number;
  totalLatencyMs?: number;
  avgLatencyMs?: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
}

export interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
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
  disabledReason?: string;
  quotaEventsTotal: number;
  cooldownEventsTotal: number;
}

export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  healthState: KeyHealthState;
  transitionReason?: string;
  circuitBreakerState: CircuitBreakerStatus;
  cooldownRemainingMs: number;

  // Canonical Key Activity Layer
  keyAttempts: number;
  keyFailures: number;
  keyCooldowns: number;

  // Backward Compatibility Aliases (@deprecated)
  providerAttemptsTotal: number;
  providerAttemptsToday: number;
  providerAttemptsThisMinute: number;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  consecutiveErrors: number;
  quotaEventsTotal: number;
  cooldownEventsTotal: number;
  tokensTotal: number;
  tokensToday: number;
  tokensThisMinute: number;
  byModel: Record<string, ModelUsageStats>;
  lastRequestTimestamp?: number;
}

const CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 phút

export class QuotaAccountant {
  private keyStatsMap = new Map<string, InternalKeyStats>();

  public getOrCreateStats(key: string, timestamp: number = Date.now()): InternalKeyStats {
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
        consecutiveSuccesses: 0,
        tokensTotal: 0,
        tokensToday: 0,
        recentCalls: [],
        byModel: new Map<string, InternalModelStats>(),
        lastResetDay: currentDay,
        healthState: 'Healthy',
        transitionReason: 'Khởi tạo trạng thái ban đầu',
        lastTransitionAt: timestamp,
        circuitBreakerStatus: 'Closed',
        cooldownUntil: 0,
        quotaEventsTotal: 0,
        cooldownEventsTotal: 0,
      };
      this.keyStatsMap.set(keyHash, stats);
    }

    // Quota Recovery: Tự động phục hồi QuotaExhausted khi sang ngày mới theo giờ PST
    if (stats.lastResetDay !== currentDay) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.lastResetDay = currentDay;
      if (stats.healthState === 'QuotaExhausted') {
        stats.healthState = 'Healthy';
        stats.circuitBreakerStatus = 'Closed';
        stats.cooldownUntil = 0;
        stats.transitionReason = 'Hạn mức ngày đã được làm mới theo chu kỳ PST (Phục hồi)';
        stats.lastTransitionAt = timestamp;
      }
    }

    return stats;
  }

  public getKeyHealth(key: string, now: number = Date.now()): {
    state: KeyHealthState;
    consecutiveErrors: number;
    consecutiveSuccesses: number;
    cooldownRemainingMs: number;
    circuitBreaker: CircuitBreakerStatus;
    isAvailable: boolean;
    transitionReason?: string;
  } {
    if (!key || !key.trim()) {
      return {
        state: 'Disabled',
        consecutiveErrors: 0,
        consecutiveSuccesses: 0,
        cooldownRemainingMs: 0,
        circuitBreaker: 'Open',
        isAvailable: false,
        transitionReason: 'Khóa rỗng hoặc không tồn tại',
      };
    }

    const stats = this.getOrCreateStats(key, now);

    // TTL Recovery Policy: Tự động phục hồi Cooldown và RateLimited khi hết hạn TTL
    if (stats.cooldownUntil > 0 && now >= stats.cooldownUntil) {
      stats.cooldownUntil = 0;
      if (stats.circuitBreakerStatus === 'Open') {
        stats.circuitBreakerStatus = 'Closed';
      }
      if (stats.healthState === 'Cooldown' || stats.healthState === 'RateLimited') {
        stats.healthState = 'Healthy';
        stats.transitionReason = 'Thời gian tạm dừng (Cooldown TTL) đã kết thúc (Phục hồi)';
        stats.lastTransitionAt = now;
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
      consecutiveSuccesses: stats.consecutiveSuccesses,
      cooldownRemainingMs,
      circuitBreaker: stats.circuitBreakerStatus,
      isAvailable,
      transitionReason: stats.transitionReason,
    };
  }

  public recordUsage(
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats,
    latencyMs?: number
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
      stats.consecutiveSuccesses++;
      stats.consecutiveErrors = 0;
      stats.circuitBreakerStatus = 'Closed';
      stats.cooldownUntil = 0;

      if (stats.healthState === 'Degraded' || stats.healthState === 'Cooldown') {
        stats.healthState = 'Healthy';
        stats.transitionReason = 'Lượt gọi API thành công (Phục hồi)';
        stats.lastTransitionAt = timestamp;
      } else if (stats.healthState !== 'AuthFailed' && stats.healthState !== 'Disabled') {
        stats.healthState = 'Healthy';
      }
    } else {
      stats.consecutiveSuccesses = 0;
      stats.errorsTotal++;
      stats.consecutiveErrors++;

      if (status === 'quota_exceeded') {
        stats.quotaEventsTotal++;
        stats.cooldownEventsTotal++;
        stats.healthState = 'QuotaExhausted';
        stats.transitionReason = '429: Hạn mức token/request theo ngày (RPD) đã cạn kiệt';
        stats.lastTransitionAt = timestamp;
      } else if (status === 'overloaded') {
        stats.cooldownEventsTotal++;
        stats.healthState = 'Cooldown';
        stats.transitionReason = '503: Mô hình quá tải';
        stats.lastTransitionAt = timestamp;
      } else {
        if (stats.consecutiveErrors >= CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD) {
          stats.circuitBreakerStatus = 'Open';
          stats.healthState = 'Cooldown';
          stats.transitionReason = 'Vượt ngưỡng lỗi liên tiếp (Circuit Breaker ngắt mạch)';
          stats.lastTransitionAt = timestamp;
          stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
          stats.cooldownEventsTotal++;
        } else {
          stats.healthState = 'Degraded';
          stats.transitionReason = 'Gặp lỗi tạm thời (Hiệu năng suy giảm)';
          stats.lastTransitionAt = timestamp;
          stats.cooldownEventsTotal++;
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
        errorsToday: 0,
        tokensTotal: 0,
        tokensToday: 0,
        totalLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        recentCalls: [],
        lastResetDay: currentDay,
      };
      stats.byModel.set(normalizedModel, modelStats);
    }

    if (modelStats.lastResetDay !== currentDay) {
      modelStats.requestsToday = 0;
      modelStats.errorsToday = 0;
      modelStats.tokensToday = 0;
      modelStats.lastResetDay = currentDay;
    }

    modelStats.requestsTotal++;
    modelStats.requestsToday++;
    modelStats.tokensTotal += tokens;
    modelStats.tokensToday += tokens;
    modelStats.recentCalls.push({ timestamp, tokens });
    modelStats.recentCalls = modelStats.recentCalls.filter(c => c.timestamp > minuteThreshold);

    if (typeof latencyMs === 'number' && latencyMs >= 0) {
      modelStats.totalLatencyMs += latencyMs;
      modelStats.minLatencyMs = modelStats.minLatencyMs === 0 ? latencyMs : Math.min(modelStats.minLatencyMs, latencyMs);
      modelStats.maxLatencyMs = Math.max(modelStats.maxLatencyMs, latencyMs);
    }

    if (status !== 'success') {
      modelStats.errorsTotal++;
      modelStats.errorsToday++;
    }
  }

  public recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp: number = Date.now(),
    latencyMs?: number,
    callbacks?: {
      onModelCooldown?: (modelName: string, retryAfterMs: number, reason: string, timestamp: number) => void;
      onUpstreamFailure?: (modelName: string, timestamp: number) => void;
    }
  ): void {
    if (!key || !key.trim()) return;
    this.recordUsage(key, modelName, 'error', timestamp, undefined, latencyMs);

    const stats = this.getOrCreateStats(key, timestamp);

    switch (error.code) {
      case AIErrorCode.AUTH_FAILED:
        stats.healthState = 'AuthFailed';
        stats.transitionReason = '401/403: API key không hợp lệ hoặc bị từ chối truy cập';
        stats.lastTransitionAt = timestamp;
        stats.circuitBreakerStatus = 'Open';
        stats.disabledReason = error.message;
        break;

      case AIErrorCode.QUOTA_EXCEEDED:
        stats.quotaEventsTotal++;
        stats.healthState = 'QuotaExhausted';
        stats.transitionReason = '429: Hạn mức token/request theo ngày (RPD) đã cạn kiệt';
        stats.lastTransitionAt = timestamp;
        stats.circuitBreakerStatus = 'Open';
        stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
        break;

      case AIErrorCode.RATE_LIMITED:
        stats.quotaEventsTotal++;
        stats.healthState = 'RateLimited';
        stats.transitionReason = '429: Đã chạm giới hạn tốc độ (RPM/TPM)';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 5000);
        break;

      case AIErrorCode.OVERLOADED:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '503: Mô hình AI của Google hiện đang quá tải';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
        callbacks?.onModelCooldown?.(modelName, (error.retryAfterSec || 3) * 1000, '503 Model Overloaded', timestamp);
        callbacks?.onUpstreamFailure?.(modelName, timestamp);
        break;

      case AIErrorCode.NETWORK_ERROR:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '502: Lỗi kết nối mạng tới dịch vụ AI';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
        callbacks?.onUpstreamFailure?.(modelName, timestamp);
        break;

      case AIErrorCode.TIMEOUT:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '504: Yêu cầu tới dịch vụ AI bị quá thời gian chờ';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
        break;

      case AIErrorCode.SERVER_ERROR:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '500: Lỗi xử lý nội bộ từ máy chủ AI';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
        break;

      default:
        if (stats.consecutiveErrors >= CIRCUIT_BREAKER_CONSECUTIVE_THRESHOLD) {
          stats.circuitBreakerStatus = 'Open';
          stats.healthState = 'Cooldown';
          stats.transitionReason = 'Vượt ngưỡng lỗi liên tiếp (Circuit Breaker ngắt mạch)';
          stats.lastTransitionAt = timestamp;
          stats.cooldownUntil = timestamp + CIRCUIT_BREAKER_COOLDOWN_MS;
        } else {
          stats.healthState = 'Degraded';
          stats.transitionReason = 'Gặp lỗi tạm thời (Hiệu năng suy giảm)';
          stats.lastTransitionAt = timestamp;
        }
        break;
    }
  }

  public setKeyDisabled(key: string, disabled: boolean, reason?: string): void {
    if (!key || !key.trim()) return;
    const stats = this.getOrCreateStats(key);
    if (disabled) {
      stats.healthState = 'Disabled';
      stats.transitionReason = reason || 'Vô hiệu hóa thủ công bởi người dùng';
      stats.lastTransitionAt = Date.now();
      stats.disabledReason = reason;
      stats.circuitBreakerStatus = 'Open';
      stats.cooldownEventsTotal++;
    } else {
      stats.healthState = 'Healthy';
      stats.transitionReason = 'Kích hoạt lại thủ công bởi người dùng';
      stats.lastTransitionAt = Date.now();
      stats.disabledReason = undefined;
      stats.consecutiveErrors = 0;
      stats.circuitBreakerStatus = 'Closed';
      stats.cooldownUntil = 0;
    }
  }

  public getQuotaSnapshot(keys: string[], timestamp: number = Date.now()): KeyQuotaSnapshot[] {
    return computeQuotaSnapshot(
      keys,
      this.keyStatsMap,
      (key, ts) => this.getKeyHealth(key, ts),
      timestamp
    );
  }

  public getAggregatedModelStats(timestamp: number = Date.now()): Record<string, ModelUsageStats> {
    return computeAggregatedModelStats(this.keyStatsMap, timestamp);
  }

  public getStatsMap(): Map<string, InternalKeyStats> {
    return this.keyStatsMap;
  }

  public reset(): void {
    this.keyStatsMap.clear();
  }
}
