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
    this.recordUsage(key, modelName, 'error', timestamp);

    const stats = this.getOrCreateStats(key, timestamp);

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
          providerAttemptsTotal: 0,
          providerAttemptsToday: 0,
          providerAttemptsThisMinute: 0,
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
        providerAttemptsTotal: stats.requestsTotal,
        providerAttemptsToday: requestsToday,
        providerAttemptsThisMinute: requestsThisMinute,
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
