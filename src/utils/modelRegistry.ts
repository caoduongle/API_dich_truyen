import { AVAILABLE_MODELS } from '../constants/models';
import { KeyQuotaFullSnapshot, ModelInfoItem, ModelUsageStats } from './apiClient';

export const DISCOVERED_MODELS_STORAGE_KEY = 'gemini_discovered_models';
export const CUSTOM_MODELS_STORAGE_KEY = 'gemini_custom_models';

export type ModelSource = 'preset' | 'discovered' | 'custom';

export interface RegisteredModelDef {
  id: string;
  label: string;
  source: ModelSource;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  addedAt?: string;
}

export const MODEL_ID_REGEX = /^[a-zA-Z0-9_\-\.\/]{1,128}$/;

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Kiểm tra định dạng ID model hợp lệ
 */
export function isValidModelIdFormat(model: unknown): boolean {
  if (typeof model !== 'string') return false;
  const trimmed = model.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (trimmed.includes('..')) return false; // Ngăn chặn path traversal
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false; // Từ chối ký tự điều khiển
  return MODEL_ID_REGEX.test(trimmed);
}

/**
 * Chuẩn hóa mã định danh model (bỏ tiền tố 'models/' nếu có và chuyển thành chữ thường).
 */
export function normalizeModelId(id: string): string {
  if (!id) return '';
  return id.replace(/^models\//i, '').trim().toLowerCase();
}

/**
 * Danh sách model Presets mặc định
 */
export function getPresetModels(): RegisteredModelDef[] {
  return AVAILABLE_MODELS.map(m => ({
    id: m.id,
    label: m.label,
    source: 'preset' as ModelSource,
  }));
}

/**
 * Lấy danh sách model đã phát hiện từ localStorage
 */
export function getDiscoveredModels(): RegisteredModelDef[] {
  try {
    const raw = getStorageItem(DISCOVERED_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(m => m && typeof m.id === 'string' && isValidModelIdFormat(m.id));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Lấy danh sách model tự nhập từ localStorage
 */
export function getCustomModels(): RegisteredModelDef[] {
  try {
    const raw = getStorageItem(CUSTOM_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(m => m && typeof m.id === 'string' && isValidModelIdFormat(m.id));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Lấy toàn bộ danh sách model đã đăng ký trong hệ thống (Presets + Discovered + Custom)
 * Tự động khử trùng lặp (Ưu tiên Preset -> Custom -> Discovered).
 */
export function getRegisteredModels(): RegisteredModelDef[] {
  const presets = getPresetModels();
  const discovered = getDiscoveredModels();
  const custom = getCustomModels();

  const seenNormIds = new Set<string>();
  const result: RegisteredModelDef[] = [];

  // 1. Thêm Presets
  for (const m of presets) {
    const norm = normalizeModelId(m.id);
    seenNormIds.add(norm);
    result.push(m);
  }

  // 2. Thêm Custom models
  for (const m of custom) {
    const norm = normalizeModelId(m.id);
    if (!seenNormIds.has(norm)) {
      seenNormIds.add(norm);
      result.push(m);
    }
  }

  // 3. Thêm Discovered models
  for (const m of discovered) {
    const norm = normalizeModelId(m.id);
    if (!seenNormIds.has(norm)) {
      seenNormIds.add(norm);
      result.push(m);
    }
  }

  return result;
}

/**
 * Lưu danh sách model khám phá từ API Key vào localStorage
 * Chỉ lưu các model có hỗ trợ sinh nội dung (generateContent) và chưa có trong Presets.
 */
export function saveDiscoveredModels(models: ModelInfoItem[]): RegisteredModelDef[] {
  if (!models || models.length === 0) {
    return getDiscoveredModels();
  }

  const presets = getPresetModels();
  const presetNormSet = new Set(presets.map(p => normalizeModelId(p.id)));

  const currentDiscovered = getDiscoveredModels();
  const discoveredMap = new Map<string, RegisteredModelDef>();

  for (const d of currentDiscovered) {
    discoveredMap.set(normalizeModelId(d.id), d);
  }

  for (const item of models) {
    if (!item || !item.name) continue;

    // Lọc: nếu có supportedGenerationMethods thì kiểm tra có 'generateContent' không
    if (item.supportedGenerationMethods && Array.isArray(item.supportedGenerationMethods)) {
      const canGenerate = item.supportedGenerationMethods.some(m => 
        m.toLowerCase().includes('generatecontent')
      );
      if (!canGenerate) continue;
    }

    const cleanId = item.name.replace(/^models\//i, '');
    if (!isValidModelIdFormat(cleanId)) continue;

    const norm = normalizeModelId(cleanId);
    if (presetNormSet.has(norm)) continue; // Đã có trong presets

    discoveredMap.set(norm, {
      id: cleanId,
      label: item.displayName ? `${item.displayName} (${cleanId})` : cleanId,
      source: 'discovered',
      description: item.description,
      inputTokenLimit: item.inputTokenLimit,
      outputTokenLimit: item.outputTokenLimit,
      addedAt: new Date().toISOString(),
    });
  }

  const updated = Array.from(discoveredMap.values());
  setStorageItem(DISCOVERED_MODELS_STORAGE_KEY, JSON.stringify(updated));

  return updated;
}

/**
 * Thêm một model tự nhập vào registry
 */
export function addCustomModel(
  modelId: string, 
  label?: string
): { success: boolean; model?: RegisteredModelDef; error?: string } {
  const cleanId = modelId.trim().replace(/^models\//i, '');
  if (!isValidModelIdFormat(cleanId)) {
    return { 
      success: false, 
      error: 'ID Model không hợp lệ. Chỉ chấp nhận chữ cái, số, gạch ngang (-), gạch dưới (_), dấu chấm (.) và gạch chéo (/), tối đa 128 ký tự.' 
    };
  }

  const presets = getPresetModels();
  const norm = normalizeModelId(cleanId);
  if (presets.some(p => normalizeModelId(p.id) === norm)) {
    return {
      success: false,
      error: 'Model này đã có sẵn trong danh sách Mô hình khuyên dùng mặc định.',
    };
  }

  const currentCustom = getCustomModels();
  const exists = currentCustom.some(c => normalizeModelId(c.id) === norm);
  if (exists) {
    return {
      success: false,
      error: 'Model này đã tồn tại trong danh sách tự nhập.',
    };
  }

  const newModel: RegisteredModelDef = {
    id: cleanId,
    label: label?.trim() || cleanId,
    source: 'custom',
    addedAt: new Date().toISOString(),
  };

  const updated = [...currentCustom, newModel];
  setStorageItem(CUSTOM_MODELS_STORAGE_KEY, JSON.stringify(updated));

  return { success: true, model: newModel };
}

/**
 * Xóa một model tự nhập khỏi registry
 */
export function removeCustomModel(modelId: string): RegisteredModelDef[] {
  const norm = normalizeModelId(modelId);
  const currentCustom = getCustomModels();
  const updated = currentCustom.filter(c => normalizeModelId(c.id) !== norm);

  setStorageItem(CUSTOM_MODELS_STORAGE_KEY, JSON.stringify(updated));

  return updated;
}

/**
 * Xóa toàn bộ danh sách model đã phát hiện
 */
export function clearDiscoveredModels(): void {
  removeStorageItem(DISCOVERED_MODELS_STORAGE_KEY);
}

/**
 * Lấy tên hiển thị tiếng Việt / mô tả của một Model ID từ Registered Models.
 */
export function getModelDisplayName(modelId: string): string {
  const norm = normalizeModelId(modelId);
  const registered = getRegisteredModels();
  const found = registered.find(m => normalizeModelId(m.id) === norm);
  return found ? found.label : modelId;
}

export interface ModelStatsSummary {
  modelId: string;
  displayName: string;
  totalRequests: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  totalTokens: number;
  tokensToday: number;
  tokensThisMinute: number;
  totalKeys: number;
  checkedKeyCount: number;
  availableKeyCount: number;
  supportingKeyIndices: number[];
  hasChecked: boolean;
  isUnavailable: boolean;
}

/**
 * Định dạng số lượng token hiển thị gọn gàng (ví dụ: 1.5k, 250k, 3.2M)
 */
export function formatTokenCount(tokens: number = 0): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${tokens}`;
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
  let totalTokens = 0;
  let tokensToday = 0;
  let tokensThisMinute = 0;

  // 1. Tổng hợp số liệu request và token từ tất cả các key
  for (const item of snapshotKeys) {
    if (!item || !item.byModel) continue;

    for (const [mId, mStats] of Object.entries(item.byModel)) {
      if (normalizeModelId(mId) === normSelected && mStats) {
        totalRequests += mStats.requestsTotal || 0;
        requestsToday += mStats.requestsToday || 0;
        requestsThisMinute += mStats.requestsThisMinute || 0;
        errorsTotal += mStats.errorsTotal || 0;
        totalTokens += mStats.tokensTotal || 0;
        tokensToday += mStats.tokensToday || 0;
        tokensThisMinute += mStats.tokensThisMinute || 0;
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
    totalTokens,
    tokensToday,
    tokensThisMinute,
    totalKeys: effectiveTotalKeys,
    checkedKeyCount,
    availableKeyCount,
    supportingKeyIndices,
    hasChecked,
    isUnavailable,
  };
}

/**
 * Trích xuất thống kê request & token của riêng một key dành cho Model đang chọn.
 */
export function getKeyModelStats(
  keySnapshot?: KeyQuotaFullSnapshot,
  selectedModelId?: string
): ModelUsageStats {
  if (!keySnapshot || !keySnapshot.byModel || !selectedModelId) {
    return { 
      requestsTotal: 0, 
      requestsToday: 0, 
      requestsThisMinute: 0, 
      errorsTotal: 0,
      tokensTotal: 0,
      tokensToday: 0,
      tokensThisMinute: 0
    };
  }

  const normSelected = normalizeModelId(selectedModelId);
  for (const [mId, mStats] of Object.entries(keySnapshot.byModel)) {
    if (normalizeModelId(mId) === normSelected && mStats) {
      return {
        requestsTotal: mStats.requestsTotal || 0,
        requestsToday: mStats.requestsToday || 0,
        requestsThisMinute: mStats.requestsThisMinute || 0,
        errorsTotal: mStats.errorsTotal || 0,
        tokensTotal: mStats.tokensTotal || 0,
        tokensToday: mStats.tokensToday || 0,
        tokensThisMinute: mStats.tokensThisMinute || 0,
      };
    }
  }

  return { 
    requestsTotal: 0, 
    requestsToday: 0, 
    requestsThisMinute: 0, 
    errorsTotal: 0,
    tokensTotal: 0,
    tokensToday: 0,
    tokensThisMinute: 0
  };
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
