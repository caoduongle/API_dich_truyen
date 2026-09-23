/**
 * Shared Type Definitions for Gemini Service Modularization
 */

export type ClassifiedErrorCategory =
  | 'RATE_LIMIT_RPM'       // Giới hạn tần suất 15 RPM
  | 'QUOTA_EXHAUSTED_RPD'  // Hết hạn mức 1,500 RPD trong ngày
  | 'AUTH_FAILURE'         // Khóa không hợp lệ, 401/403
  | 'RESOURCE_NOT_FOUND'   // Mô hình hoặc tài nguyên không tồn tại, 404 (non-retryable)
  | 'SERVICE_OVERLOAD'     // 503 / 500 Gemini backend quá tải
  | 'CONTENT_BLOCKED'      // Bộ lọc an toàn (Safety Filter)
  | 'NETWORK_FAILURE'      // Mất mạng, timeout, CORS/CSP
  | 'UNRECOGNIZED';

export interface ClassifiedGeminiError {
  category: ClassifiedErrorCategory;
  httpStatus: number;
  rpcStatus?: string;
  reason?: string;
  details?: unknown[];
  recommendedCooldownMs: number;
  isRetryable: boolean;
  message: string;
}

export interface DirectGeminiRequestOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  apiKeys?: string[];
  startKeyIndex?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DirectGeminiResponse {
  text: string;
  successKeyIndex: number;
}

export type GeminiErrorCode =
  | 'CONTENT_BLOCKED'
  | 'ALL_KEYS_EXHAUSTED'
  | 'RESOURCE_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'ETIMEDOUT'
  | 'AUTH_FAILURE'
  | 'UNRECOGNIZED';

export class GeminiRequestError extends Error {
  public readonly code: GeminiErrorCode;
  public readonly category: ClassifiedErrorCategory;
  public readonly status?: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    options: {
      code: GeminiErrorCode;
      category: ClassifiedErrorCategory;
      status?: number;
      isRetryable: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'GeminiRequestError';
    this.code = options.code;
    this.category = options.category;
    this.status = options.status;
    this.isRetryable = options.isRetryable;
    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, GeminiRequestError.prototype);
  }
}
