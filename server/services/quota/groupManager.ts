import {
  ConfiguredQuota,
  ProviderQuota,
  QuotaGroup,
  QuotaGroupConfigInput,
  ProjectMetadata,
  ProjectVerificationStatus,
  PACING_SAFETY_FLOOR_SERVER_MS,
  GroupSchedulingHint,
} from '../../../shared/models';
import { hashApiKey, getDayInLosAngeles } from './quotaUtils';

export function computeGroupInterval(rpm?: number, modelName?: string): number {
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

export function deriveSchedulingHint(
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

export class GroupManager {
  private groupsMap = new Map<string, QuotaGroup>();
  private keyToGroupId = new Map<string, string>();
  private groupPstResetDay = new Map<string, string>();
  private onKeyRegistered?: (key: string) => void;

  constructor(onKeyRegistered?: (key: string) => void) {
    this.onKeyRegistered = onKeyRegistered;
  }

  public registerQuotaGroup(input: QuotaGroupConfigInput): QuotaGroup {
    const id = input.id || (input.projectId ? `group_${input.projectId}` : `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const keyIds = (input.keyIds || []).map((k: string) => k.trim()).filter(Boolean);

    let projectMetadata: ProjectMetadata;
    if (input.projectMetadata) {
      projectMetadata = { ...input.projectMetadata };
    } else if (input.projectId && input.projectId.trim()) {
      projectMetadata = {
        projectId: input.projectId.trim(),
        source: 'user',
        status: 'declared',
      };
    } else {
      projectMetadata = {
        source: 'inferred',
        status: 'unknown',
      };
    }

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
        projectId: input.projectId || projectMetadata.projectId,
        projectMetadata,
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
        schedulingHint: deriveSchedulingHint(configuredLimits, providerQuota),
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
      if (input.projectMetadata) {
        group.projectMetadata = { ...input.projectMetadata };
        if (input.projectMetadata.projectId) group.projectId = input.projectMetadata.projectId;
      } else if (input.projectId) {
        group.projectId = input.projectId;
        group.projectMetadata = {
          projectId: input.projectId.trim(),
          source: 'user',
          status: 'declared',
        };
      }
      if (input.configuredRpm !== undefined) group.configuredLimits.configuredRpm = input.configuredRpm;
      if (input.configuredTpm !== undefined) group.configuredLimits.configuredTpm = input.configuredTpm;
      if (input.configuredRpd !== undefined) group.configuredLimits.configuredRpd = input.configuredRpd;
      if (input.providerQuota !== undefined) {
        group.providerQuota = {
          ...input.providerQuota,
          source: 'provider',
        };
      }
      group.schedulingHint = deriveSchedulingHint(group.configuredLimits, group.providerQuota);
    }

    for (const key of keyIds) {
      const keyHash = hashApiKey(key);
      this.keyToGroupId.set(keyHash, id);
      this.keyToGroupId.set(key, id);
      this.onKeyRegistered?.(key);
    }

    return group;
  }

  public verifyGroupProject(
    groupId: string,
    verifiedProjectId: string,
    verifiedAtMs: number = Date.now()
  ): boolean {
    if (!groupId || !verifiedProjectId) return false;
    const group = this.groupsMap.get(groupId);
    if (!group) return false;

    const cleanPrj = verifiedProjectId.trim();
    group.projectId = cleanPrj;
    group.projectMetadata = {
      projectId: cleanPrj,
      source: 'provider',
      status: 'verified',
      verifiedAtMs,
    };
    return true;
  }

  public areKeysInSameVerifiedBucket(keyA: string, keyB: string): boolean {
    if (!keyA || !keyB) return false;
    const grpAId = this.getGroupIdForKey(keyA);
    const grpBId = this.getGroupIdForKey(keyB);
    if (!grpAId || !grpBId) return false;
    if (grpAId === grpBId) return true;

    const grpA = this.groupsMap.get(grpAId);
    const grpB = this.groupsMap.get(grpBId);
    if (!grpA || !grpB) return false;

    if (
      grpA.projectMetadata?.status === 'verified' &&
      grpB.projectMetadata?.status === 'verified' &&
      grpA.projectMetadata?.projectId &&
      grpA.projectMetadata.projectId === grpB.projectMetadata?.projectId
    ) {
      return true;
    }

    return false;
  }

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

    group.schedulingHint = deriveSchedulingHint(group.configuredLimits, group.providerQuota);
    return group;
  }

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
        grp.schedulingHint.effectiveIntervalMs = computeGroupInterval(customRpm);
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

  public getPstResetDay(groupId: string): string | undefined {
    return this.groupPstResetDay.get(groupId);
  }

  public setPstResetDay(groupId: string, day: string): void {
    this.groupPstResetDay.set(groupId, day);
  }

  public reset(): void {
    this.groupsMap.clear();
    this.keyToGroupId.clear();
    this.groupPstResetDay.clear();
  }
}
