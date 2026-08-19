import { AIErrorCode, AIErrorNormalized } from '../constants/errors';
import { redactApiKey } from './text';

/**
 * Phân loại và chuẩn hóa lỗi từ upstream (Google Gemini API, Network, Client, Timeout)
 * thành cấu trúc AIErrorNormalized chuẩn mực.
 */
export function normalizeUpstreamError(
  err: unknown,
  redactKeys: string[] = []
): AIErrorNormalized {
  if (!err) {
    return {
      code: AIErrorCode.SERVER_ERROR,
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
  const status = anyErr?.status || anyErr?.statusCode || anyErr?.response?.status;

  // 1. Kiểm tra lỗi Safety Filter
  if (
    anyErr?.isSafety === true ||
    anyErr?.name === 'SafetyFilterError' ||
    lowerMsg.includes('safety') ||
    lowerMsg.includes('finishreason') ||
    lowerMsg.includes('blockreason') ||
    lowerMsg.includes('prohibited') ||
    lowerMsg.includes('recitation')
  ) {
    return {
      code: AIErrorCode.SAFETY_BLOCKED,
      message: cleanMsg || 'Nội dung bị chặn bởi bộ lọc an toàn của mô hình AI.',
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 400,
      details: {
        finishReason: anyErr?.finishReason,
        blockReason: anyErr?.blockReason,
      },
    };
  }

  // 2. Kiểm tra lỗi xác thực Auth (401, 403, API_KEY_INVALID)
  if (
    status === 401 ||
    status === 403 ||
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

  // 3. Kiểm tra Model không tìm thấy hoặc đã bị đóng (404, not found)
  if (
    status === 404 ||
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

  // 4. Kiểm tra Rate Limit & Quota (429, resource_exhausted, quota, rpd, limit)
  if (
    status === 429 ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('exhausted') ||
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

  // 5. Kiểm tra Quá tải / Service Unavailable (503, overloaded, high demand)
  if (
    status === 503 ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('high demand')
  ) {
    return {
      code: AIErrorCode.SERVER_ERROR,
      message: 'Mô hình AI của Google hiện đang quá tải. Đang tự động thử lại...',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 503,
      retryAfterSec: 3,
    };
  }

  // 6. Kiểm tra Timeout / Abort
  if (
    anyErr?.name === 'AbortError' ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('etimedout') ||
    status === 504
  ) {
    return {
      code: AIErrorCode.TIMEOUT,
      message: 'Yêu cầu tới dịch vụ AI đã quá thời gian chờ (Timeout).',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 504,
    };
  }

  // 7. Kiểm tra Lỗi Mạng (Network Error, ECONNRESET, ENOTFOUND, 502)
  if (
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error') ||
    status === 502
  ) {
    return {
      code: AIErrorCode.NETWORK_ERROR,
      message: 'Lỗi kết nối mạng khi gửi yêu cầu tới dịch vụ AI.',
      isRetryable: true,
      recommendedAction: 'retry',
      httpStatus: 502,
    };
  }

  // 8. Lỗi Client Request (400 Bad Request)
  if (status === 400 || lowerMsg.includes('invalid_argument')) {
    return {
      code: AIErrorCode.INVALID_REQUEST,
      message: `Yêu cầu không hợp lệ: ${cleanMsg}`,
      isRetryable: false,
      recommendedAction: 'fail_immediately',
      httpStatus: 400,
    };
  }

  // Mặc định: Server Error
  return {
    code: AIErrorCode.SERVER_ERROR,
    message: cleanMsg || 'Lỗi xử lý nội bộ của hệ thống AI.',
    isRetryable: true,
    recommendedAction: 'retry',
    httpStatus: 500,
  };
}
