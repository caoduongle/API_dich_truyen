import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchQuotaStatus, 
  fetchModelsForKey, 
  KeyQuotaFullSnapshot, 
  ModelInfoItem 
} from '../utils/apiClient';
import { saveDiscoveredModels } from '../utils/modelRegistry';

export interface ModelObservabilityState {
  snapshotKeys: KeyQuotaFullSnapshot[];
  loadingQuota: boolean;
  quotaError: string | null;
  inspectResults: Record<number, ModelInfoItem[]>;
  inspectLoadingKeyIndex: number | null;
  inspectErrors: Record<number, string>;
  timezone: string;
  currentDayPST: string;
  lastUpdated: Date | null;
  loadQuotaStatus: () => Promise<void>;
  inspectKeyModels: (keyIndex: number) => Promise<void>;
  clearInspectResult: (keyIndex: number) => void;
}

export function useModelObservability(
  apiKeys: string[],
  onModelsDiscovered?: (models: ModelInfoItem[]) => void
): ModelObservabilityState {
  const [snapshotKeys, setSnapshotKeys] = useState<KeyQuotaFullSnapshot[]>([]);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const [inspectResults, setInspectResults] = useState<Record<number, ModelInfoItem[]>>({});
  const [inspectLoadingKeyIndex, setInspectLoadingKeyIndex] = useState<number | null>(null);
  const [inspectErrors, setInspectErrors] = useState<Record<number, string>>({});

  const [timezone, setTimezone] = useState<string>('America/Los_Angeles');
  const [currentDayPST, setCurrentDayPST] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const cleanKeys = apiKeys.filter(k => typeof k === 'string' && k.trim().length > 0);
  const cleanKeysKey = cleanKeys.join(',');
  const cleanKeysRef = useRef(cleanKeys);
  cleanKeysRef.current = cleanKeys;

  const onDiscoveredRef = useRef(onModelsDiscovered);
  onDiscoveredRef.current = onModelsDiscovered;

  const loadQuotaStatus = useCallback(async () => {
    const currentClean = cleanKeysRef.current;
    if (currentClean.length === 0) {
      setSnapshotKeys([]);
      return;
    }

    setLoadingQuota(true);
    setQuotaError(null);
    try {
      const data = await fetchQuotaStatus(currentClean);
      setSnapshotKeys(data.keys || []);
      setTimezone(data.timezone || 'America/Los_Angeles');
      setCurrentDayPST(data.currentDayPST || '');
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[useModelObservability] Error loading quota:', err);
      setQuotaError(err.message || 'Không thể tải thông tin hạn ngạch.');
    } finally {
      setLoadingQuota(false);
    }
  }, []);

  useEffect(() => {
    loadQuotaStatus();
  }, [cleanKeysKey, loadQuotaStatus]);

  // Bộ đếm lùi thời gian ngắt mạch / hoãn rate limit theo từng giây
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotKeys(prev => {
        let changed = false;
        const next = prev.map(item => {
          let blacklistMs = item.runtime.blacklistRemainingMs;
          let rateLimitMs = item.runtime.nextAllowedRemainingMs;

          if (blacklistMs > 0 || rateLimitMs > 0) {
            changed = true;
            blacklistMs = Math.max(0, blacklistMs - 1000);
            rateLimitMs = Math.max(0, rateLimitMs - 1000);
            return {
              ...item,
              runtime: {
                ...item.runtime,
                isBlacklisted: blacklistMs > 0,
                blacklistRemainingMs: blacklistMs,
                isRateLimited: rateLimitMs > 0,
                nextAllowedRemainingMs: rateLimitMs,
              },
            };
          }
          return item;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const inspectKeyModels = useCallback(async (keyIndex: number) => {
    const currentClean = cleanKeysRef.current;
    setInspectLoadingKeyIndex(keyIndex);
    setInspectErrors(prev => ({ ...prev, [keyIndex]: '' }));

    try {
      const res = await fetchModelsForKey(keyIndex, currentClean);
      const models = res.models || [];
      setInspectResults(prev => ({ ...prev, [keyIndex]: models }));

      // Tự động lưu và kích hoạt callback đăng ký model khám phá
      if (models.length > 0) {
        saveDiscoveredModels(models);
        if (onDiscoveredRef.current) {
          onDiscoveredRef.current(models);
        }
      }
    } catch (err: any) {
      setInspectErrors(prev => ({ ...prev, [keyIndex]: err.message || 'Lỗi kiểm tra model' }));
    } finally {
      setInspectLoadingKeyIndex(null);
    }
  }, []);

  const clearInspectResult = useCallback((keyIndex: number) => {
    setInspectResults(prev => ({ ...prev, [keyIndex]: [] }));
  }, []);

  return {
    snapshotKeys,
    loadingQuota,
    quotaError,
    inspectResults,
    inspectLoadingKeyIndex,
    inspectErrors,
    timezone,
    currentDayPST,
    lastUpdated,
    loadQuotaStatus,
    inspectKeyModels,
    clearInspectResult,
  };
}
