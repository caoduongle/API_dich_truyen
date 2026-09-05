import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RegisteredModelDef,
  getRegisteredModels,
  getDiscoveredModels,
  getDiscoveredCacheMeta,
  isDiscoveryStale,
  fetchAndCacheDiscoveredModels,
} from '../utils/modelRegistry';
import { ModelInfoItem } from '../utils/apiClient';
import { listModelsDirect } from '../services/directGeminiClient';

export interface UseModelDiscoveryOptions {
  /** Tự động làm mới chạy ngầm khi cache stale hoặc chưa có cache (mặc định: true) */
  autoBackgroundRefresh?: boolean;
  /** Session token tùy chọn */
  sessionToken?: string | null;
  /** Danh sách API keys tạm thời */
  apiKeys?: string[];
}

export interface UseModelDiscoveryResult {
  /** Toàn bộ danh sách model đã đăng ký (Presets + Discovered + Custom) */
  models: RegisteredModelDef[];
  /** Danh sách riêng các model được khám phá từ API */
  discoveredModels: RegisteredModelDef[];
  /** Đang tải lần đầu (chưa có bất kỳ cache nào và đang chờ API) */
  isLoading: boolean;
  /** Đang làm mới chạy ngầm hoặc người dùng nhấn nút làm mới */
  isRefreshing: boolean;
  /** Cờ cho biết dữ liệu cache hiện tại đã cũ (> 1h TTL) */
  isStale: boolean;
  /** Thời điểm làm mới thành công gần nhất */
  lastRefreshedAt: Date | null;
  /** Thông điệp lỗi nếu lần làm mới gần nhất gặp sự cố (vẫn giữ nguyên cache cũ) */
  error: string | null;
  /** Hàm kích hoạt làm mới danh sách model */
  refresh: (force?: boolean) => Promise<RegisteredModelDef[]>;
}

/**
 * Hook quản lý vòng đời phát hiện mô hình AI (Model Discovery Cache) theo chuẩn SWR:
 * 1. Render tức thời (< 5ms) từ bộ đệm (kể cả khi stale).
 * 2. Tự động làm mới chạy ngầm (Non-blocking background revalidation) khi cache hết hạn.
 * 3. Chống gọi trùng lặp (In-Flight Deduplication) giữa các component.
 * 4. Khả năng phục hồi cao: Lỗi mạng/429 không bao giờ xóa cache cũ (Zero Registry Wipe).
 */
export function useModelDiscovery(options: UseModelDiscoveryOptions = {}): UseModelDiscoveryResult {
  const { autoBackgroundRefresh = true, apiKeys } = options;

  const [models, setModels] = useState<RegisteredModelDef[]>(() => getRegisteredModels());
  const [discoveredModels, setDiscoveredModels] = useState<RegisteredModelDef[]>(() => getDiscoveredModels());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Chỉ loading ban đầu nếu chưa có bất kỳ discovered model nào trong cache
    const initialDiscovered = getDiscoveredModels();
    return initialDiscovered.length === 0;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(() => isDiscoveryStale());
  const [error, setError] = useState<string | null>(() => {
    const meta = getDiscoveredCacheMeta();
    return meta?.lastError || null;
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(() => {
    const meta = getDiscoveredCacheMeta();
    return meta?.lastRefreshedAt ? new Date(meta.lastRefreshedAt) : null;
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncStateFromStorage = useCallback(() => {
    const freshRegistered = getRegisteredModels();
    const freshDiscovered = getDiscoveredModels();
    const meta = getDiscoveredCacheMeta();

    if (isMountedRef.current) {
      setModels(freshRegistered);
      setDiscoveredModels(freshDiscovered);
      setIsStale(meta?.isStale ?? true);
      setError(meta?.lastError || null);
      if (meta?.lastRefreshedAt) {
        setLastRefreshedAt(new Date(meta.lastRefreshedAt));
      }
    }
  }, []);

  const refresh = useCallback(
    async (force: boolean = false): Promise<RegisteredModelDef[]> => {
      const hasKeys = apiKeys && apiKeys.length > 0;

      if (!hasKeys) {
        setIsLoading(false);
        setIsRefreshing(false);
        return getDiscoveredModels();
      }

      if (isMountedRef.current) {
        setIsRefreshing(true);
        setError(null);
      }

      try {
        const fetchFn = async (): Promise<ModelInfoItem[]> => {
          const validKeys = (apiKeys || []).filter((k) => typeof k === 'string' && k.trim().length > 0);
          if (validKeys.length === 0) return [];
          let lastErr: any = null;
          for (const key of validKeys) {
            try {
              const res = await listModelsDirect(key);
              if (Array.isArray(res) && res.length > 0) {
                return res;
              }
            } catch (err) {
              lastErr = err;
            }
          }
          if (lastErr) throw lastErr;
          return [];
        };

        const updatedDiscovered = await fetchAndCacheDiscoveredModels(fetchFn, { force });

        if (isMountedRef.current) {
          syncStateFromStorage();
          setIsStale(false);
          setError(null);
        }

        return updatedDiscovered;
      } catch (err: any) {
        let errMsg = err?.message || 'Lỗi khi cập nhật danh sách mô hình';
        if (
          err?.name === 'TypeError' ||
          err?.name === 'SecurityError' ||
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('NetworkError') ||
          errMsg.includes('SecurityError')
        ) {
          errMsg = 'Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).';
        }
        if (isMountedRef.current) {
          setError(errMsg);
          // Vẫn đồng bộ lại danh sách model hiện có từ storage
          syncStateFromStorage();
        }
        return getDiscoveredModels();
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
          setIsLoading(false);
        }
      }
    },
    [apiKeys, syncStateFromStorage]
  );

  // Background revalidation khi mount hoặc khi có API keys
  useEffect(() => {
    const hasCredentials = apiKeys && apiKeys.length > 0;

    if (!autoBackgroundRefresh || !hasCredentials) {
      setIsLoading(false);
      return;
    }

    const currentMeta = getDiscoveredCacheMeta();
    const shouldRefresh = !currentMeta || currentMeta.isStale;

    if (shouldRefresh) {
      refresh(false).catch(() => {
        // Lỗi chạy ngầm được ghi nhận vào state error một cách êm ái
      });
    } else {
      setIsLoading(false);
    }
  }, [autoBackgroundRefresh, apiKeys, refresh]);

  return {
    models,
    discoveredModels,
    isLoading,
    isRefreshing,
    isStale,
    lastRefreshedAt,
    error,
    refresh,
  };
}
