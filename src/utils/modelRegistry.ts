import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../constants/models';
import { KeyQuotaFullSnapshot, ModelInfoItem, ModelUsageStats } from './apiClient';
import type { ModelCapabilities, ModelDefinition, ModelLimits, ModelSource, ModelStatus } from '@shared/models';

export const DISCOVERED_MODELS_STORAGE_KEY = 'gemini_discovered_models';
export const CUSTOM_MODELS_STORAGE_KEY = 'gemini_custom_models';

export type { ModelSource, ModelStatus, ModelCapabilities, ModelLimits, ModelDefinition };

export interface RegisteredModelDef extends ModelDefinition {}

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
    status: m.status || 'active',
    capabilities: m.capabilities || { generateContent: true },
    limits: m.limits,
    replacementId: m.replacementId,
    description: m.description,
    inputTokenLimit: m.inputTokenLimit,
    outputTokenLimit: m.outputTokenLimit,
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
      return parsed
        .filter(m => m && typeof m.id === 'string' && isValidModelIdFormat(m.id))
        .map(m => ({
          id: m.id,
          label: m.label || m.id,
          source: 'discovered' as ModelSource,
          status: (m.status as ModelStatus) || 'active',
          capabilities: m.capabilities || { generateContent: true },
          limits: m.limits,
          replacementId: m.replacementId,
          description: m.description,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          addedAt: m.addedAt,
        }));
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
      return parsed
        .filter(m => m && typeof m.id === 'string' && isValidModelIdFormat(m.id))
        .map(m => ({
          id: m.id,
          label: m.label || m.id,
          source: 'custom' as ModelSource,
          status: (m.status as ModelStatus) || 'active',
          capabilities: m.capabilities || { generateContent: true },
          limits: m.limits,
          replacementId: m.replacementId,
          description: m.description,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          addedAt: m.addedAt,
        }));
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
 * Tra cứu định nghĩa đầy đủ của một model theo ID
 */
export function getModelDefinition(modelId: string): RegisteredModelDef | undefined {
  if (!modelId) return undefined;
  const norm = normalizeModelId(modelId);
  return getRegisteredModels().find(m => normalizeModelId(m.id) === norm);
}

/**
 * Di chuyển an toàn (migration) khi model đã lưu bị deprecated hoặc shutdown
 */
export function migrateModelSelection(currentModelId: string): {
  effectiveModelId: string;
  wasMigrated: boolean;
  isDeprecated: boolean;
  isShutdown: boolean;
  replacementId?: string;
  reason?: string;
} {
  if (!currentModelId || !isValidModelIdFormat(currentModelId)) {
    return {
      effectiveModelId: DEFAULT_MODEL_ID,
      wasMigrated: true,
      isDeprecated: false,
      isShutdown: false,
      reason: 'Model không hợp lệ, tự động chuyển về model mặc định.',
    };
  }

  const def = getModelDefinition(currentModelId);
  if (!def) {
    // Model không còn tồn tại trong registry
    return {
      effectiveModelId: currentModelId,
      wasMigrated: false,
      isDeprecated: false,
      isShutdown: false,
    };
  }

  if (def.status === 'shutdown') {
    const target = def.replacementId || DEFAULT_MODEL_ID;
    return {
      effectiveModelId: target,
      wasMigrated: true,
      isDeprecated: false,
      isShutdown: true,
      replacementId: def.replacementId,
      reason: `Mô hình "${def.label}" đã chính thức ngừng hoạt động (Shutdown). Tự động chuyển sang mô hình "${target}".`,
    };
  }

  if (def.status === 'deprecated') {
    return {
      effectiveModelId: currentModelId,
      wasMigrated: false,
      isDeprecated: true,
      isShutdown: false,
      replacementId: def.replacementId,
      reason: `Mô hình "${def.label}" sắp ngừng hoạt động (Deprecated). Khuyến nghị chuyển sang "${def.replacementId || 'mô hình mới hơn'}".`,
    };
  }

  return {
    effectiveModelId: currentModelId,
    wasMigrated: false,
    isDeprecated: false,
    isShutdown: false,
  };
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
    let canGenerate = true;
    if (item.supportedGenerationMethods && Array.isArray(item.supportedGenerationMethods)) {
      canGenerate = item.supportedGenerationMethods.some(m => 
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
      status: 'active',
      capabilities: {
        generateContent: canGenerate,
        vision: true,
        thinking: cleanId.toLowerCase().includes('thinking') || cleanId.toLowerCase().includes('2.5'),
      },
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
    status: 'active',
    capabilities: {
      generateContent: true,
    },
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
 * Tổng hợp số liệu thống kê sử dụng và mức độ khả dụng của một Model đang chọn
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

export interface PacingConfig {
  intervalMs: number;
  estimatedRpm: number;
  intervalSec: string;
  isCustom: boolean;
}

/**
 * Tính toán khoảng cách an toàn (mili-giây) giữa các request dựa trên RPM người dùng cấu hình
 * Hoặc fallback theo tier của model.
 * Sử dụng hệ số an toàn 0.88 và giới hạn sàn 500ms trên client.
 */
export function getDynamicPacingInterval(customRpm?: number, modelId?: string): number {
  if (typeof customRpm === 'number' && customRpm > 0) {
    return Math.max(500, Math.ceil(60000 / (customRpm * 0.88)));
  }

  const norm = modelId ? normalizeModelId(modelId) : '';
  if (norm.includes('pro')) {
    return 6000; // ~10 RPM an toàn cho Pro models
  }
  if (norm.includes('flash-lite')) {
    return 3500; // ~17 RPM cho Flash Lite
  }
  return 4500; // ~13.3 RPM mặc định an toàn cho Flash models
}

/**
 * Kiểm tra xem lượng token tiêu thụ trong phút hiện tại có chạm ngưỡng an toàn (85% maxTpm) hay không
 */
export function isTpmNearLimit(currentTpm: number, maxTpm: number = 1000000): boolean {
  if (currentTpm <= 0 || maxTpm <= 0) return false;
  return currentTpm >= maxTpm * 0.85;
}

/**
 * Định dạng cấu hình nhịp độ điều phối để hiển thị lên giao diện
 */
export function formatPacingSummary(customRpm?: number, modelId?: string): PacingConfig {
  const intervalMs = getDynamicPacingInterval(customRpm, modelId);
  const intervalSec = (intervalMs / 1000).toFixed(1) + 's';
  const estimatedRpm = Math.round((60000 / intervalMs) * 10) / 10;
  const isCustom = typeof customRpm === 'number' && customRpm > 0;

  return {
    intervalMs,
    estimatedRpm,
    intervalSec,
    isCustom,
  };
}
