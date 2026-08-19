import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Settings2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Seal } from './ui/Seal';
import { EmptyState } from './ui/EmptyState';
import { useModelObservability, ModelObservabilityState } from '../hooks/useModelObservability';
import { computeModelStatsSummary, getKeyModelStats, normalizeModelId } from '../utils/modelRegistry';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../utils/apiClient';

const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

export interface CustomLimit {
  maxRpm: number;
  maxRpd: number;
}

export interface CountdownBadgeProps {
  remainingMs: number;
  type: 'blacklist' | 'rateLimit';
  className?: string;
}

/**
 * Component lá đếm lùi thời gian ngắt mạch / hoãn rate limit.
 * Tự quản lý interval 1s nội bộ, hoàn toàn cách ly và không gây re-render component cha.
 */
export const CountdownBadge = React.memo(function CountdownBadge({
  remainingMs,
  type,
  className,
}: CountdownBadgeProps) {
  const [timeLeftMs, setTimeLeftMs] = useState(remainingMs);
  const targetTimeRef = useRef(Date.now() + remainingMs);

  useEffect(() => {
    targetTimeRef.current = Date.now() + remainingMs;
    setTimeLeftMs(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (timeLeftMs <= 0) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, targetTimeRef.current - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeftMs]);

  if (timeLeftMs <= 0) {
    return (
      <Badge tone="polish" className={className}>
        <CheckCircle2 className="w-3 h-3 text-polish" />
        Hoạt động
      </Badge>
    );
  }

  const formatRemainingTime = (ms: number) => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}p ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (type === 'blacklist') {
    return (
      <Badge tone="warning" className={`animate-pulse ${className || ''}`}>
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Ngắt mạch ({formatRemainingTime(timeLeftMs)})
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className={className}>
      <Clock className="w-3 h-3 text-text-muted" />
      Đang hoãn ({formatRemainingTime(timeLeftMs)})
    </Badge>
  );
});

export interface KeyCardItemProps {
  item: KeyQuotaFullSnapshot;
  idx: number;
  limit: CustomLimit;
  selectedModel: string;
  selectedModelDisplayName: string;
  isExpanded: boolean;
  isInspecting: boolean;
  inspectData?: ModelInfoItem[];
  inspectErr?: string;
  onInspect: (idx: number) => void;
  onClearInspect: (idx: number) => void;
  onToggleExpand: (idx: number) => void;
  onSelectModel?: (model: string) => void;
}

/**
 * Thẻ hiển thị thông tin 1 API Key, bọc React.memo để ngăn re-render không cần thiết.
 */
export const KeyCardItem = React.memo(function KeyCardItem({
  item,
  idx,
  limit,
  selectedModel,
  selectedModelDisplayName,
  isExpanded,
  isInspecting,
  inspectData,
  inspectErr,
  onInspect,
  onClearInspect,
  onToggleExpand,
  onSelectModel,
}: KeyCardItemProps) {
  const rpmPercent = Math.min(100, Math.round((item.requestsThisMinute / limit.maxRpm) * 100));
  const rpdPercent = Math.min(100, Math.round((item.requestsToday / limit.maxRpd) * 100));

  const isBlacklisted = item.runtime?.isBlacklisted && (item.runtime.blacklistRemainingMs || 0) > 0;
  const isRateLimited = item.runtime?.isRateLimited && (item.runtime.nextAllowedRemainingMs || 0) > 0;

  const keyModelStats = getKeyModelStats(item, selectedModel);
  const normSelected = normalizeModelId(selectedModel);

  return (
    <div className="border border-parchment-2 bg-ink rounded-[2px] p-3.5 space-y-3 transition-colors hover:border-parchment-2/80">
      {/* Top row: Key title, masked key & Status badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-main">
            Khóa #{idx + 1}
          </span>
          <span className="font-mono text-xs text-text-muted bg-parchment-2/30 px-2 py-0.5 rounded-[2px] border border-parchment-2">
            {item.maskedKey}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isBlacklisted ? (
            <CountdownBadge 
              remainingMs={item.runtime.blacklistRemainingMs} 
              type="blacklist" 
            />
          ) : isRateLimited ? (
            <CountdownBadge 
              remainingMs={item.runtime.nextAllowedRemainingMs} 
              type="rateLimit" 
            />
          ) : (
            <Badge tone="polish">
              <CheckCircle2 className="w-3 h-3 text-polish" />
              Hoạt động
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onInspect(idx)}
            disabled={isInspecting}
            className="py-0.5 text-[11px] h-6"
            icon={<Sparkles className="w-3 h-3 text-polish" />}
          >
            {isInspecting ? 'Đang kiểm tra...' : inspectData && inspectData.length > 0 ? 'Kiểm tra lại' : 'Kiểm tra Model'}
          </Button>
        </div>
      </div>

      {/* Model đang dùng trên riêng key này */}
      <div className="bg-parchment-2/15 border border-parchment-2/70 rounded-[2px] px-2.5 py-1.5 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Model đang dùng:</span>
          <span className="text-text-main font-semibold">{selectedModelDisplayName.split('(')[0].trim()}</span>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[11px] text-text-muted">
          <span>RPM: <strong className="text-text-main">{keyModelStats.requestsThisMinute}</strong></span>
          <span>Hôm nay: <strong className="text-text-main">{keyModelStats.requestsToday}</strong></span>
          <span>Tổng: <strong className="text-text-main">{keyModelStats.requestsTotal}</strong></span>
          {keyModelStats.errorsTotal > 0 && (
            <span className="text-polish font-bold">Lỗi: {keyModelStats.errorsTotal}</span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng RPM Key</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {item.requestsThisMinute} <span className="text-[10px] text-text-muted font-normal">/ {limit.maxRpm}</span>
          </div>
          {/* RPM Progress bar */}
          <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${rpmPercent >= 90 ? 'bg-polish' : rpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
              style={{ width: `${rpmPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng RPD Key (PST)</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {item.requestsToday} <span className="text-[10px] text-text-muted font-normal">/ {limit.maxRpd}</span>
          </div>
          {/* RPD Progress bar */}
          <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${rpdPercent >= 90 ? 'bg-polish' : rpdPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
              style={{ width: `${rpdPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng Request Key</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {item.requestsTotal}
          </div>
          <div className="text-[9px] text-text-muted mt-1">Tất cả model</div>
        </div>

        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng Lỗi Key</div>
          <div className={`text-sm font-mono font-bold mt-0.5 ${item.errorsTotal > 0 ? 'text-polish' : 'text-text-main'}`}>
            {item.errorsTotal}
          </div>
          <div className="text-[9px] text-text-muted mt-1">429 / 503 / Safety</div>
        </div>
      </div>

      {/* Inspect Models Result if triggered */}
      {inspectErr && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-[2px] p-2 text-xs text-amber-300">
          {inspectErr}
        </div>
      )}

      {inspectData && inspectData.length > 0 && (
        <div className="bg-ink/90 border border-parchment-2 rounded-[2px] p-2.5 space-y-1.5 text-xs">
          <div className="font-bold text-text-main flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-polish" />
              Google Model List khả dụng ({inspectData.length} models):
            </span>
            <button 
              onClick={() => onClearInspect(idx)}
              className="text-[10px] text-text-muted hover:text-text-main underline cursor-pointer"
            >
              Ẩn
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {inspectData.map(m => {
              const cleanModelId = m.name.replace(/^models\//i, '');
              const isThisSelected = normalizeModelId(m.name) === normSelected;
              return (
                <div 
                  key={m.name} 
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-[2px] border ${
                    isThisSelected 
                      ? 'bg-polish/10 border-polish/40 font-semibold' 
                      : 'bg-parchment-2/20 border-transparent hover:border-parchment-2'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isThisSelected ? 'text-polish' : 'text-text-muted'}`} />
                    <span className={`font-mono text-[11px] truncate ${isThisSelected ? 'text-polish font-bold' : 'text-text-main'}`}>
                      {cleanModelId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-muted truncate max-w-[140px] hidden sm:inline-block">
                      {m.displayName}
                    </span>
                    {isThisSelected ? (
                      <span className="text-[9px] bg-polish text-white px-1.5 py-0.5 rounded-[2px] font-bold">
                        Đang chọn
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectModel?.(cleanModelId)}
                        className="text-[10px] font-bold text-polish hover:text-white bg-polish/10 hover:bg-polish px-2 py-0.5 rounded-[2px] transition-colors cursor-pointer"
                        title="Áp dụng model này ngay lập tức cho dịch thuật"
                      >
                        Dùng model này
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By Model Breakdown Accordion */}
      {Object.keys(item.byModel || {}).length > 0 && (
        <div className="border-t border-parchment-2 pt-2">
          <button
            type="button"
            onClick={() => onToggleExpand(idx)}
            className="flex items-center justify-between w-full text-left text-[11px] font-semibold text-text-muted hover:text-text-main cursor-pointer"
          >
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-polish" />
              Chi tiết sử dụng theo từng Model ({Object.keys(item.byModel).length})
            </span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-1.5">
              {Object.entries(item.byModel).map(([modelId, mStats]) => (
                <div 
                  key={modelId}
                  className="flex items-center justify-between bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] px-2.5 py-1.5 text-xs font-mono"
                >
                  <span className="text-text-main text-[11px] font-semibold">
                    {modelId.replace('models/', '')}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    <span>RPM: <strong className="text-text-main">{mStats.requestsThisMinute}</strong></span>
                    <span>RPD: <strong className="text-text-main">{mStats.requestsToday}</strong></span>
                    <span>Tổng: <strong className="text-text-main">{mStats.requestsTotal}</strong></span>
                    {mStats.errorsTotal > 0 && (
                      <span className="text-polish font-bold">Lỗi: {mStats.errorsTotal}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export interface CustomLimitsPanelProps {
  snapshotKeys: KeyQuotaFullSnapshot[];
  customLimits: Record<string, CustomLimit>;
  onUpdateLimit: (keyHash: string, field: 'maxRpm' | 'maxRpd', value: number) => void;
}

/**
 * Bảng cấu hình giới hạn người dùng tự đặt, bọc React.memo
 */
export const CustomLimitsPanel = React.memo(function CustomLimitsPanel({
  snapshotKeys,
  customLimits,
  onUpdateLimit,
}: CustomLimitsPanelProps) {
  return (
    <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-3.5 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
        <Settings2 className="w-3.5 h-3.5 text-polish" />
        Cấu hình Ngưỡng Hạn ngạch Người dùng Tự đặt
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Thiết lập ngưỡng RPM (Request / Phút) và RPD (Request / Ngày) để hiển thị thanh tiến độ phần trăm trực quan trên từng key.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || { maxRpm: 15, maxRpd: 1500 };
          return (
            <div key={item.keyHash || idx} className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
              <div className="text-[11px] font-bold text-text-main flex items-center justify-between">
                <span>Khóa #{idx + 1}</span>
                <span className="font-mono text-text-muted text-[10px]">{item.maskedKey}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-text-muted block mb-0.5">Giới hạn RPM:</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={limit.maxRpm}
                    onChange={e => onUpdateLimit(item.keyHash, 'maxRpm', parseInt(e.target.value, 10))}
                    className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-0.5">Giới hạn RPD:</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={limit.maxRpd}
                    onChange={e => onUpdateLimit(item.keyHash, 'maxRpd', parseInt(e.target.value, 10))}
                    className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

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
  const internalObservability = useModelObservability(apiKeys);
  const obs = externalObservability || internalObservability;

  const {
    snapshotKeys,
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
  } = obs;

  // Accordion state cho breakdown từng model trong key
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());

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

  const toggleModelExpand = useCallback((index: number) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleUpdateLimit = useCallback((keyHash: string, field: 'maxRpm' | 'maxRpd', value: number) => {
    setCustomLimits(prev => {
      const current = prev[keyHash] || { maxRpm: 15, maxRpd: 1500 };
      const next = {
        ...prev,
        [keyHash]: {
          ...current,
          [field]: Math.max(1, value || 1),
        },
      };
      try {
        localStorage.setItem(CUSTOM_LIMITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    loadQuotaStatus(true); // Force refresh bỏ qua cache 30s
  }, [loadQuotaStatus]);

  const modelSummary = computeModelStatsSummary(
    selectedModel,
    snapshotKeys,
    inspectResults,
    cleanKeys.length
  );

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

        <div className="flex items-center gap-2">
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
            {modelSummary.hasChecked ? (
              modelSummary.isUnavailable ? (
                <Badge tone="warning" className="animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  0 / {cleanKeys.length} key khả dụng
                </Badge>
              ) : (
                <Badge tone="polish">
                  <CheckCircle2 className="w-3 h-3 text-polish" />
                  {modelSummary.availableKeyCount} / {cleanKeys.length} key khả dụng
                </Badge>
              )
            ) : (
              <Badge tone="neutral">
                <Clock className="w-3 h-3 text-text-muted" />
                Chưa kiểm tra key
              </Badge>
            )}
          </div>
        </div>

        {modelSummary.isUnavailable && (
          <div className="bg-amber-950/40 border border-amber-800/70 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Model đang chọn hiện không có API key khả dụng trong số các key đã kiểm tra. Hãy kiểm tra lại các key bên dưới hoặc đổi model trong tab Cấu hình.</span>
          </div>
        )}

        {/* 4 Metric Tiles for Currently Selected Model */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RPM Hiện tại</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {modelSummary.requestsThisMinute}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">Tất cả các key</div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Request hôm nay (PST)</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {modelSummary.requestsToday}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">Tính theo múi giờ PST</div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tổng Request</div>
            <div className="text-sm font-mono font-bold text-text-main mt-0.5">
              {modelSummary.totalRequests}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">Lũy kế phiên làm việc</div>
          </div>

          <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
            <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Lỗi phát sinh</div>
            <div className={`text-sm font-mono font-bold mt-0.5 ${modelSummary.errorsTotal > 0 ? 'text-polish' : 'text-text-main'}`}>
              {modelSummary.errorsTotal}
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">429 / 503 / Safety</div>
          </div>
        </div>
      </div>

      {/* Global Limit Settings Panel */}
      {showLimitSettings && (
        <CustomLimitsPanel
          snapshotKeys={snapshotKeys}
          customLimits={customLimits}
          onUpdateLimit={handleUpdateLimit}
        />
      )}

      {/* List of Keys Quota Cards */}
      <div className="space-y-3">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || { maxRpm: 15, maxRpd: 1500 };
          return (
            <KeyCardItem
              key={item.keyHash || idx}
              item={item}
              idx={idx}
              limit={limit}
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
            />
          );
        })}
      </div>
    </div>
  );
}

export default QuotaPanel;
