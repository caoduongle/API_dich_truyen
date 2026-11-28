import { DEFAULT_CUSTOM_LIMIT, type CustomLimit } from '../types/quota';

/**
 * Chuẩn hóa mã định danh model (bỏ tiền tố 'models/' nếu có và chuyển thành chữ thường).
 */
export function normalizeModelId(id: string): string {
  if (!id) return '';
  return id.replace(/^models\//i, '').trim().toLowerCase();
}

/**
 * Trả về hạn mức tham chiếu mặc định sát thực tế cho từng dòng mô hình AI (không phụ thuộc storage/mock registry).
 */
export function getFamilyReferenceLimits(modelId?: string): CustomLimit | null {
  const norm = modelId ? normalizeModelId(modelId) : '';
  if (!norm) return null;
  if (norm.includes('flash-lite')) {
    return { maxRpm: 15, maxTpm: 250_000, maxRpd: 500 };
  }
  if (norm.includes('flash')) {
    return { maxRpm: 15, maxTpm: 250_000, maxRpd: 500 };
  }
  if (norm.includes('pro')) {
    return { maxRpm: 10, maxTpm: 250_000, maxRpd: 100 };
  }
  return null;
}

export function getDefaultReferenceLimitFallback(): CustomLimit {
  return { ...DEFAULT_CUSTOM_LIMIT };
}
