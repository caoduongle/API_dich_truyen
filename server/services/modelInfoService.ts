import { hashApiKey, maskApiKey } from './quotaService';
import { redactApiKey } from '../utils/text';

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

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút
const REQUEST_TIMEOUT_MS = 15 * 1000; // 15 giây

class ModelInfoService {
  private cache = new Map<string, CachedModels>();
  private inFlightRevalidation = new Map<string, Promise<ModelInfo[]>>();

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
   * Xóa toàn bộ cache (dùng cho testing)
   */
  public clearCache(): void {
    this.cache.clear();
    this.inFlightRevalidation.clear();
  }
}

export const modelInfoService = new ModelInfoService();
