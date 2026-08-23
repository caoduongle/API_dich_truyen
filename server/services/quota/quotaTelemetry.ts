import {
  CanonicalLogicalMetrics,
  CanonicalProviderMetrics,
} from '../../../shared/models';
import { getDayInLosAngeles } from './quotaUtils';

export type KeyRejectionReason =
  | 'in_cooldown'
  | 'circuit_breaker_open'
  | 'rate_limited_pacing'
  | 'unsupported_model'
  | 'quota_exhausted'
  | 'disabled'
  | 'no_healthy_keys'
  | 'group_rate_limited'
  | 'group_quota_exhausted'
  | 'model_overloaded'
  | 'provider_outage';

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
  activeModelCooldowns?: Record<string, number>;
  activeGroupCooldowns?: Record<string, number>;
  isProviderOutage?: boolean;
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

export interface LogicalSummaryStats {
  logicalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retries: number;
  providerAttempts: number;
  providerFailures: number;

  /** @deprecated Sử dụng `logicalRequests` thay thế */
  logicalRequestsTotal: number;
  /** @deprecated Sử dụng `logicalRequests` thay thế */
  logicalRequestsToday: number;
  /** @deprecated Sử dụng `successfulRequests` thay thế */
  successfulRequestsTotal: number;
  /** @deprecated Sử dụng `successfulRequests` thay thế */
  successfulRequestsToday: number;
  /** @deprecated Sử dụng `failedRequests` thay thế */
  failedRequestsTotal: number;
  /** @deprecated Sử dụng `failedRequests` thay thế */
  failedRequestsToday: number;
  /** @deprecated Sử dụng `retries` thay thế */
  retriesTotal: number;
  /** @deprecated Sử dụng `retries` thay thế */
  retriesToday: number;
  /** @deprecated Sử dụng `providerAttempts` thay thế */
  providerAttemptsTotal: number;
  /** @deprecated Sử dụng `providerAttempts` thay thế */
  providerAttemptsToday: number;
  /** @deprecated Sử dụng `successfulRequests` thay thế */
  successfulAttemptsTotal: number;
  /** @deprecated Sử dụng `successfulRequests` thay thế */
  successfulAttemptsToday: number;
  /** @deprecated Sử dụng `providerFailures` thay thế */
  failedAttemptsTotal: number;
  /** @deprecated Sử dụng `providerFailures` thay thế */
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

export class QuotaTelemetry {
  private logicalStats: LogicalSummaryStats = {
    logicalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retries: 0,
    providerAttempts: 0,
    providerFailures: 0,
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
      no_healthy_keys: 0,
      group_rate_limited: 0,
      group_quota_exhausted: 0,
    },
  };

  private recentAttempts: RequestAttemptLog[] = [];
  private readonly MAX_RECENT_ATTEMPTS = 200;

  public recordAttemptTrace(trace: RequestAttemptLog): void {
    if (!trace) return;
    this.recentAttempts.push(trace);
    if (this.recentAttempts.length > this.MAX_RECENT_ATTEMPTS) {
      this.recentAttempts.shift();
    }
  }

  public getRecentAttempts(limit: number = 50): RequestAttemptLog[] {
    const safeLimit = Math.max(1, Math.min(limit, this.MAX_RECENT_ATTEMPTS));
    return [...this.recentAttempts].slice(-safeLimit);
  }

  public recordKeySelection(count: number = 1): void {
    this.schedulerStats.selectionCount += Math.max(1, count);
  }

  public recordKeyRejection(reason: KeyRejectionReason | string, count: number = 1): void {
    const inc = Math.max(1, count);
    this.schedulerStats.rejectedTotal += inc;
    const cleanReason = (reason || 'unknown').toLowerCase().trim();
    this.schedulerStats.rejectedByReason[cleanReason] = (this.schedulerStats.rejectedByReason[cleanReason] || 0) + inc;
  }

  public recordQueueWait(durationMs: number): void {
    if (typeof durationMs === 'number' && durationMs > 0) {
      this.schedulerStats.queueWaitTotalMs += durationMs;
      const count = Math.max(1, this.schedulerStats.selectionCount || this.logicalStats.logicalRequestsTotal || 1);
      this.schedulerStats.queueWaitAvgMs = Math.round((this.schedulerStats.queueWaitTotalMs / count) * 100) / 100;
    }
  }

  public getSchedulerTelemetry(
    now: number = Date.now(),
    cooldownContext?: {
      activeModelCooldowns: Record<string, number>;
      activeGroupCooldowns: Record<string, number>;
      isProviderOutage: boolean;
    }
  ): SchedulerTelemetry {
    const count = Math.max(1, this.schedulerStats.selectionCount || this.logicalStats.logicalRequestsTotal || 1);
    const avg = this.schedulerStats.queueWaitTotalMs > 0
      ? Math.round((this.schedulerStats.queueWaitTotalMs / count) * 100) / 100
      : 0;
    return {
      ...this.schedulerStats,
      queueWaitAvgMs: avg,
      rejectedByReason: { ...this.schedulerStats.rejectedByReason },
      activeModelCooldowns: cooldownContext?.activeModelCooldowns || {},
      activeGroupCooldowns: cooldownContext?.activeGroupCooldowns || {},
      isProviderOutage: cooldownContext?.isProviderOutage || false,
    };
  }

  public recordLogicalRequest(
    modelName: string,
    status: 'success' | 'failure',
    attemptsCount: number = 1,
    retriesCount: number = 0,
    timestamp: number = Date.now()
  ): void {
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
    return {
      ...this.logicalStats,
      logicalRequests: this.logicalStats.logicalRequestsTotal,
      successfulRequests: this.logicalStats.successfulRequestsTotal,
      failedRequests: this.logicalStats.failedRequestsTotal,
      retries: this.logicalStats.retriesTotal,
      providerAttempts: this.logicalStats.providerAttemptsTotal,
      providerFailures: this.logicalStats.failedAttemptsTotal,
    };
  }

  public getCanonicalLogicalMetrics(): CanonicalLogicalMetrics {
    return {
      logicalRequests: this.logicalStats.logicalRequestsTotal,
      successfulRequests: this.logicalStats.successfulRequestsTotal,
      failedRequests: this.logicalStats.failedRequestsTotal,
    };
  }

  public getCanonicalProviderMetrics(): CanonicalProviderMetrics {
    return {
      providerAttempts: this.logicalStats.providerAttemptsTotal,
      retries: this.logicalStats.retriesTotal,
      providerFailures: this.logicalStats.failedAttemptsTotal,
    };
  }

  public reset(): void {
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
        no_healthy_keys: 0,
        group_rate_limited: 0,
        group_quota_exhausted: 0,
        model_overloaded: 0,
        provider_outage: 0,
      },
    };
    this.logicalStats = {
      logicalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      providerAttempts: 0,
      providerFailures: 0,
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
