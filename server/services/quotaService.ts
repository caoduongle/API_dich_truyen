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

export type KeyRejectionReason =
  | 'in_cooldown'
  | 'circuit_breaker_open'
  | 'rate_limited_pacing'
  | 'unsupported_model'
  | 'quota_exhausted'
  | 'disabled';

export interface TokenStats {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallLogEntry {
  timestamp: number;
  tokens: number;
}

export interface RequestAttemptLog {
  requestId: string;
  modelId: string;
  keyIdentifier: string; // Masked key or hash
  keyIndex: number;
  attempt: number;
  status: 'success' | 'failure';
  errorCode: string | null;
  latencyMs: number;
  queueWaitMs: number;
  timestamp: number;
}

export interface SchedulerTelemetry {
  selectionCount: number;
  queueWaitTotalMs: number;
  queueWaitAvgMs: number;
  rejectedTotal: number;
  rejectedByReason: Record<string, number>;
}

export interface ModelObservabilityMetrics {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  tokensTotal: number;
  tokensToday: number;
}

export interface KeyObservabilityMetrics {
  attemptsTotal: number;
  attemptsToday: number;
  errorsTotal: number;
  quotaEventsTotal: number;
  cooldownEventsTotal: number;
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

interface InternalModelStats {
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
  transitionReason?: string;
  lastTransitionAt: number;
  consecutiveSuccesses: number;
  circuitBreakerStatus: CircuitBreakerStatus;
  cooldownUntil: number;
  disabledReason?: string;
  quotaEventsTotal: number;
  cooldownEventsTotal: number;
}

export interface LogicalSummaryStats {
  logicalRequestsTotal: number;
  logicalRequestsToday: number;
  successfulRequestsTotal: number;
  successfulRequestsToday: number;
  failedRequestsTotal: number;
  failedRequestsToday: number;
  retriesTotal: number;
  retriesToday: number;
  providerAttemptsTotal: number;
  providerAttemptsToday: number;
  successfulAttemptsTotal: number;
  successfulAttemptsToday: number;
  failedAttemptsTotal: number;
  failedAttemptsToday: number;
  lastResetDay: string;
}

export interface ModelLogicalStats {
  logicalRequestsTotal: number;
  logicalRequestsToday: number;
  successfulRequestsTotal: number;
  successfulRequestsToday: number;
  failedRequestsTotal: number;
  failedRequestsToday: number;
  retriesTotal: number;
  retriesToday: number;
  lastResetDay: string;
}

export interface KeyQuotaSnapshot {
  keyHash: string;
  maskedKey: string;
  healthState: KeyHealthState;
  transitionReason?: string;
  circuitBreakerState: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  // Provider Attempt Metrics (Aliased with requestsTotal/requestsToday for compatibility)
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

export interface KeyScoreOptions {
  estimatedTokens?: number;
  keyRpm?: number;
  keyMaxTpm?: number;
  keyMaxRpd?: number;
  isModelSupported?: boolean | 'uninspected';
  pacingDelayMs?: number;
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
  private logicalStats: LogicalSummaryStats = {
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
  private modelLogicalStatsMap = new Map<string, ModelLogicalStats>();

  private schedulerStats: SchedulerTelemetry = {
    selectionCount: 0,
    queueWaitTotalMs: 0,
    queueWaitAvgMs: 0,
    rejectedTotal: 0,
    rejectedByReason: {
      in_cooldown: 0,
      circuit_breaker_open: 0,
      rate_limited_pacing: 0,
      unsupported_model: 0,
      quota_exhausted: 0,
      disabled: 0,
    },
  };

  private recentAttempts: RequestAttemptLog[] = [];
  private readonly MAX_RECENT_ATTEMPTS = 200;

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

  /**
   * Đọc trạng thái Key Health hiện tại với logic tự động phục hồi (Recovery Engine)
   */
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

  /**
   * Ghi nhận 1 lượt sử dụng API key và model tương ứng với số token tiêu thụ và độ trễ
   */
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
        stats.transitionReason = '429: Hạn mức ngày đã hết (RPD)';
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

  /**
   * Ghi nhận lỗi có phân loại rõ ràng (Error Taxonomy Integration)
   */
  public recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp: number = Date.now(),
    latencyMs?: number
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
        break;

      case AIErrorCode.NETWORK_ERROR:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '502: Lỗi kết nối mạng tới dịch vụ AI';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
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

  /**
   * Chấm điểm độ ưu tiên của một API Key cho request dự kiến (Predictive Candidate Scoring)
   * Tích hợp kiểm tra đa chiều: Health, Model Compatibility, RPM sliding window, TPM, RPD, Idle time và Pacing readiness.
   */
  public calculateKeyScore(
    key: string,
    modelName: string,
    estimatedTokensOrOptions: number | KeyScoreOptions = 2000,
    now: number = Date.now()
  ): {
    score: number;
    isEligible: boolean;
    rejectReason?: string;
    scoreBreakdown?: {
      rpmCapacityScore: number;
      tpmCapacityScore: number;
      idleTimeScore: number;
      pacingReadinessBonus: number;
      errorPenalty: number;
      modelSupportBonus: number;
    };
  } {
    const options: KeyScoreOptions = typeof estimatedTokensOrOptions === 'number'
      ? { estimatedTokens: estimatedTokensOrOptions }
      : (estimatedTokensOrOptions || {});

    const estimatedTokens = options.estimatedTokens ?? 2000;
    const isPro = modelName.toLowerCase().includes('pro');
    const effectiveRpm = options.keyRpm || (isPro ? 10 : 15);
    const effectiveMaxTpm = options.keyMaxTpm || 1000000;
    const effectiveMaxRpd = options.keyMaxRpd || (isPro ? 1000 : 1500);

    // 1. Kiểm tra Circuit Breaker / Key Health / Cooldown
    const health = this.getKeyHealth(key, now);
    if (!health.isAvailable) {
      const reasonKey = health.circuitBreaker === 'Open' ? 'circuit_breaker_open' : 'in_cooldown';
      return {
        score: -1000,
        isEligible: false,
        rejectReason: `Key đang ở trạng thái ${health.state} (Cooldown: ${health.cooldownRemainingMs}ms)`,
      };
    }

    // 2. Kiểm tra tính tương thích của Model (nếu đã xác minh và không hỗ trợ)
    if (options.isModelSupported === false) {
      return {
        score: -800,
        isEligible: false,
        rejectReason: `Key không hỗ trợ mô hình "${modelName}"`,
      };
    }

    const stats = this.getOrCreateStats(key, now);
    const minuteThreshold = now - 60000;
    const recentCalls = stats.recentCalls.filter(c => c.timestamp > minuteThreshold);
    const requestsThisMinute = recentCalls.length;
    const currentTokensThisMinute = recentCalls.reduce((sum, c) => sum + c.tokens, 0);

    // 3. Kiểm tra hạn mức RPM trượt trong 60 giây
    if (requestsThisMinute >= effectiveRpm) {
      return {
        score: -400,
        isEligible: false,
        rejectReason: `Key đã chạm giới hạn RPM trong phút hiện tại (${requestsThisMinute}/${effectiveRpm} RPM)`,
      };
    }

    // 4. Kiểm tra Predictive TPM trong 60 giây
    if (currentTokensThisMinute + estimatedTokens > effectiveMaxTpm * 0.95) {
      return {
        score: -500,
        isEligible: false,
        rejectReason: `Dự toán token (${estimatedTokens}) sẽ vượt ngưỡng an toàn TPM (${currentTokensThisMinute}/${effectiveMaxTpm} TPM)`,
      };
    }

    // 5. Kiểm tra hạn mức RPD trong ngày
    const currentDay = getDayInLosAngeles(now);
    const requestsToday = stats.lastResetDay === currentDay ? stats.requestsToday : 0;
    if (requestsToday >= effectiveMaxRpd) {
      return {
        score: -600,
        isEligible: false,
        rejectReason: `Key đã chạm giới hạn RPD trong ngày (${requestsToday}/${effectiveMaxRpd} RPD)`,
      };
    }

    // ── TÍNH TOÁN COMPOSITE SCORING ──
    // a. Điểm dung lượng TPM còn lại (tối đa 500 điểm)
    const tpmCapacityScore = Math.max(0, ((effectiveMaxTpm - currentTokensThisMinute) / effectiveMaxTpm) * 500);

    // b. Điểm dung lượng RPM còn lại (tối đa 500 điểm)
    const rpmCapacityScore = Math.max(0, ((effectiveRpm - requestsThisMinute) / effectiveRpm) * 500);

    // c. Điểm rảnh rỗi kể từ lần dùng cuối (tối đa 600 điểm, tự động phân phối xoay vòng)
    const idleSeconds = stats.lastRequestTimestamp ? Math.min(600, Math.floor((now - stats.lastRequestTimestamp) / 1000)) : 600;
    const idleTimeScore = idleSeconds;

    // d. Điểm sẵn sàng Pacing (thưởng 300 điểm nếu key không phải chờ hoãn)
    const pacingDelay = options.pacingDelayMs || 0;
    const pacingReadinessBonus = pacingDelay <= 0 ? 300 : Math.max(-200, 200 - Math.floor(pacingDelay / 10));

    // e. Phạt lỗi liên tiếp (-200 điểm / lỗi)
    const errorPenalty = stats.consecutiveErrors * 200;

    // f. Thưởng model được xác minh trực tiếp (+100 điểm)
    const modelSupportBonus = options.isModelSupported === true ? 100 : 0;

    const totalScore = tpmCapacityScore + rpmCapacityScore + idleTimeScore + pacingReadinessBonus - errorPenalty + modelSupportBonus;

    return {
      score: Math.round(totalScore * 10) / 10,
      isEligible: true,
      scoreBreakdown: {
        rpmCapacityScore: Math.round(rpmCapacityScore),
        tpmCapacityScore: Math.round(tpmCapacityScore),
        idleTimeScore,
        pacingReadinessBonus: Math.round(pacingReadinessBonus),
        errorPenalty,
        modelSupportBonus,
      },
    };
  }

  /**
   * Ghi nhận dấu vết lượt gọi provider attempt (Attempt Trace)
   */
  public recordAttemptTrace(trace: RequestAttemptLog): void {
    if (!trace) return;
    this.recentAttempts.push(trace);
    if (this.recentAttempts.length > this.MAX_RECENT_ATTEMPTS) {
      this.recentAttempts.shift();
    }
  }

  /**
   * Lấy danh sách các attempt traces gần đây nhất (Bounded Rolling Buffer)
   */
  public getRecentAttempts(limit: number = 50): RequestAttemptLog[] {
    const safeLimit = Math.max(1, Math.min(limit, this.MAX_RECENT_ATTEMPTS));
    return [...this.recentAttempts].slice(-safeLimit);
  }

  /**
   * Ghi nhận số lượt đánh giá / lựa chọn khóa trong Scheduler
   */
  public recordKeySelection(count: number = 1): void {
    this.schedulerStats.selectionCount += Math.max(1, count);
  }

  /**
   * Ghi nhận lượt từ chối khóa và phân loại lý do từ chối
   */
  public recordKeyRejection(reason: KeyRejectionReason | string, count: number = 1): void {
    const inc = Math.max(1, count);
    this.schedulerStats.rejectedTotal += inc;
    const cleanReason = (reason || 'unknown').toLowerCase().trim();
    this.schedulerStats.rejectedByReason[cleanReason] = (this.schedulerStats.rejectedByReason[cleanReason] || 0) + inc;
  }

  /**
   * Ghi nhận độ trễ hàng đợi / pacing chờ đợi trước khi gọi upstream API
   */
  public recordQueueWait(durationMs: number): void {
    if (typeof durationMs === 'number' && durationMs > 0) {
      this.schedulerStats.queueWaitTotalMs += durationMs;
      const count = Math.max(1, this.schedulerStats.selectionCount || this.logicalStats.logicalRequestsTotal || 1);
      this.schedulerStats.queueWaitAvgMs = Math.round((this.schedulerStats.queueWaitTotalMs / count) * 100) / 100;
    }
  }

  /**
   * Đọc thống kê vận hành Scheduler Telemetry
   */
  public getSchedulerTelemetry(): SchedulerTelemetry {
    const count = Math.max(1, this.schedulerStats.selectionCount || this.logicalStats.logicalRequestsTotal || 1);
    const avg = this.schedulerStats.queueWaitTotalMs > 0
      ? Math.round((this.schedulerStats.queueWaitTotalMs / count) * 100) / 100
      : 0;
    return {
      ...this.schedulerStats,
      queueWaitAvgMs: avg,
      rejectedByReason: { ...this.schedulerStats.rejectedByReason },
    };
  }

  /**
   * Đặt trạng thái Vô hiệu hóa thủ công cho 1 API key
   */
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
          transitionReason: health.transitionReason,
          circuitBreakerState: 'Closed',
          cooldownRemainingMs: 0,
          providerAttemptsTotal: 0,
          providerAttemptsToday: 0,
          providerAttemptsThisMinute: 0,
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          errorsTotal: 0,
          consecutiveErrors: 0,
          quotaEventsTotal: 0,
          cooldownEventsTotal: 0,
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
        const avgLat = mStats.requestsTotal > 0 ? Math.round((mStats.totalLatencyMs / mStats.requestsTotal) * 10) / 10 : 0;

        byModelSnapshot[model] = {
          requestsTotal: mStats.requestsTotal,
          requestsToday: mStats.lastResetDay === currentDay ? mStats.requestsToday : 0,
          requestsThisMinute: mRecentCalls.length,
          errorsTotal: mStats.errorsTotal,
          errorsToday: mStats.lastResetDay === currentDay ? mStats.errorsToday : 0,
          totalLatencyMs: mStats.totalLatencyMs,
          avgLatencyMs: avgLat,
          minLatencyMs: mStats.minLatencyMs,
          maxLatencyMs: mStats.maxLatencyMs,
          tokensTotal: mStats.tokensTotal,
          tokensToday: mStats.lastResetDay === currentDay ? mStats.tokensToday : 0,
          tokensThisMinute: mRecentCalls.reduce((sum, c) => sum + c.tokens, 0),
        };
      }

      return {
        keyHash,
        maskedKey: masked,
        healthState: health.state,
        transitionReason: stats.transitionReason || health.transitionReason,
        circuitBreakerState: health.circuitBreaker,
        cooldownRemainingMs: health.cooldownRemainingMs,
        providerAttemptsTotal: stats.requestsTotal,
        providerAttemptsToday: requestsToday,
        providerAttemptsThisMinute: requestsThisMinute,
        requestsTotal: stats.requestsTotal,
        requestsToday,
        requestsThisMinute,
        errorsTotal: stats.errorsTotal,
        consecutiveErrors: stats.consecutiveErrors,
        quotaEventsTotal: stats.quotaEventsTotal,
        cooldownEventsTotal: stats.cooldownEventsTotal,
        tokensTotal: stats.tokensTotal,
        tokensToday,
        tokensThisMinute,
        byModel: byModelSnapshot,
        lastRequestTimestamp: stats.lastRequestTimestamp,
      };
    });
  }

  /**
   * Lấy thống kê chi tiết của tất cả các mô hình AI đã từng gọi
   */
  public getAggregatedModelStats(timestamp: number = Date.now()): Record<string, ModelUsageStats> {
    const aggregated: Record<string, {
      requestsTotal: number;
      requestsToday: number;
      requestsThisMinute: number;
      errorsTotal: number;
      errorsToday: number;
      totalLatencyMs: number;
      minLatencyMs: number;
      maxLatencyMs: number;
      tokensTotal: number;
      tokensToday: number;
      tokensThisMinute: number;
    }> = {};

    const currentDay = getDayInLosAngeles(timestamp);
    const minuteThreshold = timestamp - 60000;

    for (const stats of this.keyStatsMap.values()) {
      for (const [model, mStats] of stats.byModel.entries()) {
        if (!aggregated[model]) {
          aggregated[model] = {
            requestsTotal: 0,
            requestsToday: 0,
            requestsThisMinute: 0,
            errorsTotal: 0,
            errorsToday: 0,
            totalLatencyMs: 0,
            minLatencyMs: 0,
            maxLatencyMs: 0,
            tokensTotal: 0,
            tokensToday: 0,
            tokensThisMinute: 0,
          };
        }

        const agg = aggregated[model];
        const mRecentCalls = mStats.recentCalls.filter(c => c.timestamp > minuteThreshold);
        agg.requestsTotal += mStats.requestsTotal;
        agg.requestsToday += mStats.lastResetDay === currentDay ? mStats.requestsToday : 0;
        agg.requestsThisMinute += mRecentCalls.length;
        agg.errorsTotal += mStats.errorsTotal;
        agg.errorsToday += mStats.lastResetDay === currentDay ? mStats.errorsToday : 0;
        agg.totalLatencyMs += mStats.totalLatencyMs;
        agg.minLatencyMs = agg.minLatencyMs === 0 ? mStats.minLatencyMs : Math.min(agg.minLatencyMs, mStats.minLatencyMs || agg.minLatencyMs);
        agg.maxLatencyMs = Math.max(agg.maxLatencyMs, mStats.maxLatencyMs);
        agg.tokensTotal += mStats.tokensTotal;
        agg.tokensToday += mStats.lastResetDay === currentDay ? mStats.tokensToday : 0;
        agg.tokensThisMinute += mRecentCalls.reduce((sum, c) => sum + c.tokens, 0);
      }
    }

    const result: Record<string, ModelUsageStats> = {};
    for (const [model, agg] of Object.entries(aggregated)) {
      const avgLat = agg.requestsTotal > 0 ? Math.round((agg.totalLatencyMs / agg.requestsTotal) * 10) / 10 : 0;
      result[model] = {
        requestsTotal: agg.requestsTotal,
        requestsToday: agg.requestsToday,
        requestsThisMinute: agg.requestsThisMinute,
        errorsTotal: agg.errorsTotal,
        errorsToday: agg.errorsToday,
        totalLatencyMs: agg.totalLatencyMs,
        avgLatencyMs: avgLat,
        minLatencyMs: agg.minLatencyMs,
        maxLatencyMs: agg.maxLatencyMs,
        tokensTotal: agg.tokensTotal,
        tokensToday: agg.tokensToday,
        tokensThisMinute: agg.tokensThisMinute,
      };
    }

    return result;
  }

  /**
   * Ghi nhận vòng đời của một yêu cầu dịch logic (Logical Translation Request)
   * Tách biệt rõ ràng giữa số lần người dùng gửi yêu cầu và số lần gọi API thực tế (Provider Attempts/Retries)
   */
  public recordLogicalRequest(
    modelName: string,
    status: 'success' | 'failure',
    attemptsCount: number = 1,
    retriesCount: number = 0,
    timestamp: number = Date.now()
  ): void {
    const currentDay = getDayInLosAngeles(timestamp);

    // Kiểm tra reset ngày cho logicalStats
    if (this.logicalStats.lastResetDay !== currentDay) {
      this.logicalStats.logicalRequestsToday = 0;
      this.logicalStats.successfulRequestsToday = 0;
      this.logicalStats.failedRequestsToday = 0;
      this.logicalStats.retriesToday = 0;
      this.logicalStats.providerAttemptsToday = 0;
      this.logicalStats.successfulAttemptsToday = 0;
      this.logicalStats.failedAttemptsToday = 0;
      this.logicalStats.lastResetDay = currentDay;
    }

    const safeAttempts = Math.max(1, attemptsCount);
    const safeRetries = Math.max(0, retriesCount !== undefined ? retriesCount : safeAttempts - 1);

    this.logicalStats.logicalRequestsTotal++;
    this.logicalStats.logicalRequestsToday++;
    this.logicalStats.retriesTotal += safeRetries;
    this.logicalStats.retriesToday += safeRetries;
    this.logicalStats.providerAttemptsTotal += safeAttempts;
    this.logicalStats.providerAttemptsToday += safeAttempts;

    if (status === 'success') {
      this.logicalStats.successfulRequestsTotal++;
      this.logicalStats.successfulRequestsToday++;
      this.logicalStats.successfulAttemptsTotal += 1;
      this.logicalStats.successfulAttemptsToday += 1;
      this.logicalStats.failedAttemptsTotal += (safeAttempts - 1);
      this.logicalStats.failedAttemptsToday += (safeAttempts - 1);
    } else {
      this.logicalStats.failedRequestsTotal++;
      this.logicalStats.failedRequestsToday++;
      this.logicalStats.failedAttemptsTotal += safeAttempts;
      this.logicalStats.failedAttemptsToday += safeAttempts;
    }

    // Ghi nhận theo Model
    const normalizedModel = modelName ? (modelName.startsWith('models/') ? modelName : `models/${modelName}`) : 'unknown';
    let mStats = this.modelLogicalStatsMap.get(normalizedModel);
    if (!mStats) {
      mStats = {
        logicalRequestsTotal: 0,
        logicalRequestsToday: 0,
        successfulRequestsTotal: 0,
        successfulRequestsToday: 0,
        failedRequestsTotal: 0,
        failedRequestsToday: 0,
        retriesTotal: 0,
        retriesToday: 0,
        lastResetDay: currentDay,
      };
      this.modelLogicalStatsMap.set(normalizedModel, mStats);
    }

    if (mStats.lastResetDay !== currentDay) {
      mStats.logicalRequestsToday = 0;
      mStats.successfulRequestsToday = 0;
      mStats.failedRequestsToday = 0;
      mStats.retriesToday = 0;
      mStats.lastResetDay = currentDay;
    }

    mStats.logicalRequestsTotal++;
    mStats.logicalRequestsToday++;
    mStats.retriesTotal += safeRetries;
    mStats.retriesToday += safeRetries;
    if (status === 'success') {
      mStats.successfulRequestsTotal++;
      mStats.successfulRequestsToday++;
    } else {
      mStats.failedRequestsTotal++;
      mStats.failedRequestsToday++;
    }
  }

  /**
   * Lấy thống kê tổng hợp toàn hệ thống (Logical & Provider Summary)
   */
  public getLogicalSummary(timestamp: number = Date.now()): LogicalSummaryStats {
    const currentDay = getDayInLosAngeles(timestamp);
    if (this.logicalStats.lastResetDay !== currentDay) {
      this.logicalStats.logicalRequestsToday = 0;
      this.logicalStats.successfulRequestsToday = 0;
      this.logicalStats.failedRequestsToday = 0;
      this.logicalStats.retriesToday = 0;
      this.logicalStats.providerAttemptsToday = 0;
      this.logicalStats.successfulAttemptsToday = 0;
      this.logicalStats.failedAttemptsToday = 0;
      this.logicalStats.lastResetDay = currentDay;
    }
    return { ...this.logicalStats };
  }

  /**
   * Reset toàn bộ dữ liệu in-memory (dùng cho testing)
   */
  public resetAll(): void {
    this.keyStatsMap.clear();
    this.modelLogicalStatsMap.clear();
    this.recentAttempts = [];
    this.schedulerStats = {
      selectionCount: 0,
      queueWaitTotalMs: 0,
      queueWaitAvgMs: 0,
      rejectedTotal: 0,
      rejectedByReason: {
        in_cooldown: 0,
        circuit_breaker_open: 0,
        rate_limited_pacing: 0,
        unsupported_model: 0,
        quota_exhausted: 0,
        disabled: 0,
      },
    };
    this.logicalStats = {
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
  }
}

export const quotaService = new QuotaService();
