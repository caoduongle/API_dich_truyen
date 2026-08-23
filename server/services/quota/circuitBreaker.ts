import { ModelCooldownRecord, QuotaGroup } from '../../../shared/models';

export class CircuitBreakerManager {
  private modelCooldownsMap = new Map<string, ModelCooldownRecord>();
  private providerOutageUntilMs: number = 0;
  private recentProviderFailures: Array<{ modelName: string; groupId: string; timestamp: number }> = [];

  public normalizeModelName(modelName: string): string {
    return (modelName || '').replace(/^models\//i, '').trim().toLowerCase();
  }

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

  public getActiveModelCooldowns(now: number = Date.now()): Record<string, number> {
    const active: Record<string, number> = {};
    for (const [model, record] of this.modelCooldownsMap.entries()) {
      if (record.cooldownUntilMs > now) {
        active[model] = record.cooldownUntilMs - now;
      }
    }
    return active;
  }

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

    if (distinctModels.size >= 2 && distinctGroups.size >= 2) {
      this.providerOutageUntilMs = Math.max(this.providerOutageUntilMs, timestamp + 5000);
      return true;
    }
    return false;
  }

  public getProviderOutageStatus(now: number = Date.now()): { isOutage: boolean; remainingMs: number } {
    if (this.providerOutageUntilMs > now) {
      return {
        isOutage: true,
        remainingMs: this.providerOutageUntilMs - now,
      };
    }
    return { isOutage: false, remainingMs: 0 };
  }

  public triggerGroupCooldown(
    group: QuotaGroup,
    durationMs: number = 5000,
    _reason?: string,
    now: number = Date.now()
  ): void {
    if (!group) return;
    group.cooldownUntilMs = now + durationMs;
    group.healthState = 'InCooldown';
  }

  public getActiveGroupCooldowns(groups: Iterable<QuotaGroup>, now: number = Date.now()): Record<string, number> {
    const active: Record<string, number> = {};
    for (const group of groups) {
      if (group.cooldownUntilMs > now) {
        active[group.id] = group.cooldownUntilMs - now;
      }
    }
    return active;
  }

  public reset(): void {
    this.modelCooldownsMap.clear();
    this.providerOutageUntilMs = 0;
    this.recentProviderFailures = [];
  }
}
