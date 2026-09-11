import type { ModelDefinition } from '../config/models';

export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export interface CustomLimit {
  maxRpm: number;
  maxRpd: number;
  maxTpm: number;
}

export const DEFAULT_CUSTOM_LIMIT: CustomLimit = {
  maxRpm: 15,
  maxRpd: 1500,
  maxTpm: 1000000,
};

export interface KeyRuntimeStatus {
  isBlacklisted: boolean;
  blacklistRemainingMs: number;
  isRateLimited: boolean;
  nextAllowedRemainingMs: number;
  healthState?: KeyHealthState;
  transitionReason?: string;
  isCustomLimitReached?: boolean;
}

export interface ModelUsageStats {
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  errorsToday?: number;
  tokensTotal?: number;
  tokensToday?: number;
  tokensThisMinute?: number;
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

export interface QuotaGroupDisplayItem {
  id: string;
  projectId?: string;
  name?: string;
  healthState: string;
  configuredLimits: {
    configuredRpm?: number;
    configuredTpm?: number;
    configuredRpd?: number;
  };
  providerQuota?: {
    rpm?: number;
    tpm?: number;
    rpd?: number;
    verifiedAt?: number | string;
    source?: 'provider';
  } | null;
  observedUsage: {
    requestsTotal: number;
    requestsToday: number;
    requestsThisMinute: number;
    tokensTotal: number;
    tokensToday: number;
    tokensThisMinute: number;
    errorsTotal: number;
    errorsToday: number;
    lastRequestTimestamp?: number;
  };
  schedulingHint: {
    effectiveIntervalMs: number;
    safetyFloorMs: number;
    isCustom: boolean;
    estimatedThroughputRpm: number;
    source: 'provider' | 'configured' | 'model-fallback' | 'safe-default';
    pacingIntervalMs?: number;
  };
  cooldownRemainingMs: number;
  keys: KeyQuotaFullSnapshot[];
}

export interface KeyQuotaFullSnapshot {
  index?: number;
  keyHash: string;
  maskedKey: string;
  providerAttemptsTotal?: number;
  providerAttemptsToday?: number;
  providerAttemptsThisMinute?: number;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal?: number;
  tokensToday?: number;
  tokensThisMinute?: number;
  byModel: Record<string, ModelUsageStats>;
  runtime: KeyRuntimeStatus;
  healthState?: string;
  transitionReason?: string;
  isCustomLimitReached?: boolean;
  circuitBreakerState?: string;
  cooldownRemainingMs?: number;
  lastRequestTimestamp?: number;
}

export interface QuotaStatusResponse {
  timestamp: string;
  timezone: string;
  currentDayPST: string;
  summary?: LogicalSummaryStats;
  groups?: QuotaGroupDisplayItem[];
  keys: KeyQuotaFullSnapshot[];
}

export interface ModelInfoItem {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export interface ModelsForKeyResponse {
  keyHash: string;
  maskedKey: string;
  cached: boolean;
  models: ModelInfoItem[];
}

export interface VerifyModelResponse {
  success: boolean;
  verified: boolean;
  model?: ModelDefinition;
  error?: string;
  errorCode?: string;
  checkedAt: string;
}
