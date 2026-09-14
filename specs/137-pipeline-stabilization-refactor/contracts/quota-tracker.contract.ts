/**
 * Contract: Quota Tracker & Scheduler
 * Định nghĩa giao diện theo dõi hạn ngạch, tính toán RPM/TPM và PST reset
 */

export interface CallAttemptOptions {
  key: string;
  model: string;
  timestamp?: number;
}

export interface CallSuccessOptions {
  key: string;
  model: string;
  tokens: {
    promptTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
  timestamp?: number;
}

export interface CallFailureOptions {
  key: string;
  model: string;
  error: {
    status?: number;
    message?: string;
    details?: unknown[];
    isRateLimit?: boolean;
    isAuthError?: boolean;
    isOverload?: boolean;
  };
  timestamp?: number;
}

export interface IQuotaTracker {
  recordLogicalStart(now?: number): void;
  recordProviderAttempt(key: string, model: string, now?: number): void;
  recordSuccess(key: string, model: string, tokens: CallSuccessOptions['tokens'], latencyMs?: number, now?: number): void;
  recordFailure(key: string, model: string, error: CallFailureOptions['error'], now?: number): void;
  getNextPstMidnight(now?: number): number;
  findNextAvailableKeyIndex(keys: string[], startIndex?: number, customLimits?: Record<string, unknown>, now?: number): number;
}
