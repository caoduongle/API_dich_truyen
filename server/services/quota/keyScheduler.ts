import {
  QuotaGroup,
  ScheduleLease,
} from '../../../shared/models';
import { hashApiKey, getDayInLosAngeles } from './quotaUtils';
import { KeyHealthState, CircuitBreakerStatus } from '../../../shared/models';
import { InternalKeyStats } from './quotaAccountant';

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

export class KeyScheduler {
  public evaluateQuotaGroups(
    groupsMap: Map<string, QuotaGroup>,
    groupPstResetDay: Map<string, string>,
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now(),
    ensureKeyGroup: (key: string) => QuotaGroup,
    getKeyHealth: (key: string, now: number) => { isAvailable: boolean }
  ): GroupScoreResult[] {
    const isPro = modelName.toLowerCase().includes('pro');
    const currentDay = getDayInLosAngeles(now);

    // Thu thập tất cả các groups liên quan tới candidateKeys
    const relevantGroupIds = new Set<string>();
    for (const key of candidateKeys) {
      const grp = ensureKeyGroup(key);
      relevantGroupIds.add(grp.id);
    }

    const results: GroupScoreResult[] = [];

    for (const groupId of relevantGroupIds) {
      const group = groupsMap.get(groupId);
      if (!group) continue;

      // 1. Quota Recovery: Reset ngày theo giờ PST
      const lastReset = groupPstResetDay.get(groupId) || currentDay;
      if (lastReset !== currentDay) {
        group.observedUsage.requestsToday = 0;
        group.observedUsage.tokensToday = 0;
        group.observedUsage.errorsToday = 0;
        groupPstResetDay.set(groupId, currentDay);
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
        const h = getKeyHealth(k, now);
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

  public selectBestKeyInGroup(
    groupId: string,
    groupsMap: Map<string, QuotaGroup>,
    candidateRawKeys: string[] | undefined,
    now: number = Date.now(),
    getKeyHealth: (key: string, now: number) => { isAvailable: boolean; state: KeyHealthState },
    getOrCreateStats: (key: string, now: number) => InternalKeyStats
  ): {
    key: string;
    keyHash: string;
    score: number;
    pacingDelayMs: number;
  } | null {
    const group = groupsMap.get(groupId);
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
      const health = getKeyHealth(rawKey, now);
      if (!health.isAvailable) {
        continue;
      }

      const stats = getOrCreateStats(rawKey, now);
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

  public scheduleAttempt(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens: number = 2000,
    now: number = Date.now(),
    ctx: {
      getProviderOutageStatus: (now: number) => { isOutage: boolean; remainingMs: number };
      getModelCooldownStatus: (modelName: string, now: number) => { inCooldown: boolean; remainingMs: number; reason?: string };
      recordKeyRejection: (reason: string) => void;
      recordQueueWait: (durationMs: number) => void;
      evaluateQuotaGroups: (candidateKeys: string[], modelName: string, estimatedTokens: number, now: number) => GroupScoreResult[];
      selectBestKeyInGroup: (groupId: string, candidateRawKeys?: string[], now?: number) => { key: string; keyHash: string; score: number; pacingDelayMs: number } | null;
      getKeyHealth: (key: string, now: number) => { cooldownRemainingMs: number };
    }
  ): ScheduleLease {
    const leaseId = `lease_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Kiểm tra sự cố diện rộng toàn nhà cung cấp (Provider-Wide Outage)
    const providerOutage = ctx.getProviderOutageStatus(now);
    if (providerOutage.isOutage) {
      ctx.recordKeyRejection('provider_outage');
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
    const modelCooldown = ctx.getModelCooldownStatus(modelName, now);
    if (modelCooldown.inCooldown) {
      ctx.recordKeyRejection('model_overloaded');
      return {
        leaseId,
        isEligible: false,
        delayMs: modelCooldown.remainingMs,
        effectiveIntervalMs: 4445,
        rejectReason: `Mô hình ${modelName} hiện đang quá tải phía Google (${modelCooldown.reason || '503 Cooldown'}).`,
        earliestAvailableInMs: modelCooldown.remainingMs,
      };
    }

    const evaluatedGroups = ctx.evaluateQuotaGroups(candidateKeys, modelName, estimatedTokens, now);

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
            const h = ctx.getKeyHealth(k, now);
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
    const bestKeyResult = ctx.selectBestKeyInGroup(group.id, candidateKeys, now);

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

    ctx.recordQueueWait(groupDelay);

    return {
      leaseId,
      isEligible: true,
      selectedGroupId: group.id,
      selectedKey: bestKeyResult.key,
      delayMs: groupDelay,
      effectiveIntervalMs: interval,
    };
  }
}
