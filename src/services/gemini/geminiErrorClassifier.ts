/**
 * Gemini API Structured Error Classifier
 * Phân loại lỗi phản hồi từ Google Gemini API dựa trên thứ tự ưu tiên cấu trúc:
 * 1. details (QuotaFailure / ErrorInfo)
 * 2. rpcStatus & httpStatus
 * 3. message fallback
 */

import { ClassifiedGeminiError, GeminiRequestError } from './types';
import { RATE_LIMIT_RECOVERY_CONFIG } from '../../config/constants';
export { GeminiRequestError } from './types';

export function isGeminiRequestError(err: unknown): err is GeminiRequestError {
  return err instanceof GeminiRequestError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error || '');
}

const DAILY_LIMIT_KEYWORDS_REGEX = /\b(?:day|daily|per[_\s-]?day|requestsperday|rpd)\b/i;
const MINUTE_LIMIT_KEYWORDS_REGEX =
  /\b(?:per[_\s-]?minute|requests[_\s-]?per[_\s-]?minute|tokens[_\s-]?per[_\s-]?minute|requestsperminute|tokensperminute|rpm|tpm)\b/i;

function parseDurationTokenToMs(rawToken: string): number | undefined {
  const match = rawToken.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const unit = (match[2] || 's').toLowerCase();
  if (unit === 'ms') return Math.ceil(value);
  if (unit === 'm') return Math.ceil(value * 60_000);
  return Math.ceil(value * 1000);
}

/**
 * Trích xuất thời gian chờ thử lại (ms, kèm đệm an toàn) từ RetryInfo,
 * chuỗi thông báo của Google (ví dụ "Please retry in 36.580235449s.") hoặc header Retry-After.
 */
export function extractRetryDelayMs(
  message: string,
  details?: unknown[],
  retryAfterHeader?: string | null
): number | undefined {
  let baseMs: number | undefined;

  if (Array.isArray(details)) {
    for (const detail of details as Array<Record<string, any>>) {
      if (detail && typeof detail === 'object' && typeof detail.retryDelay === 'string') {
        const parsed = parseDurationTokenToMs(detail.retryDelay);
        if (parsed !== undefined) {
          baseMs = parsed;
          break;
        }
      }
    }
  }

  if (baseMs === undefined && message) {
    const msgMatch =
      message.match(/please\s+retry\s+in\s+([\d.]+\s*(?:ms|s|m))\b/i) ||
      message.match(/retry\s+(?:in|after)\s+([\d.]+\s*(?:ms|s|m))\b/i);
    if (msgMatch?.[1]) {
      baseMs = parseDurationTokenToMs(msgMatch[1]);
    }
  }

  if (baseMs === undefined && typeof retryAfterHeader === 'string' && retryAfterHeader.trim()) {
    const trimmed = retryAfterHeader.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const secs = Number(trimmed);
      if (Number.isFinite(secs) && secs > 0) {
        baseMs = Math.ceil(secs * 1000);
      }
    } else {
      const targetTime = Date.parse(trimmed);
      if (!Number.isNaN(targetTime)) {
        const diffMs = targetTime - Date.now();
        if (diffMs > 0) {
          baseMs = Math.ceil(diffMs);
        }
      }
    }
  }

  if (baseMs === undefined || baseMs <= 0) {
    return undefined;
  }

  return Math.max(2000, baseMs + RATE_LIMIT_RECOVERY_CONFIG.RETRY_DELAY_SAFETY_BUFFER_MS);
}

export function classifyGeminiError(
  httpStatus: number,
  responseBody?: any,
  rawError?: any,
  retryAfterHeader?: string | null
): ClassifiedGeminiError {
  const errObj = responseBody?.error || responseBody || {};
  const message: string = errObj.message || rawError?.message || (httpStatus ? `HTTP ${httpStatus}` : 'Lỗi kết nối mạng');
  const rpcStatus: string = errObj.status || '';
  const details: any[] = Array.isArray(errObj.details) ? errObj.details : [];

  // 1. Kiểm tra lỗi mạng cục bộ / timeout / abort
  if (httpStatus === 0 || rawError) {
    const errName = rawError?.name || '';
    const isAbort = errName === 'AbortError';
    return {
      category: 'NETWORK_FAILURE',
      httpStatus: 0,
      rpcStatus: isAbort ? 'ABORTED' : 'NETWORK_ERROR',
      reason: isAbort ? 'RequestAborted' : 'NetworkFetchFailed',
      details,
      recommendedCooldownMs: isAbort ? 0 : 5000,
      isRetryable: !isAbort,
      message,
    };
  }

  // 2. Lỗi xác thực hoặc không có quyền (401, 403)
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    rpcStatus === 'UNAUTHENTICATED' ||
    rpcStatus === 'PERMISSION_DENIED'
  ) {
    return {
      category: 'AUTH_FAILURE',
      httpStatus,
      rpcStatus,
      reason: 'AuthFailed',
      details,
      recommendedCooldownMs: Number.MAX_SAFE_INTEGER,
      isRetryable: false,
      message,
    };
  }

  // 2b. Tài nguyên không tìm thấy / Model không tồn tại (404, NOT_FOUND)
  if (
    httpStatus === 404 ||
    rpcStatus === 'NOT_FOUND'
  ) {
    return {
      category: 'RESOURCE_NOT_FOUND',
      httpStatus,
      rpcStatus,
      reason: 'ResourceNotFound',
      details,
      recommendedCooldownMs: 0,
      isRetryable: false,
      message,
    };
  }

  // 3. Quá tải tạm thời máy chủ Google (503, 500, UNAVAILABLE)
  if (
    httpStatus === 503 ||
    httpStatus === 500 ||
    rpcStatus === 'UNAVAILABLE' ||
    rpcStatus === 'INTERNAL'
  ) {
    return {
      category: 'SERVICE_OVERLOAD',
      httpStatus,
      rpcStatus,
      reason: 'ServerOverload',
      details,
      recommendedCooldownMs: 15_000,
      isRetryable: true,
      message,
    };
  }

  // 4. Rate Limit hoặc Hết hạn ngạch ngày (429, RESOURCE_EXHAUSTED)
  if (httpStatus === 429 || rpcStatus === 'RESOURCE_EXHAUSTED') {
    const extractedRetryDelayMs = extractRetryDelayMs(message, details, retryAfterHeader);
    let hasExplicitMinuteSignal = false;

    // 4a. Kiểm tra cấu trúc details: QuotaFailure & ErrorInfo
    for (const d of details) {
      if (d['@type']?.includes('QuotaFailure')) {
        const violations = Array.isArray(d.violations) ? d.violations : [];
        for (const v of violations) {
          const desc = `${v.description || ''} ${v.subject || ''} ${v.quotaMetric || ''} ${v.quotaId || ''}`.toLowerCase();
          if (DAILY_LIMIT_KEYWORDS_REGEX.test(desc)) {
            return {
              category: 'QUOTA_EXHAUSTED_RPD',
              httpStatus,
              rpcStatus,
              reason: 'QuotaFailure_DailyLimit',
              details,
              recommendedCooldownMs: -1, // -1 đánh dấu cần tính PST midnight
              isRetryable: true,
              message,
            };
          }
          if (MINUTE_LIMIT_KEYWORDS_REGEX.test(desc)) {
            hasExplicitMinuteSignal = true;
          }
        }
      }

      // 4b. Kiểm tra cấu trúc details: ErrorInfo
      if (d['@type']?.includes('ErrorInfo')) {
        const meta = d.metadata || {};
        const metaStr = `${meta.quota_limit || ''} ${meta.quota_metric || ''} ${meta.quota_location || ''}`.toLowerCase();
        if (DAILY_LIMIT_KEYWORDS_REGEX.test(metaStr)) {
          return {
            category: 'QUOTA_EXHAUSTED_RPD',
            httpStatus,
            rpcStatus,
            reason: 'ErrorInfo_DailyLimit',
            details,
            recommendedCooldownMs: -1,
            isRetryable: true,
            message,
          };
        }
        if (MINUTE_LIMIT_KEYWORDS_REGEX.test(metaStr) || d.reason === 'RATE_LIMIT_EXCEEDED') {
          hasExplicitMinuteSignal = true;
        }
      }
    }

    // Kiểm tra tín hiệu giới hạn theo phút (RPM/TPM) trong message hoặc retryDelay ngắn không phải RPD
    const hasDailyMessageSignal = DAILY_LIMIT_KEYWORDS_REGEX.test(message);
    const hasMinuteMessageSignal =
      MINUTE_LIMIT_KEYWORDS_REGEX.test(message) ||
      (!hasDailyMessageSignal &&
        extractedRetryDelayMs !== undefined &&
        extractedRetryDelayMs <= RATE_LIMIT_RECOVERY_CONFIG.MAX_AUTO_WAIT_COOLDOWN_MS);

    if (!hasDailyMessageSignal && (hasExplicitMinuteSignal || hasMinuteMessageSignal)) {
      return {
        category: 'RATE_LIMIT_RPM',
        httpStatus,
        rpcStatus,
        reason: hasExplicitMinuteSignal ? 'ErrorInfo_RateLimitMinute' : 'RetryDelay_RateLimitMinute',
        details,
        recommendedCooldownMs: extractedRetryDelayMs ?? 45_000,
        isRetryable: true,
        message,
      };
    }

    // 4c. Phân tách thông báo 429 nêu rõ giới hạn theo ngày với lỗi 429 mơ hồ chưa ghi rõ theo ngày
    const lowerMsg = message.toLowerCase();
    if (hasDailyMessageSignal) {
      return {
        category: 'QUOTA_EXHAUSTED_RPD',
        httpStatus,
        rpcStatus,
        reason: 'MessageFallback_DailyLimit',
        details,
        recommendedCooldownMs: -1,
        isRetryable: true,
        message,
      };
    }

    if (lowerMsg.includes('quota') || lowerMsg.includes('exhausted')) {
      return {
        category: 'RATE_LIMIT_RPM',
        httpStatus,
        rpcStatus,
        reason: 'MessageFallback_AmbiguousQuota',
        details,
        recommendedCooldownMs: extractedRetryDelayMs ?? 50_000,
        isRetryable: true,
        message,
      };
    }

    // Mặc định cho 429 khi không rõ nguyên nhân ngày là Rate Limit tốc độ tức thời
    return {
      category: 'RATE_LIMIT_RPM',
      httpStatus,
      rpcStatus,
      reason: 'Default_RateLimit',
      details,
      recommendedCooldownMs: extractedRetryDelayMs ?? 45_000,
      isRetryable: true,
      message,
    };
  }

  // 5. Nội dung bị chặn bởi Safety Filter
  const blockReason: string =
    responseBody?.promptFeedback?.blockReason ||
    responseBody?.candidates?.[0]?.finishReason ||
    errObj?.blockReason ||
    '';

  if (
    blockReason === 'SAFETY' ||
    message.includes('SAFETY') ||
    message.includes('bộ lọc an toàn') ||
    message.includes('chặn bởi bộ lọc an toàn')
  ) {
    return {
      category: 'CONTENT_BLOCKED',
      httpStatus,
      rpcStatus: rpcStatus || 'SAFETY_BLOCKED',
      reason: 'SafetyBlocked',
      details,
      recommendedCooldownMs: 0,
      isRetryable: false,
      message,
    };
  }

  // 6. Lỗi chưa xác định
  return {
    category: 'UNRECOGNIZED',
    httpStatus,
    rpcStatus,
    reason: 'UnrecognizedError',
    details,
    recommendedCooldownMs: 10_000,
    isRetryable: true,
    message,
  };
}
