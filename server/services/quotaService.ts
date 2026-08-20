import crypto from 'crypto';
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
} from '../../shared/models';

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
};
export { PACING_SAFETY_FLOOR_SERVER_MS };

export type QuotaAttemptStatus = 'success' | 'overloaded' | 'quota_exceeded' | 'safety' | 'error';

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


export interface GroupScoreResult {
  group: QuotaGroup;
  isEligible: boolean;
  rejectReason?: string;
  score: number;
  scoreBreakdown: {
    rpmCapacityScore: number;
    tpmCapacityScore: number;
    idleTimeScore: number;
    pacingReadinessBonus: number;
    errorPenalty: number;
  };
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
  private groupsMap = new Map<string, QuotaGroup>();
  private keyToGroupId = new Map<string, string>();
  private keyStatsMap = new Map<string, InternalKeyStats>();
  private groupPstResetDay = new Map<string, string>();

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
      no_healthy_keys: 0,
      group_rate_limited: 0,
      group_quota_exhausted: 0,
    },
  };

  private recentAttempts: RequestAttemptLog[] = [];
  private readonly MAX_RECENT_ATTEMPTS = 200;

  private modelCooldownsMap = new Map<string, ModelCooldownRecord>();
  private providerOutageUntilMs: number = 0;
  private recentProviderFailures: Array<{ modelName: string; groupId: string; timestamp: number }> = [];

  /**
   * Chuẩn hóa tên Model để tra cứu Cooldown
   */
  public normalizeModelName(modelName: string): string {
    return (modelName || '').replace(/^models\//i, '').trim().toLowerCase();
  }

  /**
   * Kích hoạt Cooldown cho một mô hình cụ thể khi gặp 503 Overload
   */
  public triggerModelCooldown(
    modelName: string,
    durationMs: number = 3000,
    reason?: string,
    now: number = Date.now()
  ): void {
    const norm = this.normalizeModelName(modelName);
    if (!norm) return;
    const record = this.modelCooldownsMap.get(norm) || {
      modelName: norm,
      cooldownUntilMs: 0,
      consecutiveOverloads: 0,
      lastOverloadAtMs: 0,
    };
    record.consecutiveOverloads++;
    record.lastOverloadAtMs = now;
    record.reason = reason || '503 Model Overloaded';
    const backoffFactor = Math.min(5, Math.pow(1.5, record.consecutiveOverloads - 1));
    const totalCooldownMs = Math.min(30000, Math.round(durationMs * backoffFactor));
    record.cooldownUntilMs = now + totalCooldownMs;
    this.modelCooldownsMap.set(norm, record);
  }

  /**
   * Kiểm tra trạng thái Cooldown của một Model cụ thể
   */
  public getModelCooldownStatus(
    modelName: string,
    now: number = Date.now()
  ): { inCooldown: boolean; remainingMs: number; reason?: string } {
    const norm = this.normalizeModelName(modelName);
    if (!norm) return { inCooldown: false, remainingMs: 0 };
    const record = this.modelCooldownsMap.get(norm);
    if (record && record.cooldownUntilMs > now) {
      return {
        inCooldown: true,
        remainingMs: record.cooldownUntilMs - now,
        reason: record.reason,
      };
    }
    return { inCooldown: false, remainingMs: 0 };
  }

  /**
   * Lấy danh sách các Model đang trong thời gian Cooldown
   */
  public getActiveModelCooldowns(now: number = Date.now()): Record<string, number> {
    const active: Record<string, number> = {};
    for (const [model, record] of this.modelCooldownsMap.entries()) {
      if (record.cooldownUntilMs > now) {
        active[model] = record.cooldownUntilMs - now;
      }
    }
    return active;
  }

  /**
   * Ghi nhận sự cố hệ thống để theo dõi Provider-Wide Outage
   */
  public recordUpstreamFailureEvent(
    modelName: string,
    groupId: string,
    timestamp: number = Date.now()
  ): boolean {
    const norm = this.normalizeModelName(modelName);
    this.recentProviderFailures.push({ modelName: norm, groupId, timestamp });
    const windowThreshold = timestamp - 5000;
    this.recentProviderFailures = this.recentProviderFailures.filter(e => e.timestamp > windowThreshold);

    const distinctModels = new Set(this.recentProviderFailures.map(e => e.modelName));
    const distinctGroups = new Set(this.recentProviderFailures.map(e => e.groupId));

    // Ngưỡng phát hiện sự cố diện rộng: >= 2 models VÀ >= 2 groups đồng thời lỗi trong 5s
    if (distinctModels.size >= 2 && distinctGroups.size >= 2) {
      this.providerOutageUntilMs = Math.max(this.providerOutageUntilMs, timestamp + 5000);
      return true;
    }
    return false;
  }

  /**
   * Kiểm tra trạng thái Provider Outage
   */
  public getProviderOutageStatus(now: number = Date.now()): { isOutage: boolean; remainingMs: number } {
    if (this.providerOutageUntilMs > now) {
      return {
        isOutage: true,
        remainingMs: this.providerOutageUntilMs - now,
      };
    }
    return { isOutage: false, remainingMs: 0 };
  }

  /**
   * Lấy danh sách các Quota Group đang trong thời gian Cooldown
   */
  public getActiveGroupCooldowns(now: number = Date.now()): Record<string, number> {
    const active: Record<string, number> = {};
    for (const group of this.groupsMap.values()) {
      if (group.cooldownUntilMs > now) {
        active[group.id] = group.cooldownUntilMs - now;
      }
    }
    return active;
  }

  /**
   * Tính toán khoảng cách an toàn (Pacing Interval in ms) cho Quota Group hoặc Model
   */
  public computeGroupInterval(rpm?: number, modelName?: string): number {
    let baseRpm = rpm;
    if (!baseRpm || baseRpm <= 0) {
      const isPro = modelName ? modelName.toLowerCase().includes('pro') : false;
      const isFlashLite = modelName ? modelName.toLowerCase().includes('flash-lite') : false;
      const isGemma = modelName ? modelName.toLowerCase().includes('gemma') : false;
      if (isPro) return 6000;
      if (isFlashLite) return 3500;
      if (isGemma) return 2000;
      return 4445;
    }
    const safePacingRpm = baseRpm * 0.9;
    const intervalMs = Math.ceil(60000 / safePacingRpm);
    return Math.max(PACING_SAFETY_FLOOR_SERVER_MS, intervalMs);
  }

  /**
   * Suy diễn gợi ý điều phối SchedulingHint dựa trên thứ tự ưu tiên:
   * 1. Configured RPM (người dùng tự đặt)
   * 2. Provider Quota RPM (đã xác minh chính thức)
   * 3. Model Fallback Tier (mặc định theo loại mô hình)
   * 4. Safe Default Floor (sàn an toàn 400ms)
   */
  public deriveSchedulingHint(
    configuredLimits?: ConfiguredQuota,
    providerQuota?: ProviderQuota,
    modelName?: string,
    safetyFloorMs: number = PACING_SAFETY_FLOOR_SERVER_MS
  ): GroupSchedulingHint {
    if (typeof configuredLimits?.configuredRpm === 'number' && configuredLimits.configuredRpm > 0) {
      const effectiveIntervalMs = Math.max(safetyFloorMs, Math.ceil(60000 / (configuredLimits.configuredRpm * 0.9)));
      return {
        effectiveIntervalMs,
        safetyFloorMs,
        isCustom: true,
        estimatedThroughputRpm: configuredLimits.configuredRpm * 0.9,
        source: 'configured',
        pacingIntervalMs: effectiveIntervalMs,
      };
    }

    if (typeof providerQuota?.rpm === 'number' && providerQuota.rpm > 0) {
      const effectiveIntervalMs = Math.max(safetyFloorMs, Math.ceil(60000 / (providerQuota.rpm * 0.9)));
      return {
        effectiveIntervalMs,
        safetyFloorMs,
        isCustom: false,
        estimatedThroughputRpm: providerQuota.rpm * 0.9,
        source: 'provider',
        pacingIntervalMs: effectiveIntervalMs,
      };
    }

    const norm = (modelName || '').replace(/^models\//i, '').trim().toLowerCase();
    let fallbackInterval = 4445;
    let fallbackRpm = 13.5;
    if (norm.includes('pro')) {
      fallbackInterval = 6000;
      fallbackRpm = 9;
    } else if (norm.includes('flash-lite')) {
      fallbackInterval = 3500;
      fallbackRpm = 15.3;
    } else if (norm.includes('gemma')) {
      fallbackInterval = 2000;
      fallbackRpm = 27;
    }

    const finalInterval = Math.max(safetyFloorMs, fallbackInterval);
    return {
      effectiveIntervalMs: finalInterval,
      safetyFloorMs,
      isCustom: false,
      estimatedThroughputRpm: fallbackRpm,
      source: 'model-fallback',
      pacingIntervalMs: finalInterval,
    };
  }

  /**
   * Đăng ký hoặc cập nhật một QuotaGroup
   * Khi chưa có dữ liệu xác minh từ Google, providerQuota PHẢI là undefined (không dùng fake defaults)
   */
  public registerQuotaGroup(input: QuotaGroupConfigInput): QuotaGroup {
    const id = input.id || (input.projectId ? `group_${input.projectId}` : `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const keyIds = (input.keyIds || []).map((k: string) => k.trim()).filter(Boolean);

    let group = this.groupsMap.get(id);
    if (!group) {
      const configuredLimits: ConfiguredQuota = {
        configuredRpm: input.configuredRpm,
        configuredTpm: input.configuredTpm,
        configuredRpd: input.configuredRpd,
      };
      const providerQuota: ProviderQuota | undefined = input.providerQuota ? {
        ...input.providerQuota,
        source: 'provider',
      } : undefined;

      group = {
        id,
        projectId: input.projectId,
        name: input.name || (input.projectId ? `Project ${input.projectId}` : `Quota Group ${id}`),
        keyIds,
        configuredLimits,
        providerQuota,
        observedUsage: {
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          tokensTotal: 0,
          tokensToday: 0,
          tokensThisMinute: 0,
          errorsTotal: 0,
          errorsToday: 0,
          lastRequestTimestamp: 0,
        },
        schedulingHint: this.deriveSchedulingHint(configuredLimits, providerQuota),
        healthState: 'Available',
        cooldownUntilMs: 0,
        nextAllowedTimeMs: 0,
        callLog: [],
      };
      this.groupsMap.set(id, group);
      this.groupPstResetDay.set(id, getDayInLosAngeles());
    } else {
      group.keyIds = Array.from(new Set([...group.keyIds, ...keyIds]));
      if (input.name) group.name = input.name;
      if (input.projectId) group.projectId = input.projectId;
      if (input.configuredRpm !== undefined) group.configuredLimits.configuredRpm = input.configuredRpm;
      if (input.configuredTpm !== undefined) group.configuredLimits.configuredTpm = input.configuredTpm;
      if (input.configuredRpd !== undefined) group.configuredLimits.configuredRpd = input.configuredRpd;
      if (input.providerQuota !== undefined) {
        group.providerQuota = {
          ...input.providerQuota,
          source: 'provider',
        };
      }
      group.schedulingHint = this.deriveSchedulingHint(group.configuredLimits, group.providerQuota);
    }

    for (const key of keyIds) {
      const keyHash = hashApiKey(key);
      this.keyToGroupId.set(keyHash, id);
      this.keyToGroupId.set(key, id);
      this.getOrCreateStats(key);
    }

    return group;
  }

  /**
   * Cập nhật thông tin hạn mức nhà cung cấp khi xác minh thành công.
   * KHÔNG được phép ghi đè configuredLimits của người dùng.
   */
  public updateProviderQuota(
    groupId: string,
    quota: Partial<ProviderQuota>,
    now: number = Date.now()
  ): QuotaGroup | null {
    const group = this.groupsMap.get(groupId);
    if (!group) return null;

    group.providerQuota = {
      ...group.providerQuota,
      ...quota,
      verifiedAt: quota.verifiedAt || now,
      source: 'provider',
    };

    group.schedulingHint = this.deriveSchedulingHint(group.configuredLimits, group.providerQuota);
    return group;
  }

  /**
   * Đảm bảo một API key luôn được gán vào 1 QuotaGroup (Backward compatibility)
   */
  public ensureKeyGroup(key: string, customGroupId?: string, customRpm?: number): QuotaGroup {
    if (!key || !key.trim()) {
      return this.registerQuotaGroup({ id: 'group_default', keyIds: [] });
    }
    const trimmed = key.trim();
    const keyHash = hashApiKey(trimmed);
    const existingGroupId = this.keyToGroupId.get(keyHash) || this.keyToGroupId.get(trimmed);
    if (existingGroupId && this.groupsMap.has(existingGroupId)) {
      const grp = this.groupsMap.get(existingGroupId)!;
      if (customRpm && !grp.configuredLimits.configuredRpm) {
        grp.configuredLimits.configuredRpm = customRpm;
        grp.schedulingHint.effectiveIntervalMs = this.computeGroupInterval(customRpm);
        grp.schedulingHint.isCustom = true;
      }
      return grp;
    }

    const targetGroupId = customGroupId || (customRpm ? `group_custom_${customRpm}` : `group_${keyHash.slice(0, 10)}`);
    return this.registerQuotaGroup({
      id: targetGroupId,
      configuredRpm: customRpm,
      keyIds: [trimmed],
    });
  }

  public getQuotaGroup(groupId: string): QuotaGroup | undefined {
    return this.groupsMap.get(groupId);
  }

  public getAllQuotaGroups(): QuotaGroup[] {
    return Array.from(this.groupsMap.values());
  }

  public getGroupIdForKey(key: string): string | undefined {
    if (!key) return undefined;
    const trimmed = key.trim();
    return this.keyToGroupId.get(hashApiKey(trimmed)) || this.keyToGroupId.get(trimmed);
  }

  /**
   * Đánh giá và chấm điểm danh sách Quota Group cho request dự kiến
   */
  public evaluateQuotaGroups(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now()
  ): GroupScoreResult[] {
    const isPro = modelName.toLowerCase().includes('pro');
    const currentDay = getDayInLosAngeles(now);

    // Thu thập tất cả các groups liên quan tới candidateKeys
    const relevantGroupIds = new Set<string>();
    for (const key of candidateKeys) {
      const grp = this.ensureKeyGroup(key);
      relevantGroupIds.add(grp.id);
    }

    const results: GroupScoreResult[] = [];

    for (const groupId of relevantGroupIds) {
      const group = this.groupsMap.get(groupId);
      if (!group) continue;

      // 1. Quota Recovery: Reset ngày theo giờ PST
      const lastReset = this.groupPstResetDay.get(groupId) || currentDay;
      if (lastReset !== currentDay) {
        group.observedUsage.requestsToday = 0;
        group.observedUsage.tokensToday = 0;
        group.observedUsage.errorsToday = 0;
        this.groupPstResetDay.set(groupId, currentDay);
        if (group.healthState === 'Exhausted') {
          group.healthState = 'Available';
        }
      }

      // 2. Phục hồi Cooldown TTL của Group
      if (group.cooldownUntilMs > 0 && now >= group.cooldownUntilMs) {
        group.cooldownUntilMs = 0;
        if (group.healthState === 'InCooldown' || group.healthState === 'RateLimited') {
          group.healthState = 'Available';
        }
      }

      // 3. Tính toán Sliding Window 60s của Group
      const minuteThreshold = now - 60000;
      if (!group.callLog) group.callLog = [];
      group.callLog = group.callLog.filter((c: { timestamp: number; tokens: number }) => c.timestamp > minuteThreshold);
      const requestsThisMinute = group.callLog.length;
      const currentTokensThisMinute = group.callLog.reduce((sum: number, c: { timestamp: number; tokens: number }) => sum + c.tokens, 0);

      group.observedUsage.requestsThisMinute = requestsThisMinute;
      group.observedUsage.tokensThisMinute = currentTokensThisMinute;

      const effectiveRpm = group.configuredLimits.configuredRpm || group.providerQuota?.rpm || (isPro ? 10 : 15);
      const effectiveTpm = group.configuredLimits.configuredTpm || group.providerQuota?.tpm || 1000000;
      const effectiveRpd = group.configuredLimits.configuredRpd || group.providerQuota?.rpd || (isPro ? 1000 : 1500);

      // 4. Kiểm tra sức khỏe của các keys trong group
      const memberKeys = group.keyIds.filter((k: string) => {
        const candidateSet = new Set(candidateKeys.map((ck: string) => ck.trim()));
        return candidateSet.has(k) || candidateSet.has(hashApiKey(k));
      });

      const hasHealthyKey = (memberKeys.length > 0 ? memberKeys : group.keyIds).some((k: string) => {
        const h = this.getKeyHealth(k, now);
        return h.isAvailable;
      });

      let isEligible = true;
      let rejectReason: string | undefined;

      if (group.healthState === 'Disabled') {
        isEligible = false;
        rejectReason = 'Group đã bị vô hiệu hóa';
      } else if (group.cooldownUntilMs > now) {
        isEligible = false;
        rejectReason = `Group đang trong trạng thái Cooldown (${group.cooldownUntilMs - now}ms)`;
      } else if (!hasHealthyKey) {
        isEligible = false;
        rejectReason = 'Group không có API key nào đang khả dụng (Healthy/Cooldown)';
      } else if (requestsThisMinute >= effectiveRpm) {
        isEligible = false;
        rejectReason = `Group đã đạt giới hạn RPM (${requestsThisMinute}/${effectiveRpm} RPM)`;
      } else if (currentTokensThisMinute + estimatedTokens > effectiveTpm * 0.95) {
        isEligible = false;
        rejectReason = `Group dự kiến vượt hạn mức TPM (${currentTokensThisMinute + estimatedTokens}/${effectiveTpm} TPM)`;
      } else if (group.observedUsage.requestsToday >= effectiveRpd) {
        isEligible = false;
        rejectReason = `Group đã đạt giới hạn RPD trong ngày (${group.observedUsage.requestsToday}/${effectiveRpd} RPD)`;
      }

      // 5. Composite Group Scoring
      const rpmCapacityScore = Math.max(0, ((effectiveRpm - requestsThisMinute) / effectiveRpm) * 500);
      const tpmCapacityScore = Math.max(0, ((effectiveTpm - currentTokensThisMinute) / effectiveTpm) * 500);
      const idleSeconds = group.observedUsage.lastRequestTimestamp ? Math.min(600, Math.floor((now - group.observedUsage.lastRequestTimestamp) / 1000)) : 600;
      const idleTimeScore = idleSeconds;

      const pacingDelay = Math.max(0, group.nextAllowedTimeMs - now);
      const pacingReadinessBonus = pacingDelay <= 0 ? 300 : Math.max(-200, 200 - Math.floor(pacingDelay / 10));
      const errorPenalty = group.observedUsage.errorsToday * 50;

      const totalScore = isEligible
        ? Math.round((rpmCapacityScore + tpmCapacityScore + idleTimeScore + pacingReadinessBonus - errorPenalty) * 10) / 10
        : -1000;

      results.push({
        group,
        isEligible,
        rejectReason,
        score: totalScore,
        scoreBreakdown: {
          rpmCapacityScore: Math.round(rpmCapacityScore),
          tpmCapacityScore: Math.round(tpmCapacityScore),
          idleTimeScore,
          pacingReadinessBonus: Math.round(pacingReadinessBonus),
          errorPenalty,
        },
      });
    }

    // Sắp xếp: Ưu tiên group eligible và điểm cao nhất
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Chọn API Key tối ưu nhất trong một Quota Group
   */
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
    const group = this.groupsMap.get(groupId);
    if (!group) return null;

    let memberKeys = group.keyIds;
    if (candidateRawKeys && candidateRawKeys.length > 0) {
      const candidateSet = new Set(candidateRawKeys.map((k: string) => k.trim()));
      const filtered = memberKeys.filter((k: string) => candidateSet.has(k) || candidateSet.has(hashApiKey(k)));
      if (filtered.length > 0) memberKeys = filtered;
    }

    const scoredCandidates: Array<{ key: string; keyHash: string; score: number; pacingDelayMs: number }> = [];

    for (const rawKey of memberKeys) {
      const keyHash = hashApiKey(rawKey);
      const health = this.getKeyHealth(rawKey, now);
      if (!health.isAvailable) {
        continue;
      }

      const stats = this.getOrCreateStats(rawKey, now);
      const healthBonus = health.state === 'Healthy' ? 200 : 100;
      const idleSeconds = stats.lastRequestTimestamp ? Math.min(600, Math.floor((now - stats.lastRequestTimestamp) / 1000)) : 600;
      const errorPenalty = stats.consecutiveErrors * 200;

      const score = healthBonus + idleSeconds - errorPenalty;
      scoredCandidates.push({
        key: rawKey,
        keyHash,
        score,
        pacingDelayMs: 0,
      });
    }

    if (scoredCandidates.length === 0) return null;
    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates[0];
  }

  /**
   * Cơ quan điều phối duy nhất (Single Scheduler Authority) cấp phép thực thi attempt:
   * - Đánh giá eligibility của các QuotaGroup liên quan
   * - Chọn group tối ưu và key khả dụng trong group
   * - Tính toán pacing delay và đặt chỗ thời gian an toàn một cách nguyên tử
   * - Cập nhật viễn trắc hàng đợi
   */
  public scheduleAttempt(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now()
  ): ScheduleLease {
    const leaseId = `lease_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Kiểm tra sự cố diện rộng toàn nhà cung cấp (Provider-Wide Outage)
    const providerOutage = this.getProviderOutageStatus(now);
    if (providerOutage.isOutage) {
      this.recordKeyRejection('provider_outage');
      return {
        leaseId,
        isEligible: false,
        delayMs: providerOutage.remainingMs,
        effectiveIntervalMs: 4445,
        rejectReason: 'Toàn bộ hạ tầng Google AI đang tạm thời gián đoạn diện rộng (Provider Outage).',
        earliestAvailableInMs: providerOutage.remainingMs,
      };
    }

    // 2. Kiểm tra Cooldown theo từng mô hình cụ thể (Model-Specific Cooldown)
    const modelCooldown = this.getModelCooldownStatus(modelName, now);
    if (modelCooldown.inCooldown) {
      this.recordKeyRejection('model_overloaded');
      return {
        leaseId,
        isEligible: false,
        delayMs: modelCooldown.remainingMs,
        effectiveIntervalMs: 4445,
        rejectReason: `Mô hình ${modelName} hiện đang quá tải phía Google (${modelCooldown.reason || '503 Cooldown'}).`,
        earliestAvailableInMs: modelCooldown.remainingMs,
      };
    }

    const evaluatedGroups = this.evaluateQuotaGroups(candidateKeys, modelName, estimatedTokens, now);

    if (evaluatedGroups.length === 0) {
      return {
        leaseId,
        isEligible: false,
        delayMs: 0,
        effectiveIntervalMs: 4445,
        rejectReason: 'Không tìm thấy QuotaGroup nào tương ứng với danh sách khóa API.',
        earliestAvailableInMs: 0,
      };
    }

    const bestGroupResult = evaluatedGroups[0];
    if (!bestGroupResult.isEligible || !bestGroupResult.group) {
      // Tính thời gian chờ tối thiểu đến khi có nhóm khả dụng
      let earliestCooldownMs = Infinity;
      for (const res of evaluatedGroups) {
        if (res.group) {
          if (res.group.cooldownUntilMs > now) {
            earliestCooldownMs = Math.min(earliestCooldownMs, res.group.cooldownUntilMs - now);
          }
          // Kiểm tra key cooldown
          for (const k of res.group.keyIds) {
            const h = this.getKeyHealth(k, now);
            if (h.cooldownRemainingMs > 0) {
              earliestCooldownMs = Math.min(earliestCooldownMs, h.cooldownRemainingMs);
            }
          }
        }
      }
      const delayMs = earliestCooldownMs !== Infinity ? earliestCooldownMs : 3000;

      return {
        leaseId,
        isEligible: false,
        delayMs,
        effectiveIntervalMs: 4445,
        rejectReason: bestGroupResult.rejectReason || 'Toàn bộ các nhóm hạn ngạch hiện không khả dụng.',
        earliestAvailableInMs: delayMs,
      };
    }

    const group = bestGroupResult.group;
    const bestKeyResult = this.selectBestKeyInGroup(group.id, candidateKeys, now);

    if (!bestKeyResult) {
      return {
        leaseId,
        isEligible: false,
        delayMs: 3000,
        effectiveIntervalMs: group.schedulingHint.effectiveIntervalMs,
        rejectReason: `Group ${group.name || group.id} không có API key nào đang khả dụng (Healthy/Cooldown).`,
        earliestAvailableInMs: 3000,
      };
    }

    // Tính toán Pacing Delay và đặt chỗ NextAllowedTime nguyên tử
    const interval = group.schedulingHint.effectiveIntervalMs;
    let groupDelay = 0;

    if (now < group.nextAllowedTimeMs) {
      groupDelay = group.nextAllowedTimeMs - now;
      group.nextAllowedTimeMs = group.nextAllowedTimeMs + interval;
    } else {
      group.nextAllowedTimeMs = now + interval;
    }

    this.recordQueueWait(groupDelay);

    return {
      leaseId,
      isEligible: true,
      selectedGroupId: group.id,
      selectedKey: bestKeyResult.key,
      delayMs: groupDelay,
      effectiveIntervalMs: interval,
    };
  }

  /**
   * Kích hoạt Cooldown cho toàn bộ Quota Group khi gặp lỗi 429 quota exhaustion
   */
  public triggerGroupCooldown(
    groupId: string,
    durationMs: number = 5000,
    reason?: string,
    now: number = Date.now()
  ): void {
    const group = this.groupsMap.get(groupId);
    if (!group) return;
    group.cooldownUntilMs = now + durationMs;
    group.healthState = 'InCooldown';
  }

  /**
   * Ghi nhận sử dụng ở cấp độ QuotaGroup và Key
   */
  public recordGroupUsage(
    groupId: string,
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp: number = Date.now(),
    tokenStats?: TokenStats,
    latencyMs?: number
  ): void {
    let group = this.groupsMap.get(groupId);
    if (!group) {
      group = this.ensureKeyGroup(key, groupId);
    }

    const currentDay = getDayInLosAngeles(timestamp);
    if (!group.callLog) group.callLog = [];
    const tokens = tokenStats?.totalTokens || 0;

    const lastReset = this.groupPstResetDay.get(group.id) || currentDay;
    if (lastReset !== currentDay) {
      group.observedUsage.requestsToday = 0;
      group.observedUsage.tokensToday = 0;
      group.observedUsage.errorsToday = 0;
      this.groupPstResetDay.set(group.id, currentDay);
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
   * Ghi nhận 1 lượt sử dụng API key và model tương ứng
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
        this.triggerModelCooldown(modelName, (error.retryAfterSec || 3) * 1000, '503 Model Overloaded', timestamp);
        {
          const grpId = this.getGroupIdForKey(key);
          if (grpId) this.recordUpstreamFailureEvent(modelName, grpId, timestamp);
        }
        break;

      case AIErrorCode.NETWORK_ERROR:
        stats.healthState = 'Cooldown';
        stats.transitionReason = '502: Lỗi kết nối mạng tới dịch vụ AI';
        stats.lastTransitionAt = timestamp;
        stats.cooldownUntil = timestamp + (error.retryAfterSec ? error.retryAfterSec * 1000 : 3000);
        {
          const grpId = this.getGroupIdForKey(key);
          if (grpId) this.recordUpstreamFailureEvent(modelName, grpId, timestamp);
        }
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

  public getSchedulerTelemetry(now: number = Date.now()): SchedulerTelemetry {
    const count = Math.max(1, this.schedulerStats.selectionCount || this.logicalStats.logicalRequestsTotal || 1);
    const avg = this.schedulerStats.queueWaitTotalMs > 0
      ? Math.round((this.schedulerStats.queueWaitTotalMs / count) * 100) / 100
      : 0;
    return {
      ...this.schedulerStats,
      queueWaitAvgMs: avg,
      rejectedByReason: { ...this.schedulerStats.rejectedByReason },
      activeModelCooldowns: this.getActiveModelCooldowns(now),
      activeGroupCooldowns: this.getActiveGroupCooldowns(now),
      isProviderOutage: this.getProviderOutageStatus(now).isOutage,
    };
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
    return { ...this.logicalStats };
  }

  public resetAll(): void {
    this.groupsMap.clear();
    this.keyToGroupId.clear();
    this.keyStatsMap.clear();
    this.groupPstResetDay.clear();
    this.modelLogicalStatsMap.clear();
    this.modelCooldownsMap.clear();
    this.providerOutageUntilMs = 0;
    this.recentProviderFailures = [];
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
