import { AIErrorCode, AIErrorNormalized } from '../constants/errors';
import {
  ProviderQuota,
  ConfiguredQuota,
  GroupObservedUsage,
  GroupSchedulingHint,
  GroupHealthState,
  KeyHealthState,
  CircuitBreakerStatus,
  QuotaGroup,
  QuotaGroupConfigInput,
  ApiKeyEntity,
  ScheduleLease,
  ModelCooldownRecord,
  ProviderOutageStatus,
  PACING_SAFETY_FLOOR_SERVER_MS,
  CanonicalLogicalMetrics,
  CanonicalProviderMetrics,
  KeyActivityMetrics,
  ProjectBindingSource,
  ProjectVerificationStatus,
  ProjectMetadata,
} from '../../shared/models';

import {
  hashApiKey,
  maskApiKey,
  getDayInLosAngeles,
} from './quota/quotaUtils';

import {
  CircuitBreakerManager,
} from './quota/circuitBreaker';

import {
  GroupManager,
  computeGroupInterval,
  deriveSchedulingHint,
} from './quota/groupManager';

import {
  QuotaAccountant,
  QuotaAttemptStatus,
  TokenStats,
  CallLogEntry,
  ModelUsageStats,
  InternalModelStats,
  InternalKeyStats,
  KeyQuotaSnapshot,
} from './quota/quotaAccountant';

import {
  QuotaTelemetry,
  KeyRejectionReason,
  RequestAttemptLog,
  SchedulerTelemetry,
  ModelObservabilityMetrics,
  KeyObservabilityMetrics,
  LogicalSummaryStats,
  ModelLogicalStats,
} from './quota/quotaTelemetry';

import {
  KeyScheduler,
  GroupScoreResult,
} from './quota/keyScheduler';

export type {
  ProviderQuota,
  ConfiguredQuota,
  GroupObservedUsage,
  GroupSchedulingHint,
  GroupHealthState,
  KeyHealthState,
  CircuitBreakerStatus,
  QuotaGroup,
  QuotaGroupConfigInput,
  ApiKeyEntity,
  ScheduleLease,
  ModelCooldownRecord,
  ProviderOutageStatus,
  CanonicalLogicalMetrics,
  CanonicalProviderMetrics,
  KeyActivityMetrics,
  ProjectBindingSource,
  ProjectVerificationStatus,
  ProjectMetadata,
  QuotaAttemptStatus,
  KeyRejectionReason,
  TokenStats,
  CallLogEntry,
  RequestAttemptLog,
  SchedulerTelemetry,
  ModelObservabilityMetrics,
  KeyObservabilityMetrics,
  ModelUsageStats,
  LogicalSummaryStats,
  ModelLogicalStats,
  KeyQuotaSnapshot,
  GroupScoreResult,
};

export {
  PACING_SAFETY_FLOOR_SERVER_MS,
  hashApiKey,
  maskApiKey,
  getDayInLosAngeles,
};

class QuotaService {
  private circuitBreaker = new CircuitBreakerManager();
  private groupManager: GroupManager;
  private accountant = new QuotaAccountant();
  private telemetry = new QuotaTelemetry();
  private scheduler = new KeyScheduler();

  constructor() {
    this.groupManager = new GroupManager((key: string) => {
      this.accountant.getOrCreateStats(key);
    });
  }

  public normalizeModelName(modelName: string): string {
    return this.circuitBreaker.normalizeModelName(modelName);
  }

  public triggerModelCooldown(
    modelName: string,
    durationMs: number = 3000,
    reason?: string,
    now: number = Date.now()
  ): void {
    this.circuitBreaker.triggerModelCooldown(modelName, durationMs, reason, now);
  }

  public getModelCooldownStatus(
    modelName: string,
    now: number = Date.now()
  ): { inCooldown: boolean; remainingMs: number; reason?: string } {
    return this.circuitBreaker.getModelCooldownStatus(modelName, now);
  }

  public getActiveModelCooldowns(now: number = Date.now()): Record<string, number> {
    return this.circuitBreaker.getActiveModelCooldowns(now);
  }

  public recordUpstreamFailureEvent(
    modelName: string,
    groupId: string,
    timestamp: number = Date.now()
  ): boolean {
    return this.circuitBreaker.recordUpstreamFailureEvent(modelName, groupId, timestamp);
  }

  public getProviderOutageStatus(now: number = Date.now()): { isOutage: boolean; remainingMs: number } {
    return this.circuitBreaker.getProviderOutageStatus(now);
  }

  public getActiveGroupCooldowns(now: number = Date.now()): Record<string, number> {
    return this.circuitBreaker.getActiveGroupCooldowns(this.groupManager.getAllQuotaGroups(), now);
  }

  public computeGroupInterval(rpm?: number, modelName?: string): number {
    return computeGroupInterval(rpm, modelName);
  }

  public deriveSchedulingHint(
    configuredLimits?: ConfiguredQuota,
    providerQuota?: ProviderQuota,
    modelName?: string,
    safetyFloorMs: number = PACING_SAFETY_FLOOR_SERVER_MS
  ): GroupSchedulingHint {
    return deriveSchedulingHint(configuredLimits, providerQuota, modelName, safetyFloorMs);
  }

  public registerQuotaGroup(input: QuotaGroupConfigInput): QuotaGroup {
    return this.groupManager.registerQuotaGroup(input);
  }

  public verifyGroupProject(
    groupId: string,
    verifiedProjectId: string,
    verifiedAtMs: number = Date.now()
  ): boolean {
    return this.groupManager.verifyGroupProject(groupId, verifiedProjectId, verifiedAtMs);
  }

  public areKeysInSameVerifiedBucket(keyA: string, keyB: string): boolean {
    return this.groupManager.areKeysInSameVerifiedBucket(keyA, keyB);
  }

  public updateProviderQuota(
    groupId: string,
    quota: Partial<ProviderQuota>,
    now: number = Date.now()
  ): QuotaGroup | null {
    return this.groupManager.updateProviderQuota(groupId, quota, now);
  }

  public ensureKeyGroup(key: string, customGroupId?: string, customRpm?: number): QuotaGroup {
    return this.groupManager.ensureKeyGroup(key, customGroupId, customRpm);
  }

  public getQuotaGroup(groupId: string): QuotaGroup | undefined {
    return this.groupManager.getQuotaGroup(groupId);
  }

  public getAllQuotaGroups(): QuotaGroup[] {
    return this.groupManager.getAllQuotaGroups();
  }

  public getGroupIdForKey(key: string): string | undefined {
    return this.groupManager.getGroupIdForKey(key);
  }

  public evaluateQuotaGroups(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now()
  ): GroupScoreResult[] {
    const groupsMap = new Map<string, QuotaGroup>();
    for (const g of this.groupManager.getAllQuotaGroups()) {
      groupsMap.set(g.id, g);
    }
    const groupPstResetDay = new Map<string, string>();
    for (const g of this.groupManager.getAllQuotaGroups()) {
      const day = this.groupManager.getPstResetDay(g.id) || getDayInLosAngeles(now);
      groupPstResetDay.set(g.id, day);
    }

    const results = this.scheduler.evaluateQuotaGroups(
      groupsMap,
      groupPstResetDay,
      candidateKeys,
      modelName,
      estimatedTokens,
      now,
      (key) => this.ensureKeyGroup(key),
      (key, timestamp) => this.getKeyHealth(key, timestamp)
    );

    // Sync back groupPstResetDay
    for (const [gid, day] of groupPstResetDay.entries()) {
      this.groupManager.setPstResetDay(gid, day);
    }

    return results;
  }

  public selectBestKeyInGroup(
    groupId: string,
    candidateRawKeys?: string[],
    now: number = Date.now()
  ): {
    key: string;
    keyHash: string;
    score: number;
    pacingDelayMs: number;
  } | null {
    const groupsMap = new Map<string, QuotaGroup>();
    for (const g of this.groupManager.getAllQuotaGroups()) {
      groupsMap.set(g.id, g);
    }
    return this.scheduler.selectBestKeyInGroup(
      groupId,
      groupsMap,
      candidateRawKeys,
      now,
      (key, timestamp) => this.getKeyHealth(key, timestamp),
      (key, timestamp) => this.accountant.getOrCreateStats(key, timestamp)
    );
  }

  public scheduleAttempt(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now()
  ): ScheduleLease {
    return this.scheduler.scheduleAttempt(
      candidateKeys,
      modelName,
      estimatedTokens,
      now,
      {
        getProviderOutageStatus: (ts) => this.getProviderOutageStatus(ts),
        getModelCooldownStatus: (m, ts) => this.getModelCooldownStatus(m, ts),
        recordKeyRejection: (r) => this.recordKeyRejection(r),
        recordQueueWait: (d) => this.recordQueueWait(d),
        evaluateQuotaGroups: (keys, m, tokens, ts) => this.evaluateQuotaGroups(keys, m, tokens, ts),
        selectBestKeyInGroup: (gid, keys, ts) => this.selectBestKeyInGroup(gid, keys, ts),
        getKeyHealth: (k, ts) => this.getKeyHealth(k, ts),
      }
    );
  }

  public triggerGroupCooldown(
    groupId: string,
    durationMs: number = 5000,
    reason?: string,
    now: number = Date.now()
  ): void {
    const group = this.groupManager.getQuotaGroup(groupId);
    if (!group) return;
    this.circuitBreaker.triggerGroupCooldown(group, durationMs, reason, now);
  }

  public recordGroupUsage(
    groupId: string,
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats,
    latencyMs?: number
  ): void {
    let group = this.groupManager.getQuotaGroup(groupId);
    if (!group) {
      group = this.ensureKeyGroup(key, groupId);
    }

    const currentDay = getDayInLosAngeles(timestamp);
    if (!group.callLog) group.callLog = [];
    const tokens = tokenStats?.totalTokens || 0;

    const lastReset = this.groupManager.getPstResetDay(group.id) || currentDay;
    if (lastReset !== currentDay) {
      group.observedUsage.requestsToday = 0;
      group.observedUsage.tokensToday = 0;
      group.observedUsage.errorsToday = 0;
      this.groupManager.setPstResetDay(group.id, currentDay);
      if (group.healthState === 'Exhausted') {
        group.healthState = 'Available';
      }
    }

    group.observedUsage.requestsTotal++;
    group.observedUsage.requestsToday++;
    group.observedUsage.tokensTotal += tokens;
    group.observedUsage.tokensToday += tokens;
    group.observedUsage.lastRequestTimestamp = timestamp;
    group.callLog.push({ timestamp, tokens });

    const minuteThreshold = timestamp - 60000;
    group.callLog = group.callLog.filter((c: { timestamp: number; tokens: number }) => c.timestamp > minuteThreshold);
    group.observedUsage.requestsThisMinute = group.callLog.length;
    group.observedUsage.tokensThisMinute = group.callLog.reduce((s: number, c: { timestamp: number; tokens: number }) => s + c.tokens, 0);

    if (status !== 'success') {
      group.observedUsage.errorsTotal++;
      group.observedUsage.errorsToday++;
    }

    // Ghi nhận chi tiết vào keyStats
    this.recordUsage(key, modelName, status, timestamp, tokenStats, latencyMs);
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
    return this.accountant.getKeyHealth(key, now);
  }

  public recordUsage(
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats,
    latencyMs?: number
  ): void {
    this.accountant.recordUsage(key, modelName, status, timestamp, tokenStats, latencyMs);
  }

  public recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp: number = Date.now(),
    latencyMs?: number
  ): void {
    this.accountant.recordCategorizedError(key, modelName, error, timestamp, latencyMs, {
      onModelCooldown: (mName, durationMs, reason, ts) => {
        this.triggerModelCooldown(mName, durationMs, reason, ts);
      },
      onUpstreamFailure: (mName, ts) => {
        const grpId = this.getGroupIdForKey(key);
        if (grpId) this.recordUpstreamFailureEvent(mName, grpId, ts);
      },
    });
  }

  public recordAttemptTrace(trace: RequestAttemptLog): void {
    this.telemetry.recordAttemptTrace(trace);
  }

  public getRecentAttempts(limit: number = 50): RequestAttemptLog[] {
    return this.telemetry.getRecentAttempts(limit);
  }

  public recordKeySelection(count: number = 1): void {
    this.telemetry.recordKeySelection(count);
  }

  public recordKeyRejection(reason: KeyRejectionReason | string, count: number = 1): void {
    this.telemetry.recordKeyRejection(reason, count);
  }

  public recordQueueWait(durationMs: number): void {
    this.telemetry.recordQueueWait(durationMs);
  }

  public getSchedulerTelemetry(now: number = Date.now()): SchedulerTelemetry {
    return this.telemetry.getSchedulerTelemetry(now, {
      activeModelCooldowns: this.getActiveModelCooldowns(now),
      activeGroupCooldowns: this.getActiveGroupCooldowns(now),
      isProviderOutage: this.getProviderOutageStatus(now).isOutage,
    });
  }

  public setKeyDisabled(key: string, disabled: boolean, reason?: string): void {
    this.accountant.setKeyDisabled(key, disabled, reason);
  }

  public getQuotaSnapshot(keys: string[], timestamp: number = Date.now()): KeyQuotaSnapshot[] {
    return this.accountant.getQuotaSnapshot(keys, timestamp);
  }

  public getAggregatedModelStats(timestamp: number = Date.now()): Record<string, ModelUsageStats> {
    return this.accountant.getAggregatedModelStats(timestamp);
  }

  public recordLogicalRequest(
    modelName: string,
    status: 'success' | 'failure',
    attemptsCount: number = 1,
    retriesCount: number = 0,
    timestamp: number = Date.now()
  ): void {
    this.telemetry.recordLogicalRequest(modelName, status, attemptsCount, retriesCount, timestamp);
  }

  public getLogicalSummary(timestamp: number = Date.now()): LogicalSummaryStats {
    return this.telemetry.getLogicalSummary(timestamp);
  }

  public getCanonicalLogicalMetrics(): CanonicalLogicalMetrics {
    return this.telemetry.getCanonicalLogicalMetrics();
  }

  public getCanonicalProviderMetrics(): CanonicalProviderMetrics {
    return this.telemetry.getCanonicalProviderMetrics();
  }

  public getKeyActivityMetrics(key: string): KeyActivityMetrics {
    const keyHash = hashApiKey(key.trim());
    const stats = this.accountant.getStatsMap().get(keyHash);
    return {
      keyAttempts: stats ? stats.requestsTotal : 0,
      keyFailures: stats ? stats.errorsTotal : 0,
      keyCooldowns: stats ? stats.cooldownEventsTotal : 0,
    };
  }

  public resetAll(): void {
    this.circuitBreaker.reset();
    this.groupManager.reset();
    this.accountant.reset();
    this.telemetry.reset();
  }
}

export const quotaService = new QuotaService();
