/**
 * Contract: Gemini Error Classification & Rotation Filter
 * Feature: 141-storage-and-credential-hardening
 */

export type HardenedErrorCategory =
  | 'BAD_REQUEST'           // HTTP 400 - Do not retry/rotate
  | 'RESOURCE_NOT_FOUND'    // HTTP 404 - Model/resource not found, Fail fast, do not rotate
  | 'AUTH_FAILURE'          // HTTP 401/403 - Bad key, permanent cooldown on key
  | 'SERVICE_OVERLOAD'      // HTTP 500/503 - Temporary overload, retryable
  | 'RATE_LIMIT_RPM'        // HTTP 429 - Minute rate limit, retry with cooldown
  | 'QUOTA_EXHAUSTED_RPD'   // HTTP 429 - Daily quota exhausted, cooldown until PST midnight
  | 'CONTENT_BLOCKED'       // Safety filter block, non-retryable
  | 'NETWORK_FAILURE'       // Fetch failed / aborted
  | 'UNRECOGNIZED';         // Other unknown error

export interface HardenedGeminiError {
  category: HardenedErrorCategory;
  httpStatus: number;
  rpcStatus?: string;
  reason: string;
  details?: any[];
  recommendedCooldownMs: number;
  isRetryable: boolean;
  message: string;
}
