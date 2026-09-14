/**
 * Shared Type Definitions for Gemini Service Modularization
 */

export type ClassifiedErrorCategory =
  | 'RATE_LIMIT_RPM'       // Giới hạn tần suất 15 RPM
  | 'QUOTA_EXHAUSTED_RPD'  // Hết hạn mức 1,500 RPD trong ngày
  | 'AUTH_FAILURE'         // Khóa không hợp lệ, 401/403
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
}

export interface DirectGeminiResponse {
  text: string;
  successKeyIndex: number;
}
