import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Settings2,
  Clock,
  Zap,
  Unlock
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Seal } from './ui/Seal';
import { EmptyState } from './ui/EmptyState';
import { useModelObservability, ModelObservabilityState } from '../hooks/useModelObservability';
import { 
  computeModelStatsSummary, 
  formatTokenCount, 
  formatPacingSummary,
  getModelDefinition,
  getModelReferenceLimits,
} from '../utils/modelRegistry';
import { saveStoredCustomLimits } from '../utils/customLimitsStorage';

import {
  CountdownBadge,
  CountdownBadgeProps,
} from './quota-panel/CountdownBadge';

import {
  CustomLimit,
  DEFAULT_CUSTOM_LIMIT,
  CustomLimitsPanel,
  formatClientMaskedKey,
} from './quota-panel/CustomLimitsPanel';

import {
  KeyCardItem,
} from './quota-panel/KeyCardItem';

import {
  GroupQuotaCard,
} from './quota-panel/GroupQuotaCard';

export type { CustomLimit, CountdownBadgeProps };
export { CountdownBadge, DEFAULT_CUSTOM_LIMIT, CustomLimitsPanel, KeyCardItem, GroupQuotaCard, formatClientMaskedKey };

const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

interface QuotaPanelProps {
  apiKeys: string[];
  selectedModel: string;
  onSelectModel?: (model: string) => void;
  onSwitchToConfigTab?: () => void;
  observability?: ModelObservabilityState;
}

export function QuotaPanel({ 
  apiKeys, 
  selectedModel, 
  onSelectModel,
  onSwitchToConfigTab,
  observability: externalObservability,
}: QuotaPanelProps) {
  // Sử dụng observability state truyền từ ApiSettings (hoặc tạo hook nội bộ nếu chạy độc lập)
  const internalObservability = useModelObservability(apiKeys, undefined, {
    enabled: !externalObservability,
    selectedModel,
  });
  const obs = externalObservability || internalObservability;

  const {
    snapshotKeys,
    groups: _groups,
    summary,
    loadingQuota: loading,
    quotaError: error,
    inspectResults,
    inspectLoadingKeyIndex,
    inspectErrors,
    timezone,
    currentDayPST,
    lastUpdated,
    loadQuotaStatus,
    inspectKeyModels,
    clearInspectResult,
    unlockKey,
    unlockAllKeys,
  } = obs;

  // Accordion state cho breakdown từng model trong key
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);

  // Custom User Limits
  const [customLimits, setCustomLimits] = useState<Record<string, CustomLimit>>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_LIMITS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showLimitSettings, setShowLimitSettings] = useState(false);

  const cleanKeys = apiKeys.filter(k => typeof k === 'string' && k.trim().length > 0);
  const referenceLimit = useMemo(() => getModelReferenceLimits(selectedModel), [selectedModel]);
  const customLimitsRef = useRef(customLimits);
  customLimitsRef.current = customLimits;

  const toggleModelExpand = useCallback((index: number) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleUpdateLimit = useCallback((keyHash: string, field: 'maxRpm' | 'maxRpd' | 'maxTpm', value: number) => {
    setUnlockNotice(null);
    const prevLimits = customLimitsRef.current;
    const current = prevLimits[keyHash] || referenceLimit;
    const next = {
      ...prevLimits,
      [keyHash]: {
        ...current,
        [field]: Math.max(1, value || 1),
      },
    };
    customLimitsRef.current = next;
    setCustomLimits(next);
    saveStoredCustomLimits(next);
    void loadQuotaStatus(true);
  }, [referenceLimit, loadQuotaStatus]);

  const handleRefresh = useCallback(() => {
    loadQuotaStatus(true); // Force refresh bỏ qua cache 30s
  }, [loadQuotaStatus]);

  const handleUnlockSingle = useCallback((idx: number) => {
    const res = unlockKey(idx, selectedModel);
    if (res.blockedByCustomLimit) {
      setUnlockNotice(
        res.remainingCustomCooldownReason ||
          'Khóa đã xóa cờ lỗi nhưng vẫn chạm ngưỡng Max RPD cá nhân. Hãy tăng Max RPD trong Ngưỡng cá nhân nếu muốn dùng tiếp.'
      );
    } else {
      setUnlockNotice(null);
    }
  }, [unlockKey, selectedModel]);

  const handleUnlockAll = useCallback(() => {
    const res = unlockAllKeys(selectedModel);
    if (res.customBlockedCount > 0) {
      setUnlockNotice(
        `Đã xóa cờ lỗi cho các khóa; vẫn còn ${res.customBlockedCount} khóa chạm ngưỡng Max RPD tự đặt (điều chỉnh tại Ngưỡng cá nhân nếu cần).`
      );
    } else {
      setUnlockNotice(null);
    }
  }, [unlockAllKeys, selectedModel]);

  const modelSummary = computeModelStatsSummary(
    selectedModel,
    snapshotKeys,
    inspectResults,
    cleanKeys.length
  );

  const unlockableCount = snapshotKeys.filter((item) => {
    const h = item.runtime?.healthState ?? item.healthState;
    return h === 'QuotaExhausted' || h === 'RateLimited' || h === 'Cooldown' || h === 'Degraded';
  }).length;

  const effectiveAvailableCount = modelSummary.hasChecked
    ? Math.min(modelSummary.availableKeyCount, modelSummary.runtimeAvailableKeyCount)
    : modelSummary.runtimeAvailableKeyCount;
  const isAllRuntimeBlocked = snapshotKeys.length > 0 && modelSummary.runtimeAvailableKeyCount === 0;

  if (cleanKeys.length === 0) {
    return (
      <EmptyState
        icon={<Seal character="限" tone="polish" size="md" />}
        title="Chưa có API key nào"
        description="Hãy thêm ít nhất một Gemini API Key trong tab Cấu hình để xem báo cáo hạn mức và thống kê số lượng request."
        action={
          onSwitchToConfigTab ? (
            <Button variant="primary" size="sm" onClick={onSwitchToConfigTab}>
              Đến tab Cấu hình
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header controls & summary */}
      <div className="flex items-center justify-between bg-ink/60 border border-parchment-2 rounded-[2px] p-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Seal character="限" tone="polish" size="sm" />
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">
              Theo dõi Hạn mức API &amp; Quota
            </h3>
          </div>
          <p className="text-[11px] text-text-muted flex items-center gap-2 flex-wrap">
            <span>Múi giờ chuẩn: <span className="font-mono text-text-main">{timezone}</span> (Ngày: <span className="font-mono text-text-main">{currentDayPST || 'Hôm nay'}</span>)</span>
            {lastUpdated && (
              <span>• Cập nhật: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unlockableCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlockAll}
              icon={<Unlock className="w-3.5 h-3.5 text-polish" />}
            >
              Mở khóa tất cả ({unlockableCount})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLimitSettings(!showLimitSettings)}
            icon={<Settings2 className="w-3.5 h-3.5" />}
          >
            {showLimitSettings ? 'Đóng cấu hình' : 'Ngưỡng cá nhân'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            icon={<RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-polish' : ''}`} />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {unlockNotice && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{unlockNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUnlockNotice(null)}
            className="text-[11px] text-amber-400 hover:text-amber-100 underline cursor-pointer shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {error && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP OVERVIEW BANNER: MODEL ĐANG SỬ DỤNG */}
      <div className="bg-ink border-2 border-polish/40 rounded-[2px] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-polish/10 border border-polish/30 rounded-[2px]">
              <Cpu className="w-4 h-4 text-polish" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                Mô hình đang sử dụng
              </div>
              <div className="text-xs font-bold text-text-main font-serif">
                {modelSummary.displayName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAllRuntimeBlocked || modelSummary.isUnavailable ? (
              <Badge tone="warning">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                0 / {cleanKeys.length} key khả dụng
              </Badge>
            ) : modelSummary.hasChecked || snapshotKeys.length > 0 ? (
              <Badge tone={effectiveAvailableCount < cleanKeys.length ? 'warning' : 'polish'}>
                {effectiveAvailableCount < cleanKeys.length ? (
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-polish" />
                )}
                {effectiveAvailableCount} / {cleanKeys.length} key khả dụng
              </Badge>
            ) : cleanKeys.length > 0 && getModelDefinition(selectedModel)?.source === 'preset' ? (
              <Badge tone="polish">
                <CheckCircle2 className="w-3 h-3 text-polish" />
                Sẵn sàng sử dụng
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Clock className="w-3 h-3 text-text-muted" />
                Chưa kiểm tra key
              </Badge>
            )}
          </div>
        </div>

        {(modelSummary.isUnavailable || isAllRuntimeBlocked) && (
          <div className="bg-amber-950/40 border border-amber-800/70 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {modelSummary.isUnavailable
                ? 'Model đang chọn hiện không có API key khả dụng trong số các key đã kiểm tra. Hãy kiểm tra lại các key bên dưới hoặc đổi model trong tab Cấu hình.'
                : `Toàn bộ API key hiện không khả dụng trên mô hình ${modelSummary.displayName}. Hãy chuyển sang mô hình khác ở tab Cấu hình hoặc bấm Mở khóa nếu khóa vừa được khôi phục hạn mức.`}
            </span>
          </div>
        )}

        {(() => {
          const firstLimit = Object.values(customLimits)[0];
          const bannerPacing = formatPacingSummary(firstLimit?.maxRpm, selectedModel);
          return (
            <div className="bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] px-2.5 py-1 flex items-center justify-between text-[11px] text-text-muted flex-wrap gap-1">
              <span className="flex items-center gap-1 font-medium">
                <Zap className="w-3 h-3 text-polish" />
                <span>Nhịp độ điều phối: <strong className="text-text-main">~{bannerPacing.estimatedRpm} req/phút</strong> (~{bannerPacing.intervalSec}/lần gọi)</span>
              </span>
              <span className="text-[10px] text-text-muted italic">
                {bannerPacing.isCustom ? 'Tối ưu theo Max RPM cá nhân' : 'Mặc định theo tier model'}
              </span>
            </div>
          );
        })()}

        {/* 4 Metric Tiles: Logical Translations, Provider Attempts, Retries, TPM */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Yêu cầu dịch (Logical)</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {summary ? summary.logicalRequestsToday : modelSummary.requestsToday} <span className="text-[10px] text-text-muted font-normal">hôm nay</span>
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">
              {summary ? `${summary.successfulRequestsTotal} thành công / ${summary.logicalRequestsTotal} tổng` : `${modelSummary.totalRequests} tổng`}
            </div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Lượt gọi API (Provider)</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {summary ? summary.providerAttemptsToday : modelSummary.requestsToday} <span className="text-[10px] text-text-muted font-normal">lượt</span>
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">
              {summary ? `${summary.providerAttemptsTotal} tổng lượt gọi` : `${modelSummary.requestsThisMinute} RPM (60s)`}
            </div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Lượt thử lại (Retries)</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {summary ? summary.retriesToday : modelSummary.errorsTotal} <span className="text-[10px] text-text-muted font-normal">lần</span>
            </div>
            <div className={`text-[9px] mt-0.5 ${summary && summary.retriesTotal > 0 ? 'text-amber-400 font-bold' : 'text-text-muted'}`}>
              {summary ? `${summary.retriesTotal} tổng lần xoay key` : `${modelSummary.errorsTotal} lỗi`}
            </div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center justify-center gap-1">
              <Zap className="w-2.5 h-2.5 text-polish" /> TPM Hiện tại (60s)
            </div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {formatTokenCount(modelSummary.tokensThisMinute)}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">
              {formatTokenCount(modelSummary.tokensToday)} hôm nay / {formatTokenCount(modelSummary.totalTokens)} tổng
            </div>
          </div>
        </div>
      </div>

      {/* Global Limit Settings Panel */}
      {showLimitSettings && (
        <CustomLimitsPanel
          snapshotKeys={snapshotKeys}
          customLimits={customLimits}
          apiKeys={cleanKeys}
          selectedModel={selectedModel}
          onUpdateLimit={handleUpdateLimit}
        />
      )}


      {/* List of Keys Quota Cards */}
      <div className="space-y-3">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || referenceLimit;
          return (
            <KeyCardItem
              key={item.keyHash || idx}
              item={item}
              idx={idx}
              limit={limit}
              rawKey={cleanKeys[idx]}
              selectedModel={selectedModel}
              selectedModelDisplayName={modelSummary.displayName}
              isExpanded={expandedModels.has(idx)}
              isInspecting={inspectLoadingKeyIndex === idx}
              inspectData={inspectResults[idx]}
              inspectErr={inspectErrors[idx]}
              onInspect={inspectKeyModels}
              onClearInspect={clearInspectResult}
              onToggleExpand={toggleModelExpand}
              onSelectModel={onSelectModel}
              onUnlockKey={handleUnlockSingle}
            />
          );
        })}
      </div>
    </div>
  );
}

export default QuotaPanel;
