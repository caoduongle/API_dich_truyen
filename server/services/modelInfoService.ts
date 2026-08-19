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

  /**
   * Lấy danh sách các mô hình hỗ trợ generateContent từ Google AI Studio cho 1 API key
   */
  public async listModelsForKey(apiKey: string): Promise<{ keyHash: string; maskedKey: string; cached: boolean; models: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API key không hợp lệ hoặc bị trống.');
    }

    const trimmedKey = apiKey.trim();
    const keyHash = hashApiKey(trimmedKey);
    const masked = maskApiKey(trimmedKey);
    const now = Date.now();

    // 1. Kiểm tra cache
    const cachedEntry = this.cache.get(keyHash);
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return {
        keyHash,
        maskedKey: masked,
        cached: true,
        models: cachedEntry.models,
      };
    }

    // 2. Gọi Google API models.list với timeout 15 giây qua AbortController
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

      // Lọc các model hỗ trợ generateContent
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

      // Lưu cache
      this.cache.set(keyHash, {
        timestamp: now,
        models: filteredModels,
      });

      return {
        keyHash,
        maskedKey: masked,
        cached: false,
        models: filteredModels,
      };
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
   * Xóa toàn bộ cache (dùng cho testing)
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const modelInfoService = new ModelInfoService();
