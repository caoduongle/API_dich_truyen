/**
 * Contract: Modular Gemini Client
 * Định nghĩa giao diện gọi API Gemini phân tách thành các thành phần chuyên biệt
 */

export type ClassifiedErrorCategory =
  | 'RATE_LIMIT_RPM'
  | 'QUOTA_EXHAUSTED_RPD'
  | 'AUTH_FAILURE'
  | 'SERVICE_OVERLOAD'
  | 'CONTENT_BLOCKED'
  | 'NETWORK_FAILURE'
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

export interface IGeminiErrorClassifier {
  classify(responseStatus: number, responseBody: unknown, error?: unknown): ClassifiedGeminiError;
}

export interface IGeminiRequestBuilder {
  buildPayload(options: DirectGeminiRequestOptions): Record<string, unknown>;
  resolveEndpointUrl(model: string): string;
}

export interface IGeminiClient {
  callGeminiDirect(options: DirectGeminiRequestOptions): Promise<DirectGeminiResponse>;
}
