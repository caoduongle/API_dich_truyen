import { hashApiKey, maskApiKey } from './quotaService';
import { redactApiKey } from '../utils/text';
import { AVAILABLE_MODELS, ModelDefinition } from '../constants/models';

export interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

interface CachedModels {
  timestamp: number;
  models: ModelInfo[];
}

interface CachedVerifiedModel {
  timestamp: number;
  model: ModelDefinition;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút
const REQUEST_TIMEOUT_MS = 15 * 1000; // 15 giây

class ModelInfoService {
  private cache = new Map<string, CachedModels>();
  private inFlightRevalidation = new Map<string, Promise<ModelInfo[]>>();
  private verifiedModelsCache = new Map<string, CachedVerifiedModel>();


  /**
   * Gọi Google API để lấy danh sách models
   */
  private async fetchModelsFromGoogle(trimmedKey: string): Promise<ModelInfo[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Lỗi từ Google API: ${redactApiKey(rawMsg, [trimmedKey])}`);
      }

      const data = await response.json();
      const rawModels = Array.isArray(data.models) ? data.models : [];

      const filteredModels: ModelInfo[] = rawModels
        .filter((m: any) => {
          if (!m || typeof m !== 'object') return false;
          if (Array.isArray(m.supportedGenerationMethods)) {
            return m.supportedGenerationMethods.includes('generateContent');
          }
          return true;
        })
        .map((m: any) => ({
          name: m.name || '',
          displayName: m.displayName || m.name || 'Unknown Model',
          description: m.description || '',
          supportedGenerationMethods: m.supportedGenerationMethods || [],
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
        }));

      return filteredModels;
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error('Yêu cầu tra cứu danh sách mô hình quá thời gian chờ (15 giây).');
      }
      const safeErrMsg = redactApiKey(err.message || String(err), [trimmedKey]);
      throw new Error(safeErrMsg);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Lấy danh sách các mô hình hỗ trợ generateContent từ Google AI Studio cho 1 API key
   * Tích hợp Stale-While-Revalidate (SWR) cache và failure fallback.
   */
  public async listModelsForKey(
    apiKey: string,
    forceRefresh: boolean = false
  ): Promise<{ keyHash: string; maskedKey: string; cached: boolean; stale?: boolean; models: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API key không hợp lệ hoặc bị trống.');
    }

    const trimmedKey = apiKey.trim();
    const keyHash = hashApiKey(trimmedKey);
    const masked = maskApiKey(trimmedKey);
    const now = Date.now();

    const cachedEntry = this.cache.get(keyHash);

    // 1. Fresh Cache: Chưa hết hạn TTL và không bị ép làm mới thủ công
    if (!forceRefresh && cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return {
        keyHash,
        maskedKey: masked,
        cached: true,
        stale: false,
        models: cachedEntry.models,
      };
    }

    // 2. Stale Cache: Đã hết hạn TTL nhưng có cache cũ -> Trả về cache cũ ngay lập tức và revalidate ngầm
    if (!forceRefresh && cachedEntry) {
      // Kích hoạt revalidate ngầm trong background (nếu chưa có request revalidate nào đang chạy)
      if (!this.inFlightRevalidation.has(keyHash)) {
        const revalPromise = this.fetchModelsFromGoogle(trimmedKey)
          .then((freshModels) => {
            this.cache.set(keyHash, { timestamp: Date.now(), models: freshModels });
            return freshModels;
          })
          .catch((err) => {
            console.warn('[ModelDiscovery SWR] Revalidation ngầm gặp lỗi, giữ nguyên cache hợp lệ trước đó:', err.message);
            return cachedEntry.models;
          })
          .finally(() => {
            this.inFlightRevalidation.delete(keyHash);
          });
        this.inFlightRevalidation.set(keyHash, revalPromise);
      }

      return {
        keyHash,
        maskedKey: masked,
        cached: true,
        stale: true,
        models: cachedEntry.models,
      };
    }

    // 3. Không có cache hoặc forceRefresh: Gọi trực tiếp có fallback
    try {
      const freshModels = await this.fetchModelsFromGoogle(trimmedKey);
      this.cache.set(keyHash, {
        timestamp: now,
        models: freshModels,
      });

      return {
        keyHash,
        maskedKey: masked,
        cached: false,
        stale: false,
        models: freshModels,
      };
    } catch (err: any) {
      // Nếu có cache cũ dù đã hết hạn -> Fallback an toàn thay vì crash
      if (cachedEntry && cachedEntry.models.length > 0) {
        console.warn('[ModelDiscovery Fallback] Lỗi làm mới, tận dụng cache cũ an toàn:', err.message);
        return {
          keyHash,
          maskedKey: masked,
          cached: true,
          stale: true,
          models: cachedEntry.models,
        };
      }
      throw err;
    }
  }

  /**
   * Gọi Google API để tra cứu chi tiết 1 model cụ thể
   */
  private async fetchSingleModelFromGoogle(modelId: string, trimmedKey: string): Promise<ModelInfo> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const cleanModelName = modelId.startsWith('models/') ? modelId : `models/${modelId}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(cleanModelName)}?key=${encodeURIComponent(trimmedKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 404) {
          throw new Error(`Không tìm thấy mô hình "${modelId}" trên hệ thống nhà cung cấp Google AI Studio.`);
        }
        throw new Error(`Lỗi từ Google API khi xác minh model "${modelId}": ${redactApiKey(rawMsg, [trimmedKey])}`);
      }

      const m = await response.json();
      return {
        name: m.name || cleanModelName,
        displayName: m.displayName || m.name || modelId,
        description: m.description || '',
        supportedGenerationMethods: m.supportedGenerationMethods || [],
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Yêu cầu xác minh mô hình "${modelId}" quá thời gian chờ (15 giây).`);
      }
      const safeErrMsg = redactApiKey(err.message || String(err), [trimmedKey]);
      throw new Error(safeErrMsg);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Xác minh 1 model cụ thể có tồn tại và hỗ trợ generateContent không
   */
  public async verifySingleModel(
    modelId: string,
    apiKey?: string,
    customLabel?: string
  ): Promise<ModelDefinition> {
    if (!modelId || typeof modelId !== 'string') {
      throw new Error('ID Model không hợp lệ hoặc bị trống.');
    }

    const cleanId = modelId.replace(/^models\//i, '').trim();
    const normId = cleanId.toLowerCase();

    // 1. Kiểm tra Presets
    const preset = AVAILABLE_MODELS.find(p => p.id.toLowerCase() === normId);
    if (preset) {
      if (preset.status === 'shutdown') {
        throw new Error(`Mô hình "${preset.label}" đã chính thức ngừng hoạt động (Shutdown). Không thể sử dụng.`);
      }
      return {
        ...preset,
        label: customLabel?.trim() || preset.label,
        verified: true,
        lastVerifiedAt: new Date().toISOString(),
      };
    }

    // 2. Kiểm tra cache đã xác minh gần đây
    const cached = this.verifiedModelsCache.get(normId);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.model,
        label: customLabel?.trim() || cached.model.label,
        lastVerifiedAt: cached.model.lastVerifiedAt || new Date(cached.timestamp).toISOString(),
      };
    }

    if (!apiKey || !apiKey.trim()) {
      throw new Error('Cần cung cấp ít nhất một API Key hợp lệ để thực hiện xác minh mô hình tùy chỉnh.');
    }

    const trimmedKey = apiKey.trim();

    // 3. Gọi Google API kiểm tra thông tin model
    const info = await this.fetchSingleModelFromGoogle(cleanId, trimmedKey);

    // Kiểm tra khả năng generateContent
    const methods = info.supportedGenerationMethods || [];
    const canGenerate = methods.length === 0 || methods.some(m => m.toLowerCase().includes('generatecontent'));
    if (!canGenerate) {
      throw new Error(`Mô hình "${cleanId}" không hỗ trợ phương thức tạo nội dung (generateContent). Không tương thích với quy trình dịch thuật.`);
    }

    const verifiedModel: ModelDefinition = {
      id: cleanId,
      label: customLabel?.trim() || info.displayName || cleanId,
      source: 'custom',
      status: 'active',
      verified: true,
      lastVerifiedAt: new Date().toISOString(),
      capabilities: {
        generateContent: true,
        structuredOutput: true,
        vision: true,
        thinking: cleanId.toLowerCase().includes('thinking') || cleanId.toLowerCase().includes('2.5'),
      },
      limits: {
        defaultRpm: cleanId.toLowerCase().includes('pro') ? 10 : 15,
        defaultTpm: 1000000,
        defaultRpd: 1500,
      },
      description: info.description,
      inputTokenLimit: info.inputTokenLimit,
      outputTokenLimit: info.outputTokenLimit,
      addedAt: new Date().toISOString(),
    };

    // Lưu vào cache đã xác minh
    this.verifiedModelsCache.set(normId, {
      timestamp: now,
      model: verifiedModel,
    });

    return verifiedModel;
  }

  /**
   * Đăng ký trực tiếp 1 model đã xác minh vào server cache
   */
  public registerVerifiedModel(model: ModelDefinition): void {
    if (!model || !model.id) return;
    const normId = model.id.replace(/^models\//i, '').trim().toLowerCase();
    this.verifiedModelsCache.set(normId, {
      timestamp: Date.now(),
      model: {
        ...model,
        verified: true,
        lastVerifiedAt: model.lastVerifiedAt || new Date().toISOString(),
      },
    });
  }

  /**
   * Kiểm tra nhanh xem 1 model ID có được xác minh trong hệ thống hay không
   */
  public async isModelVerified(modelId: string, apiKeys: string[] = []): Promise<boolean> {
    if (!modelId) return false;
    const cleanId = modelId.replace(/^models\//i, '').trim();
    const normId = cleanId.toLowerCase();

    // 1. Preset model: active/deprecated => true; shutdown => false
    const preset = AVAILABLE_MODELS.find(p => p.id.toLowerCase() === normId);
    if (preset) {
      return preset.status !== 'shutdown';
    }

    // 2. Cached verified model
    const cached = this.verifiedModelsCache.get(normId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.model.verified === true && cached.model.status !== 'shutdown';
    }

    // 3. Nếu có API key, thử verify on-demand
    if (apiKeys.length > 0 && apiKeys[0]?.trim()) {
      try {
        const verified = await this.verifySingleModel(cleanId, apiKeys[0]);
        return verified.verified === true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Kiểm tra nhanh khả năng tương thích của 1 model với 1 API key từ cache đã biết
   * (Trả về true nếu model có trong danh sách, false nếu key đã được inspect và không có model này, hoặc 'uninspected' nếu chưa có cache)
   */
  public getCachedModelSupport(apiKey: string, modelId: string): boolean | 'uninspected' {
    if (!apiKey || !modelId) return 'uninspected';
    const cleanKey = apiKey.trim();
    const keyHash = hashApiKey(cleanKey);
    const cached = this.cache.get(keyHash);
    if (!cached || !cached.models || cached.models.length === 0) {
      return 'uninspected';
    }
    const cleanModelName = modelId.replace(/^models\//i, '').trim().toLowerCase();
    const found = cached.models.some(m => m.name.replace(/^models\//i, '').trim().toLowerCase() === cleanModelName);
    return found;
  }

  /**
   * Xóa toàn bộ cache (dùng cho testing)
   */
  public clearCache(): void {
    this.cache.clear();
    this.inFlightRevalidation.clear();
    this.verifiedModelsCache.clear();
  }
}

export const modelInfoService = new ModelInfoService();

