import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchModelsForKey, 
  KeyQuotaFullSnapshot, 
  QuotaGroupDisplayItem,
  ModelInfoItem,
  QuotaStatusResponse,
  LogicalSummaryStats
} from '../utils/apiClient';
import { saveDiscoveredModels } from '../utils/modelRegistry';
import { localQuotaTracker } from '../services/localQuotaTracker';

export interface ModelObservabilityState {
  snapshotKeys: KeyQuotaFullSnapshot[];
  groups: QuotaGroupDisplayItem[];
  summary: LogicalSummaryStats | null;
  loadingQuota: boolean;
  quotaError: string | null;
  inspectResults: Record<number, ModelInfoItem[]>;
  inspectLoadingKeyIndex: number | null;
  inspectErrors: Record<number, string>;
  timezone: string;
  currentDayPST: string;
  lastUpdated: Date | null;
  loadQuotaStatus: (forceRefresh?: boolean) => Promise<void>;
  inspectKeyModels: (keyIndex: number) => Promise<void>;
  clearInspectResult: (keyIndex: number) => void;
}

interface QuotaCacheEntry {
  data: QuotaStatusResponse;
  timestamp: number;
  keysKey: string;
}

let globalQuotaCache: QuotaCacheEntry | null = null;
export const QUOTA_CACHE_TTL_MS = 30_000;

export function clearQuotaCache(): void {
  globalQuotaCache = null;
}

export function useModelObservability(
  apiKeys: string[],
  onModelsDiscovered?: (models: ModelInfoItem[]) => void
): ModelObservabilityState {
  const [snapshotKeys, setSnapshotKeys] = useState<KeyQuotaFullSnapshot[]>([]);
  const [groups, setGroups] = useState<QuotaGroupDisplayItem[]>([]);
  const [summary, setSummary] = useState<LogicalSummaryStats | null>(null);
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

  const loadQuotaStatus = useCallback(async (_forceRefresh: boolean = false) => {
    const currentClean = cleanKeysRef.current;
    if (currentClean.length === 0) {
      setSnapshotKeys([]);
      setGroups([]);
      setSummary(null);
      return;
    }

    setLoadingQuota(true);
    setQuotaError(null);
    try {
      const data = localQuotaTracker.getQuotaStatus(currentClean);
      setSnapshotKeys(data.keys || []);
      setGroups(data.groups || []);
      setSummary(data.summary || null);
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
    groups,
    summary,
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
