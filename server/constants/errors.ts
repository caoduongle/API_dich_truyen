export enum AIErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  AUTH_FAILED = 'AUTH_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_UNSUPPORTED = 'MODEL_UNSUPPORTED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export type AIRecommendedAction =
  | 'retry'
  | 'rotate_key'
  | 'cooldown_key'
  | 'disable_key'
  | 'fail_immediately';

export interface AIErrorNormalized {
  code: AIErrorCode;
  message: string;
  isRetryable: boolean;
  recommendedAction: AIRecommendedAction;
  httpStatus: number;
  retryAfterSec?: number;
  details?: Record<string, unknown>;
}
