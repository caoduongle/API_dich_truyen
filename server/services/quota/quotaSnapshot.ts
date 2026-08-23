import { KeyHealthState, CircuitBreakerStatus } from '../../../shared/models';
import { hashApiKey, maskApiKey, getDayInLosAngeles } from './quotaUtils';
import { InternalKeyStats, ModelUsageStats, KeyQuotaSnapshot } from './quotaAccountant';

export function computeQuotaSnapshot(
  keys: string[],
  keyStatsMap: Map<string, InternalKeyStats>,
  getKeyHealth: (key: string, timestamp: number) => {
    state: KeyHealthState;
    circuitBreaker: CircuitBreakerStatus;
    cooldownRemainingMs: number;
    transitionReason?: string;
  },
  timestamp: number = Date.now()
): KeyQuotaSnapshot[] {
  const currentDay = getDayInLosAngeles(timestamp);
  const minuteThreshold = timestamp - 60000;

  return keys.map((key) => {
    const trimmedKey = key.trim();
    const keyHash = hashApiKey(trimmedKey);
    const masked = maskApiKey(trimmedKey);
    const health = getKeyHealth(trimmedKey, timestamp);

    const stats = keyStatsMap.get(keyHash);
    if (!stats) {
      return {
        keyHash,
        maskedKey: masked,
        healthState: 'Healthy',
        transitionReason: health.transitionReason,
        circuitBreakerState: 'Closed',
        cooldownRemainingMs: 0,
        keyAttempts: 0,
        keyFailures: 0,
        keyCooldowns: 0,
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
      keyAttempts: stats.requestsTotal,
      keyFailures: stats.errorsTotal,
      keyCooldowns: stats.cooldownEventsTotal,
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

export function computeAggregatedModelStats(
  keyStatsMap: Map<string, InternalKeyStats>,
  timestamp: number = Date.now()
): Record<string, ModelUsageStats> {
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

  for (const stats of keyStatsMap.values()) {
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
