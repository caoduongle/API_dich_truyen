/**
 * Contract: Custom Limits Hash Migration
 * Định nghĩa giao diện di trú mã băm cũ (32-bit integer) sang SHA-256 mới cho cấu hình hạn mức cá nhân
 */

import type { CustomLimit } from '../../../src/types/quota';

export interface CustomLimitMigrationResult {
  migratedCount: number;
  legacyCount: number;
  currentCount: number;
  migratedKeys: string[];
}

export interface ICustomLimitsStorage {
  /**
   * Đọc cấu hình hạn mức cá nhân từ bộ lưu trữ an toàn
   */
  getStoredCustomLimits(): Record<string, CustomLimit>;

  /**
   * Lưu cấu hình hạn mức cá nhân vào bộ lưu trữ
   */
  saveStoredCustomLimits(limits: Record<string, CustomLimit>): void;

  /**
   * Di trú các mục băm cũ sang chuẩn SHA-256 dựa trên danh sách các khóa API hoạt động
   */
  migrateCustomLimits(apiKeys: string[]): CustomLimitMigrationResult;

  /**
   * Hàm băm cũ (32-bit fallback) dùng để nhận diện các khóa lưu trữ lịch sử
   */
  legacyHashApiKey(key: string): string;

  /**
   * Xóa toàn bộ cấu hình hạn mức (phục vụ test)
   */
  clearStoredCustomLimits(): void;
}
