import type { ModelDefinition } from '@shared/models';

/**
 * Tính toán mã băm SHA-256 (dạng hex 64 ký tự thường) của chuỗi văn bản bằng Web Crypto API.
 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let currentCustomRpm: number | null = null;

export function setGlobalCustomRpm(rpm: number | null): void {
  currentCustomRpm = rpm && rpm > 0 ? rpm : null;
}

export function getGlobalCustomRpm(): number | null {
  return currentCustomRpm;
}

export interface ApiFetchOptions extends RequestInit {
  skipSessionHeader?: boolean;
  allowApiKeysInBody?: boolean;
}

/**
 * Wrapper nâng cao cho hàm fetch chuẩn của trình duyệt.
 * 1. Tự động đính kèm `X-Session-Token` từ bộ nhớ phiên.
 * 2. Tự động bóc tách `apiKeys` khỏi payload JSON trừ khi bật cờ `allowApiKeysInBody`.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<Response> {
  const isApiRoute = typeof input === 'string' && (input.startsWith('/api/') || input.includes('/api/'));

  let headers = new Headers(init?.headers || {});
  let body = init?.body;

  if (isApiRoute && typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      if ('apiKeys' in parsed && !init?.allowApiKeysInBody) {
        delete parsed.apiKeys;
        body = JSON.stringify(parsed);
      }
      if (parsed.customRpm && typeof parsed.customRpm === 'number' && parsed.customRpm > 0) {
        if (!headers.has('X-Custom-Rpm')) {
          headers.set('X-Custom-Rpm', String(parsed.customRpm));
        }
      }
    } catch {
      // Keep original body
    }
  }

  if (typeof body === 'string' && !headers.has('Content-Type') && body.trim().startsWith('{')) {
    headers.set('Content-Type', 'application/json');
  }

  const newInit: RequestInit = {
    credentials: 'same-origin',
    ...init,
    headers,
    body,
  };

  return await fetch(input, newInit);
}

// --- QUOTA & USAGE TRACKING CLIENT APIS ---

export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export interface KeyRuntimeStatus {
  isBlacklisted: boolean;
  blacklistRemainingMs: number;
  isRateLimited: boolean;
  nextAllowedRemainingMs: number;
  healthState?: KeyHealthState;
  transitionReason?: string;
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

import { listModelsDirect, verifyModelDirect } from '../services/directGeminiClient';

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

/**
 * Kiểm tra danh sách mô hình thực tế mà một API key có quyền truy cập (Client-Direct).
 */
export async function fetchModelsForKey(keyIndex: number, keys?: string[]): Promise<ModelsForKeyResponse> {
  const cleanKeys = (keys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
  const targetKey = cleanKeys[keyIndex] || cleanKeys[0];
  if (!targetKey) {
    throw new Error('Không tìm thấy API Key để tra cứu danh sách mô hình.');
  }

  const hash = await sha256Hex(targetKey);
  const models = await listModelsDirect(targetKey);

  return {
    keyHash: hash,
    maskedKey: `${targetKey.slice(0, 6)}...${targetKey.slice(-4)}`,
    cached: false,
    models,
  };
}

export interface VerifyModelResponse {
  success: boolean;
  verified: boolean;
  model?: ModelDefinition;
  error?: string;
  errorCode?: string;
  checkedAt: string;
}

/**
 * Xác minh tính hợp lệ và khả năng dịch thuật của 1 model trực tiếp với Google Gemini (Client-Direct).
 */
export async function verifyModel(modelId: string, _label?: string, keys?: string[]): Promise<VerifyModelResponse> {
  const cleanKeys = (keys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
  const targetKey = cleanKeys[0];
  if (!targetKey) {
    return {
      success: false,
      verified: false,
      error: 'Vui lòng cung cấp API key để xác minh.',
      errorCode: 'NO_KEY',
      checkedAt: new Date().toISOString(),
    };
  }

  const res = await verifyModelDirect(targetKey, modelId);
  return {
    success: res.success,
    verified: res.verified,
    error: res.error,
    errorCode: res.errorCode,
    checkedAt: res.checkedAt,
  };
}


