/**
 * Contract: Quota Tracker & Key Persistence
 * Định nghĩa giao diện quản lý hạn mức và bảo toàn trạng thái nghỉ qua các lần tải lại trang
 */

import { KeyHealthState, CustomLimit } from '../../../src/types/quota';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
}

export interface ILocalQuotaTracker {
  recordLogicalStart(): void;
  recordProviderAttempt(key: string, model: string, timestamp?: number): void;
  recordSuccess(
    key: string,
    model: string,
    tokens: { promptTokens: number; outputTokens: number; totalTokens: number },
    latencyMs: number
  ): void;
  recordFailure(
    key: string,
    model: string,
    errorInfo?: {
      status?: number;
      message?: string;
      details?: any;
      rawResponse?: any;
      isRateLimit?: boolean;
      isAuthError?: boolean;
      isOverload?: boolean;
    }
  ): void;
  getKeyHealth(key: string, customLimits?: Record<string, CustomLimit>, now?: number): KeyHealthResult;
  clearAllStats(): void;
}
