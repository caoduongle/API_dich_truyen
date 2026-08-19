import { AVAILABLE_MODELS } from '../constants/models';
import { KeyQuotaFullSnapshot, ModelInfoItem, ModelUsageStats } from './apiClient';

/**
 * Chuẩn hóa mã định danh model (bỏ tiền tố 'models/' nếu có và chuyển thành chữ thường).
 */
export function normalizeModelId(id: string): string {
  if (!id) return '';
  return id.replace(/^models\//i, '').trim().toLowerCase();
}

/**
 * Lấy tên hiển thị tiếng Việt / mô tả của một Model ID từ AVAILABLE_MODELS.
 */
export function getModelDisplayName(modelId: string): string {
  const norm = normalizeModelId(modelId);
  const found = AVAILABLE_MODELS.find(m => normalizeModelId(m.id) === norm);
  return found ? found.label : modelId;
}

export interface ModelStatsSummary {
  modelId: string;
  displayName: string;
  totalRequests: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  totalKeys: number;
  checkedKeyCount: number;
  availableKeyCount: number;
  supportingKeyIndices: number[];
  hasChecked: boolean;
  isUnavailable: boolean;
}

/**
 * Tổng hợp số liệu thống kê sử dụng và mức độ khả dụng của một Model đang chọn từ:
 * 1. Dữ liệu Quota thời gian thực của máy chủ (snapshotKeys.byModel)
 * 2. Kết quả kiểm tra model thực tế của từng key (inspectResults)
 */
export function computeModelStatsSummary(
  selectedModelId: string,
  snapshotKeys: KeyQuotaFullSnapshot[] = [],
  inspectResults: Record<number, ModelInfoItem[]> = {},
  totalKeysCount: number = 0
): ModelStatsSummary {
  const normSelected = normalizeModelId(selectedModelId);
  const displayName = getModelDisplayName(selectedModelId);

  let totalRequests = 0;
  let requestsToday = 0;
  let requestsThisMinute = 0;
  let errorsTotal = 0;

  // 1. Tổng hợp số liệu request từ tất cả các key
  for (const item of snapshotKeys) {
    if (!item || !item.byModel) continue;

    for (const [mId, mStats] of Object.entries(item.byModel)) {
      if (normalizeModelId(mId) === normSelected && mStats) {
        totalRequests += mStats.requestsTotal || 0;
        requestsToday += mStats.requestsToday || 0;
        requestsThisMinute += mStats.requestsThisMinute || 0;
        errorsTotal += mStats.errorsTotal || 0;
      }
    }
  }

  // 2. Tính toán số lượng key hỗ trợ model này từ inspectResults
  let checkedKeyCount = 0;
  let availableKeyCount = 0;
  const supportingKeyIndices: number[] = [];

  const effectiveTotalKeys = Math.max(totalKeysCount, snapshotKeys.length);

  for (let idx = 0; idx < effectiveTotalKeys; idx++) {
    const modelsForKey = inspectResults[idx];
    if (modelsForKey && modelsForKey.length > 0) {
      checkedKeyCount++;
      const isSupported = modelsForKey.some(m => normalizeModelId(m.name) === normSelected);
      if (isSupported) {
        availableKeyCount++;
        supportingKeyIndices.push(idx);
      }
    }
  }

  const hasChecked = checkedKeyCount > 0;
  // Cảnh báo không khả dụng nếu đã kiểm tra ít nhất 1 key và 0 key nào hỗ trợ
  const isUnavailable = hasChecked && availableKeyCount === 0;

  return {
    modelId: selectedModelId,
    displayName,
    totalRequests,
    requestsToday,
    requestsThisMinute,
    errorsTotal,
    totalKeys: effectiveTotalKeys,
    checkedKeyCount,
    availableKeyCount,
    supportingKeyIndices,
    hasChecked,
    isUnavailable,
  };
}

/**
 * Trích xuất thống kê request của riêng một key dành cho Model đang chọn.
 */
export function getKeyModelStats(
  keySnapshot?: KeyQuotaFullSnapshot,
  selectedModelId?: string
): ModelUsageStats {
  if (!keySnapshot || !keySnapshot.byModel || !selectedModelId) {
    return { requestsTotal: 0, requestsToday: 0, requestsThisMinute: 0, errorsTotal: 0 };
  }

  const normSelected = normalizeModelId(selectedModelId);
  for (const [mId, mStats] of Object.entries(keySnapshot.byModel)) {
    if (normalizeModelId(mId) === normSelected && mStats) {
      return {
        requestsTotal: mStats.requestsTotal || 0,
        requestsToday: mStats.requestsToday || 0,
        requestsThisMinute: mStats.requestsThisMinute || 0,
        errorsTotal: mStats.errorsTotal || 0,
      };
    }
  }

  return { requestsTotal: 0, requestsToday: 0, requestsThisMinute: 0, errorsTotal: 0 };
}

/**
 * Kiểm tra xem một key có hỗ trợ model đang chọn hay không (true / false / 'uninspected').
 */
export function checkKeySupportForModel(
  modelsForKey?: ModelInfoItem[],
  selectedModelId?: string
): boolean | 'uninspected' {
  if (!modelsForKey || modelsForKey.length === 0) {
    return 'uninspected';
  }
  if (!selectedModelId) return false;

  const normSelected = normalizeModelId(selectedModelId);
  return modelsForKey.some(m => normalizeModelId(m.name) === normSelected);
}
