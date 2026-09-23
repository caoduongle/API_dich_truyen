/**
 * Runtime Architecture & Security Hardening Contracts (Phase 2)
 * Formal interface contracts for symmetrical sliding-window sanitization,
 * comprehensive GeminiRequestError taxonomy, and type-safe error inspection.
 */

import type { GeminiErrorCode, ClassifiedErrorCategory } from '../../../src/services/gemini/types';

export interface CallAttemptEntry {
  timestamp: number;
}

export interface CallTokenEntry {
  timestamp: number;
  tokens: number;
}

/**
 * Shared helper for pruning and bounding call attempt arrays
 */
export type SanitizeAttemptsFn = (
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries?: number
) => CallAttemptEntry[];

/**
 * Shared helper for pruning and bounding token consumption arrays
 */
export type SanitizeTokensFn = (
  raw: unknown,
  minuteThreshold: number,
  maxFutureTimestamp: number,
  maxEntries?: number
) => CallTokenEntry[];

/**
 * Strongly typed Gemini request error structure
 */
export interface IGeminiRequestError extends Error {
  readonly code: GeminiErrorCode;
  readonly category: ClassifiedErrorCategory;
  readonly status?: number;
  readonly isRetryable: boolean;
}

/**
 * Type-safe error message extractor
 */
export type GetErrorMessageFn = (error: unknown) => string;

/**
 * Safe safety / empty error classifier
 */
export type IsSafetyOrEmptyErrorFn = (error: unknown) => boolean;
