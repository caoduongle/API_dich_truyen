import type { ModelDefinition } from '@shared/models';

const SESSION_TOKEN_STORAGE_KEY = 'gemini_session_token';
const AUTH_TOKEN_STORAGE_KEY = 'gemini_auth_token';

let currentSessionToken: string | null = (() => {
  try {
    return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
})();

let currentAuthToken: string | null = (() => {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
})();

let syncSessionCallback: (() => Promise<string | null>) | null = null;
let isReSyncing = false;
let pendingReSyncPromise: Promise<string | null> | null = null;

type AuthRequiredListener = () => void;
const authRequiredListeners = new Set<AuthRequiredListener>();

export function getSessionToken(): string | null {
  return currentSessionToken;
}

export function setSessionToken(token: string | null): void {
  currentSessionToken = token;
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Đăng ký lắng nghe sự kiện khi máy chủ yêu cầu xác thực mật khẩu.
 */
export function onAuthRequired(listener: AuthRequiredListener): () => void {
  authRequiredListeners.add(listener);
  return () => {
    authRequiredListeners.delete(listener);
  };
}

function notifyAuthRequired(): void {
  authRequiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[apiClient] Error in authRequired listener:', err);
    }
  });
}

/**
 * Đăng ký hàm callback đồng bộ lại session khi session bị hết hạn / server restart.
 */
export function registerSessionSyncCallback(fn: () => Promise<string | null>): void {
  syncSessionCallback = fn;
}

/**
 * Kiểm tra trạng thái xác thực của máy chủ.
 */
export async function checkAuthStatus(): Promise<{ authRequired: boolean; authenticated: boolean }> {
  try {
    const headers: Record<string, string> = {};
    if (currentAuthToken) {
      headers['X-Auth-Token'] = currentAuthToken;
    }

    const res = await fetch('/api/auth/status', {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      return { authRequired: false, authenticated: true };
    }

    const data = await res.json();
    return {
      authRequired: !!data.authRequired,
      authenticated: !!data.authenticated,
    };
  } catch (err) {
    console.error('[apiClient] Failed to check auth status:', err);
    return { authRequired: false, authenticated: true };
  }
}

/**
 * Đăng nhập máy chủ bằng mật khẩu.
 */
export async function loginWithPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Mật khẩu không chính xác hoặc lỗi đăng nhập.',
      };
    }

    if (data.authToken) {
      setAuthToken(data.authToken);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Lỗi mạng khi kết nối tới máy chủ.',
    };
  }
}

/**
 * Đăng xuất và thu hồi Auth Token.
 */
export async function logoutAuth(): Promise<void> {
  if (currentAuthToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': currentAuthToken,
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  setAuthToken(null);
}

/**
 * Đồng bộ danh sách API keys lên máy chủ để lấy Session Token bảo mật.
 */
export async function syncSessionKeysToServer(keys: string[]): Promise<string | null> {
  const cleanKeys = Array.isArray(keys)
    ? keys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
    : [];

  if (cleanKeys.length === 0) {
    if (currentSessionToken) {
      try {
        const headers: Record<string, string> = {
          'X-Session-Token': currentSessionToken,
        };
        if (currentAuthToken) {
          headers['X-Auth-Token'] = currentAuthToken;
        }
        await fetch('/api/session-keys', {
          method: 'DELETE',
          headers,
        });
      } catch {
        // Ignore deletion errors
      }
    }
    setSessionToken(null);
    return null;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentAuthToken) {
      headers['X-Auth-Token'] = currentAuthToken;
    }

    const res = await fetch('/api/session-keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ apiKeys: cleanKeys }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data?.authRequired) {
          notifyAuthRequired();
        }
      }
      console.warn('[apiClient] Failed to create session on server, HTTP:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
      return data.sessionToken;
    }
  } catch (err) {
    console.error('[apiClient] Network error syncing session keys:', err);
  }

  return null;
}

let currentCustomRpm: number | null = null;

export function setGlobalCustomRpm(rpm: number | null): void {
  currentCustomRpm = rpm && rpm > 0 ? rpm : null;
}

export function getGlobalCustomRpm(): number | null {
  return currentCustomRpm;
}

/**
 * Helper fetch bảo mật cho toàn bộ các endpoint /api/*:
 * 1. Tự động đính kèm header X-Auth-Token & X-Session-Token & X-Custom-Rpm.
 * 2. Tự động loại bỏ mảng apiKeys khỏi JSON body để tránh lộ plaintext keys qua Network tab.
 * 3. Tự động re-sync session và thử lại (retry) 1 lần trong suốt nếu server trả về 401 sessionExpired.
 * 4. Tự động thông báo yêu cầu mật khẩu nếu server trả về 401 authRequired.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { skipSessionHeader?: boolean; skipAuthHeader?: boolean }
): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isApiRoute = urlStr.startsWith('/api/') || urlStr.includes('/api/');

  let headers = new Headers(init?.headers || {});
  let body = init?.body;

  // Nếu là API route và có body dạng JSON string, loại bỏ apiKeys khỏi payload và trích xuất customRpm
  if (isApiRoute && typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      if ('apiKeys' in parsed) {
        delete parsed.apiKeys;
        body = JSON.stringify(parsed);
      }
      if (parsed.customRpm && typeof parsed.customRpm === 'number' && parsed.customRpm > 0) {
        if (!headers.has('X-Custom-Rpm')) {
          headers.set('X-Custom-Rpm', String(parsed.customRpm));
        }
      }
      if (parsed.idempotencyKey && !headers.has('Idempotency-Key')) {
        headers.set('Idempotency-Key', String(parsed.idempotencyKey));
      }
    } catch {
      // Keep original body if parsing fails
    }

  }

  // Đính kèm X-Custom-Rpm từ global store nếu header chưa có
  if (isApiRoute && !headers.has('X-Custom-Rpm') && currentCustomRpm && currentCustomRpm > 0) {
    headers.set('X-Custom-Rpm', String(currentCustomRpm));
  }

  // Đính kèm X-Auth-Token nếu có
  if (isApiRoute && !init?.skipAuthHeader && currentAuthToken) {
    if (!headers.has('X-Auth-Token')) {
      headers.set('X-Auth-Token', currentAuthToken);
    }
  }

  // Đính kèm X-Session-Token nếu có và chưa được tắt
  if (isApiRoute && !init?.skipSessionHeader && currentSessionToken) {
    if (!headers.has('X-Session-Token')) {
      headers.set('X-Session-Token', currentSessionToken);
    }
  }

  if (typeof body === 'string' && !headers.has('Content-Type') && body.trim().startsWith('{')) {
    headers.set('Content-Type', 'application/json');
  }

  const newInit: RequestInit = {
    ...init,
    headers,
    body,
  };

  const response = await fetch(input, newInit);

  // Xử lý khi gặp 401
  if (response.status === 401 && isApiRoute) {
    try {
      const clone = response.clone();
      const errData = await clone.json();

      // Trường hợp yêu cầu xác thực mật khẩu máy chủ
      if (errData?.authRequired) {
        notifyAuthRequired();
        return response;
      }

      // Trường hợp session keys hết hạn -> tự động re-sync
      if (errData?.sessionExpired && syncSessionCallback) {
        console.warn('[apiClient] Session token expired, automatically re-syncing from local keys...');

        // Đảm bảo chỉ 1 tiến trình re-sync chạy tại một thời điểm
        if (!isReSyncing) {
          isReSyncing = true;
          pendingReSyncPromise = syncSessionCallback().finally(() => {
            isReSyncing = false;
            pendingReSyncPromise = null;
          });
        }

        const newToken = await (pendingReSyncPromise || syncSessionCallback());
        if (newToken) {
          headers.set('X-Session-Token', newToken);
          return await fetch(input, {
            ...newInit,
            headers,
          });
        }
      }
    } catch {
      // If clone json fails, return original response
    }
  }

  return response;
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
  providerQuota: {
    rpm: number;
    tpm: number;
    rpd?: number;
    isVerified: boolean;
  };
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

export async function configureQuotaGroups(groups: Array<{
  id?: string;
  projectId?: string;
  name?: string;
  configuredRpm?: number;
  configuredTpm?: number;
  configuredRpd?: number;
  keyIds: string[];
}>): Promise<{ status: string; updatedGroupsCount: number }> {
  const res = await apiFetch('/api/quota-groups/configure', {
    method: 'POST',
    body: JSON.stringify({ groups }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi cấu hình nhóm hạn mức (HTTP ${res.status})`);
  }
  return res.json();
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

/**
 * Lấy snapshot trạng thái Quota & Mức sử dụng thời gian thực từ máy chủ.
 */
export async function fetchQuotaStatus(keys?: string[]): Promise<QuotaStatusResponse> {
  const payload: { apiKeys?: string[] } = {};
  if (keys && keys.length > 0) {
    payload.apiKeys = keys.filter(k => typeof k === 'string' && k.trim().length > 0);
  }

  const res = await apiFetch('/api/quota-status', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lỗi tải trạng thái Quota (HTTP ${res.status})`);
  }

  return await res.json();
}

/**
 * Kiểm tra danh sách mô hình thực tế mà một API key có quyền truy cập.
 */
export async function fetchModelsForKey(keyIndex: number, keys?: string[]): Promise<ModelsForKeyResponse> {
  const payload: { keyIndex: number; apiKeys?: string[] } = { keyIndex };
  if (keys && keys.length > 0) {
    payload.apiKeys = keys.filter(k => typeof k === 'string' && k.trim().length > 0);
  }

  const res = await apiFetch('/api/models-for-key', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lỗi tra cứu mô hình cho khóa (HTTP ${res.status})`);
  }

  return await res.json();
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
 * Xác minh tính hợp lệ và khả năng dịch thuật của 1 model với máy chủ/Google AI Studio.
 */
export async function verifyModel(modelId: string, label?: string, keys?: string[]): Promise<VerifyModelResponse> {
  const payload: { modelId: string; label?: string; apiKeys?: string[] } = { modelId, label };
  if (keys && keys.length > 0) {
    payload.apiKeys = keys.filter(k => typeof k === 'string' && k.trim().length > 0);
  }

  const res = await apiFetch('/api/verify-model', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      verified: false,
      error: data.error || `Xác minh mô hình thất bại (HTTP ${res.status})`,
      errorCode: data.errorCode || 'API_ERROR',
      checkedAt: data.checkedAt || new Date().toISOString(),
    };
  }

  return data;
}


