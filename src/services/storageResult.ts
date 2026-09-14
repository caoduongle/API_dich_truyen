/**
 * Transparent Storage Result Types for Database Operations
 */

export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'STORAGE_BLOCKED'
  | 'QUOTA_EXCEEDED'
  | 'VERSION_ERROR'
  | 'TRANSACTION_ABORTED'
  | 'CORRUPTED_DATA'
  | 'UNKNOWN_ERROR';

export interface StorageError {
  code: StorageErrorCode;
  message: string;
  cause?: unknown;
}

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: StorageError };

export function createStorageSuccess<T>(data: T): StorageResult<T> {
  return { ok: true, data };
}

export function createStorageError<T = never>(
  code: StorageErrorCode,
  message: string,
  cause?: unknown
): StorageResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      cause,
    },
  };
}
