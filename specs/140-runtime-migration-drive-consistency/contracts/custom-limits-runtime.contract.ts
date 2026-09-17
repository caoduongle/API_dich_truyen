/**
 * Contract: Custom Limits Runtime Migration & Storage Interface
 * Feature: 140-runtime-migration-drive-consistency
 */

import { CustomLimit } from '../../../src/types/quota';

export interface CustomLimitMigrationResult {
  migratedCount: number;
  legacyCount: number;
  currentCount: number;
  migratedKeys: string[];
}

export interface ICustomLimitsRuntimeStorage {
  /**
   * Đọc cấu hình hạn mức cá nhân từ localStorage.
   * Nếu cung cấp tham số `apiKeys`, tự động thực thi di trú các mã băm cũ trước khi trả kết quả.
   */
  getStoredCustomLimits(apiKeys?: string[]): Record<string, CustomLimit>;

  /**
   * Lưu cấu hình hạn mức cá nhân vào localStorage và bộ nhớ đệm in-memory fallback.
   */
  saveStoredCustomLimits(limits: Record<string, CustomLimit>): void;

  /**
   * Di trú các mục cấu hình từ mã băm cũ (32-bit hex) sang SHA-256 mới (64 hex)
   */
  migrateCustomLimits(apiKeys: string[]): CustomLimitMigrationResult;

  /**
   * Xóa sạch dữ liệu cấu hình hạn mức (phục vụ kiểm thử)
   */
  clearStoredCustomLimits(): void;
}
