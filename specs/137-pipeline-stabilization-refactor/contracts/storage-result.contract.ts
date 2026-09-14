/**
 * Contract: Transparent Storage Result
 * Định nghĩa giao diện truy xuất IndexedDB minh bạch trạng thái lỗi
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

export interface IStorageAccess<T, ID = string> {
  getAll(): Promise<StorageResult<T[]>>;
  getById(id: ID): Promise<StorageResult<T | null>>;
  save(item: T): Promise<StorageResult<void>>;
  delete(id: ID): Promise<StorageResult<void>>;
}
