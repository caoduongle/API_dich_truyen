import { AIErrorCode, AIErrorNormalized, AIRecommendedAction } from '../constants/errors';
import { redactApiKey } from './text';

/**
 * Phân loại và chuẩn hóa lỗi từ upstream (Google Gemini API, Network, Client, Timeout)
 * thành cấu trúc AIErrorNormalized chuẩn mực theo mô hình Normalize-First.
 */
export function normalizeUpstreamError(
  err: unknown,
  redactKeys: string[] = []
): AIErrorNormalized {
  if (!err) {
    return {
      code: AIErrorCode.UNKNOWN,
      message: 'Đã xảy ra lỗi không xác định từ máy chủ AI.',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 500,
    };
  }

  const anyErr = err as any;
  const rawMsg = String(anyErr?.message || anyErr || '');
  const cleanMsg = redactApiKey(rawMsg, redactKeys);
  const lowerMsg = cleanMsg.toLowerCase();
  
  // Trích xuất mã trạng thái từ các thuộc tính cấu trúc (structural extraction)
  const status = Number(
    anyErr?.status ||
    anyErr?.statusCode ||
    anyErr?.response?.status ||
    anyErr?.error?.code ||
    0
  );

  const grpcStatus = String(anyErr?.error?.status || anyErr?.statusText || '').toUpperCase();
  const sysCode = String(anyErr?.code || '').toUpperCase();

  // 1. Kiểm tra lỗi Safety Filter / Nội dung bị chặn
  if (
    anyErr?.isSafety === true ||
    anyErr?.name === 'SafetyFilterError' ||
    anyErr?.finishReason === 'SAFETY' ||
    anyErr?.finishReason === 'RECITATION' ||
    anyErr?.finishReason === 'BLOCKLIST' ||
    anyErr?.finishReason === 'PROHIBITED_CONTENT' ||
    anyErr?.finishReason === 'SPII' ||
    lowerMsg.includes('safety') ||
    lowerMsg.includes('safetyfiltererror') ||
    lowerMsg.includes('finishreason') ||
    lowerMsg.includes('blockreason') ||
    lowerMsg.includes('prohibited') ||
    lowerMsg.includes('recitation') ||
    lowerMsg.includes('trống') ||
    lowerMsg.includes('bộ lọc') ||
    lowerMsg.includes('empty') ||
    lowerMsg.includes('untranslated_chinese_leftover') ||
    lowerMsg.includes('tỉ lệ chữ hán') ||
    lowerMsg.includes('tỷ lệ chữ hán') ||
    lowerMsg.includes('chưa dịch')
  ) {
    return {
      code: AIErrorCode.SAFETY_BLOCKED,
      message: cleanMsg || 'Nội dung bị chặn bởi bộ lọc an toàn của mô hình AI.',
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 400,
      details: {
        finishReason: anyErr?.finishReason,
        blockReason: anyErr?.blockReason || anyErr?.promptFeedback?.blockReason,
      },
    };
  }

  // 2. Kiểm tra lỗi xác thực Auth (401, 403, API_KEY_INVALID, PERMISSION_DENIED)
  if (
    status === 401 ||
    status === 403 ||
    grpcStatus === 'UNAUTHENTICATED' ||
    grpcStatus === 'PERMISSION_DENIED' ||
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthenticated')
  ) {
    return {
      code: AIErrorCode.AUTH_FAILED,
      message: 'API key không hợp lệ hoặc không có quyền truy cập.',
      isRetryable: false,
      recommendedAction: 'disable_key',
      httpStatus: 401,
    };
  }

  // 3. Kiểm tra Model không hỗ trợ phương thức sinh văn bản (MODEL_UNSUPPORTED)
  if (
    lowerMsg.includes('unsupported method') ||
    lowerMsg.includes('generatecontent') && (lowerMsg.includes('not support') || lowerMsg.includes('not found')) ||
    lowerMsg.includes('method not allowed') ||
    lowerMsg.includes('not supported for this model')
  ) {
    return {
      code: AIErrorCode.MODEL_UNSUPPORTED,
      message: `Mô hình AI không hỗ trợ phương thức dịch thuật yêu cầu: ${cleanMsg}`,
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 400,
    };
  }

  // 4. Kiểm tra Model không tìm thấy hoặc đã ngừng hỗ trợ (404, NOT_FOUND)
  if (
    status === 404 ||
    grpcStatus === 'NOT_FOUND' ||
    lowerMsg.includes('not found') ||
    lowerMsg.includes('is not found for api version') ||
    lowerMsg.includes('model not found')
  ) {
    return {
      code: AIErrorCode.MODEL_NOT_FOUND,
      message: `Mô hình AI được yêu cầu không tồn tại hoặc đã ngừng hỗ trợ: ${cleanMsg}`,
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 404,
    };
  }

  // 5. Kiểm tra Quá tải / Service Unavailable (503, UNAVAILABLE, OVERLOADED)
  if (
    status === 503 ||
    grpcStatus === 'UNAVAILABLE' ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('high demand')
  ) {
    return {
      code: AIErrorCode.OVERLOADED,
      message: 'Mô hình AI của Google hiện đang quá tải. Đang tự động thử lại...',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 503,
      retryAfterSec: 3,
    };
  }

  // 6. Kiểm tra Rate Limit & Quota (429, RESOURCE_EXHAUSTED, quota, rpd, limit)
  if (
    status === 429 ||
    grpcStatus === 'RESOURCE_EXHAUSTED' ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    (lowerMsg.includes('exhausted') && !lowerMsg.includes('all_keys_exhausted')) ||
    lowerMsg.includes('rpd') ||
    lowerMsg.includes('daily request limit')
  ) {
    const isDailyExhausted = lowerMsg.includes('daily') || lowerMsg.includes('per day') || lowerMsg.includes('rpd');

    return {
      code: isDailyExhausted ? AIErrorCode.QUOTA_EXCEEDED : AIErrorCode.RATE_LIMITED,
      message: isDailyExhausted
        ? 'Hạn mức token/request theo ngày (RPD) của API key đã cạn kiệt.'
        : 'Đã chạm giới hạn tốc độ (RPM/TPM). Vui lòng thử lại sau vài giây.',
      isRetryable: !isDailyExhausted,
      recommendedAction: isDailyExhausted ? 'rotate_key' : 'cooldown_key',
      httpStatus: 429,
      retryAfterSec: 5,
    };
  }

  // 7. Kiểm tra Timeout / Abort (504, DEADLINE_EXCEEDED, AbortError)
  if (
    status === 504 ||
    grpcStatus === 'DEADLINE_EXCEEDED' ||
    sysCode === 'ETIMEDOUT' ||
    anyErr?.name === 'AbortError' ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('etimedout')
  ) {
    return {
      code: AIErrorCode.TIMEOUT,
      message: 'Yêu cầu tới dịch vụ AI đã quá thời gian chờ (Timeout).',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 504,
    };
  }

  // 8. Kiểm tra Lỗi Mạng (502, ECONNRESET, ENOTFOUND, fetch failed)
  if (
    status === 502 ||
    sysCode === 'ECONNRESET' ||
    sysCode === 'ENOTFOUND' ||
    sysCode === 'ECONNREFUSED' ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error')
  ) {
    return {
      code: AIErrorCode.NETWORK_ERROR,
      message: 'Lỗi kết nối mạng khi gửi yêu cầu tới dịch vụ AI.',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 502,
    };
  }

  // 9. Lỗi Client Request (400 Bad Request, INVALID_ARGUMENT)
  if (
    status === 400 ||
    grpcStatus === 'INVALID_ARGUMENT' ||
    lowerMsg.includes('invalid_argument')
  ) {
    return {
      code: AIErrorCode.INVALID_REQUEST,
      message: `Yêu cầu không hợp lệ: ${cleanMsg}`,
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 400,
    };
  }

  // 10. Lỗi 500 Internal Server Error
  if (status === 500 || grpcStatus === 'INTERNAL') {
    return {
      code: AIErrorCode.SERVER_ERROR,
      message: cleanMsg || 'Lỗi xử lý nội bộ của hệ thống AI.',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 500,
    };
  }

  // 11. Fallback: Unknown
  return {
    code: AIErrorCode.UNKNOWN,
    message: cleanMsg || 'Lỗi không xác định khi giao tiếp với AI Studio.',
    isRetryable: true,
    recommendedAction: 'retry',
    httpStatus: 500,
  };
}

/**
 * Kiểm tra xem lỗi có thể tự động thử lại (retry) hay không
 */
export function isRetryableError(err: unknown): boolean {
  return normalizeUpstreamError(err).isRetryable;
}

/**
 * Kiểm tra xem lỗi có phải do quá tải dịch vụ 503 hay không
 */
export function isOverloadError(err: unknown): boolean {
  return normalizeUpstreamError(err).code === AIErrorCode.OVERLOADED;
}

/**
 * Kiểm tra xem lỗi có phải do vi phạm chính sách an toàn hoặc rỗng không
 */
export function isSafetyOrEmptyError(err: unknown): boolean {
  const norm = normalizeUpstreamError(err);
  return norm.code === AIErrorCode.SAFETY_BLOCKED;
}

/**
 * Kiểm tra xem lỗi có nên chuyển ngay sang API key tiếp theo không
 */
export function shouldRotateKey(err: unknown): boolean {
  const action = normalizeUpstreamError(err).recommendedAction;
  return action === 'rotate_key' || action === 'cooldown_key' || action === 'disable_key';
}
