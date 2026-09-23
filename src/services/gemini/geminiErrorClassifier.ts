/**
 * Gemini API Structured Error Classifier
 * Phân loại lỗi phản hồi từ Google Gemini API dựa trên thứ tự ưu tiên cấu trúc:
 * 1. details (QuotaFailure / ErrorInfo)
 * 2. rpcStatus & httpStatus
 * 3. message fallback
 */

import { ClassifiedGeminiError, GeminiRequestError } from './types';
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

export function classifyGeminiError(
  httpStatus: number,
  responseBody?: any,
  rawError?: any
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
    // 4a. Kiểm tra cấu trúc details: QuotaFailure
    for (const d of details) {
      if (d['@type']?.includes('QuotaFailure')) {
        const violations = Array.isArray(d.violations) ? d.violations : [];
        for (const v of violations) {
          const desc = `${v.description || ''} ${v.subject || ''}`.toLowerCase();
          if (desc.includes('day') || desc.includes('daily') || desc.includes('per_day') || desc.includes('requestsperday')) {
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
        }
      }

      // 4b. Kiểm tra cấu trúc details: ErrorInfo
      if (d['@type']?.includes('ErrorInfo')) {
        const meta = d.metadata || {};
        const metaStr = `${meta.quota_limit || ''} ${meta.quota_metric || ''} ${meta.quota_location || ''}`.toLowerCase();
        if (metaStr.includes('day') || metaStr.includes('daily') || metaStr.includes('per_day') || metaStr.includes('requestsperday')) {
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
        if (metaStr.includes('minute') || metaStr.includes('per_minute') || metaStr.includes('requestsperminute') || d.reason === 'RATE_LIMIT_EXCEEDED') {
          return {
            category: 'RATE_LIMIT_RPM',
            httpStatus,
            rpcStatus,
            reason: 'ErrorInfo_RateLimitMinute',
            details,
            recommendedCooldownMs: 45_000,
            isRetryable: true,
            message,
          };
        }
      }
    }

    // 4c. Fallback sang chuỗi thông báo nếu details không có trường đặc trưng
    const lowerMsg = message.toLowerCase();
    if (
      lowerMsg.includes('quota') ||
      lowerMsg.includes('daily') ||
      lowerMsg.includes('per day') ||
      lowerMsg.includes('exhausted')
    ) {
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

    // Mặc định cho 429 khi không rõ nguyên nhân ngày là Rate Limit tốc độ tức thời (45s cooldown)
    return {
      category: 'RATE_LIMIT_RPM',
      httpStatus,
      rpcStatus,
      reason: 'Default_RateLimit',
      details,
      recommendedCooldownMs: 45_000,
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
