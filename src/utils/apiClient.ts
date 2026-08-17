const SESSION_TOKEN_STORAGE_KEY = 'gemini_session_token';

let currentSessionToken: string | null = (() => {
  try {
    return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
})();

let syncSessionCallback: (() => Promise<string | null>) | null = null;
let isReSyncing = false;
let pendingReSyncPromise: Promise<string | null> | null = null;

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

/**
 * Đăng ký hàm callback đồng bộ lại session khi session bị hết hạn / server restart.
 */
export function registerSessionSyncCallback(fn: () => Promise<string | null>): void {
  syncSessionCallback = fn;
}

/**
 * Đồng bộ danh sách API keys lên máy chủ để lấy Session Token bảo mật.
 */
export async function syncSessionKeysToServer(keys: string[]): Promise<string | null> {
  const cleanKeys = Array.isArray(keys)
    ? keys.map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
    : [];

  if (cleanKeys.length === 0) {
    if (currentSessionToken) {
      try {
        await fetch('/api/session-keys', {
          method: 'DELETE',
          headers: {
            'X-Session-Token': currentSessionToken,
          },
        });
      } catch {
        // Ignore deletion errors
      }
    }
    setSessionToken(null);
    return null;
  }

  try {
    const res = await fetch('/api/session-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKeys: cleanKeys }),
    });

    if (!res.ok) {
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

/**
 * Helper fetch bảo mật cho toàn bộ các endpoint /api/*:
 * 1. Tự động đính kèm header X-Session-Token.
 * 2. Tự động loại bỏ mảng apiKeys khỏi JSON body để tránh lộ plaintext keys qua Network tab.
 * 3. Tự động re-sync session và thử lại (retry) 1 lần trong suốt nếu server trả về 401 sessionExpired.
 */
export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit & { skipSessionHeader?: boolean }
): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isApiRoute = urlStr.startsWith('/api/') || urlStr.includes('/api/');

  let headers = new Headers(init?.headers || {});
  let body = init?.body;

  // Nếu là API route và có body dạng JSON string, loại bỏ apiKeys khỏi payload
  if (isApiRoute && typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      if ('apiKeys' in parsed) {
        delete parsed.apiKeys;
        body = JSON.stringify(parsed);
      }
    } catch {
      // Keep original body if parsing fails
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

  // Nếu gặp lỗi 401 Session Expired và có callback sync, tự động phục hồi session và thử lại 1 lần
  if (response.status === 401 && isApiRoute && syncSessionCallback) {
    try {
      const clone = response.clone();
      const errData = await clone.json();
      if (errData?.sessionExpired) {
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
