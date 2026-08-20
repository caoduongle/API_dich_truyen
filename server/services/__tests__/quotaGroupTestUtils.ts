import {
  QuotaGroup,
  ApiKeyEntity,
  ProviderQuota,
  ConfiguredQuota,
  GroupObservedUsage,
  GroupSchedulingHint,
  GroupHealthState,
  KeyHealthState,
} from '../../../shared/models';

export function createMockProviderQuota(overrides?: Partial<ProviderQuota>): ProviderQuota {
  return {
    rpm: 60,
    tpm: 1000000,
    rpd: 1500,
    verifiedAt: Date.now(),
    source: 'provider',
    ...overrides,
  };
}

export function createMockConfiguredQuota(overrides?: Partial<ConfiguredQuota>): ConfiguredQuota {
  return {
    configuredRpm: undefined,
    configuredTpm: undefined,
    configuredRpd: undefined,
    ...overrides,
  };
}

export function createMockGroupObservedUsage(overrides?: Partial<GroupObservedUsage>): GroupObservedUsage {
  return {
    requestsTotal: 0,
    requestsToday: 0,
    requestsThisMinute: 0,
    tokensTotal: 0,
    tokensToday: 0,
    tokensThisMinute: 0,
    errorsTotal: 0,
    errorsToday: 0,
    lastRequestTimestamp: 0,
    ...overrides,
  };
}

export function createMockGroupSchedulingHint(overrides?: Partial<GroupSchedulingHint>): GroupSchedulingHint {
  return {
    effectiveIntervalMs: 4445,
    safetyFloorMs: 400,
    isCustom: false,
    estimatedThroughputRpm: 13.5,
    source: 'model-fallback',
    ...overrides,
  };
}

export function createMockQuotaGroup(
  id: string,
  keyIds: string[],
  overrides?: Partial<QuotaGroup>
): QuotaGroup {
  return {
    id,
    projectId: id.replace('group_', ''),
    name: `Project ${id}`,
    keyIds,
    configuredLimits: createMockConfiguredQuota(overrides?.configuredLimits),
    providerQuota: overrides?.providerQuota,
    observedUsage: createMockGroupObservedUsage(overrides?.observedUsage),
    schedulingHint: createMockGroupSchedulingHint(overrides?.schedulingHint),
    healthState: 'Available',
    cooldownUntilMs: 0,
    nextAllowedTimeMs: 0,
    callLog: [],
    ...overrides,
  };
}

export function createMockApiKeyEntity(
  id: string,
  groupId: string,
  overrides?: Partial<ApiKeyEntity>
): ApiKeyEntity {
  return {
    id,
    groupId,
    maskedKey: `AIza...${id.slice(-4)}`,
    healthState: 'Healthy',
    circuitBreaker: 'Closed',
    circuitBreakerFailures: 0,
    cooldownUntilMs: 0,
    lastUsedAtMs: 0,
    observedAttempts: {
      keyAttempts: 0,
      keyFailures: 0,
      keyCooldowns: 0,
      attemptsTotal: 0,
      attemptsToday: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      consecutiveFailures: 0,
    },
    ...overrides,
  };
}
