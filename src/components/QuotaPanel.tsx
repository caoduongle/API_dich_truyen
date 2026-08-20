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
  ChevronUp,
  Zap
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Seal } from './ui/Seal';
import { EmptyState } from './ui/EmptyState';
import { useModelObservability, ModelObservabilityState } from '../hooks/useModelObservability';
import { computeModelStatsSummary, getKeyModelStats, normalizeModelId, formatTokenCount, formatPacingSummary } from '../utils/modelRegistry';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../utils/apiClient';

const CUSTOM_LIMITS_STORAGE_KEY = 'gemini_quota_custom_limits';

export interface CustomLimit {
  maxRpm: number;
  maxRpd: number;
  maxTpm: number;
}

export const DEFAULT_CUSTOM_LIMIT: CustomLimit = {
  maxRpm: 15,
  maxRpd: 1500,
  maxTpm: 1000000,
};

export interface CountdownBadgeProps {
  remainingMs: number;
  type?: 'blacklist' | 'rateLimit' | 'cooldown';
  label?: string;
  reason?: string;
  className?: string;
}

/**
 * Component lá đếm lùi thời gian tạm dừng / hoãn rate limit.
 * Tự quản lý interval 1s nội bộ, hoàn toàn cách ly và không gây re-render component cha.
 */
export const CountdownBadge = React.memo(function CountdownBadge({
  remainingMs,
  type = 'cooldown',
  reason,
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
      <Badge tone="polish" className={className} title={reason}>
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

  if (type === 'cooldown' || type === 'blacklist') {
    return (
      <Badge tone="warning" className={`animate-pulse ${className || ''}`} title={reason}>
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Tạm dừng ({formatRemainingTime(timeLeftMs)})
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className={className} title={reason}>
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
  const safeLimit = limit || DEFAULT_CUSTOM_LIMIT;
  const tokensThisMinute = item.tokensThisMinute || 0;
  const tokensToday = item.tokensToday || 0;
  const tokensTotal = item.tokensTotal || 0;

  const rpmPercent = Math.min(100, Math.round((item.requestsThisMinute / safeLimit.maxRpm) * 100));
  const rpdPercent = Math.min(100, Math.round((item.requestsToday / safeLimit.maxRpd) * 100));
  const tpmPercent = Math.min(100, Math.round((tokensThisMinute / safeLimit.maxTpm) * 100));

  const keyModelStats = getKeyModelStats(item, selectedModel);
  const normSelected = normalizeModelId(selectedModel);

  const healthState = item.runtime?.healthState;
  const reason = item.runtime?.transitionReason;

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
          {(() => {
            if (healthState === 'AuthFailed') {
              return (
                <Badge tone="neutral" className="border-red-500/40 text-red-400 bg-red-950/20" title={reason}>
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  Khóa không hợp lệ
                </Badge>
              );
            }
            if (healthState === 'QuotaExhausted') {
              return (
                <Badge tone="warning" title={reason}>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Hết hạn mức ngày
                </Badge>
              );
            }
            if (healthState === 'Disabled') {
              return (
                <Badge tone="neutral" title={reason}>
                  <Clock className="w-3 h-3 text-text-muted" />
                  Tạm dừng
                </Badge>
              );
            }
            if (healthState === 'Degraded') {
              return (
                <Badge tone="warning" title={reason}>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Hiệu năng giảm
                </Badge>
              );
            }
            if (healthState === 'RateLimited' || (item.runtime?.isRateLimited && (item.runtime.nextAllowedRemainingMs || 0) > 0)) {
              const cd = item.runtime?.blacklistRemainingMs || item.runtime?.nextAllowedRemainingMs || 0;
              return (
                <CountdownBadge 
                  remainingMs={cd} 
                  type="rateLimit" 
                  reason={reason}
                />
              );
            }
            if (healthState === 'Cooldown' || (item.runtime?.isBlacklisted && (item.runtime?.blacklistRemainingMs || 0) > 0)) {
              return (
                <CountdownBadge 
                  remainingMs={item.runtime?.blacklistRemainingMs || 0} 
                  type="cooldown" 
                  reason={reason}
                />
              );
            }
            return (
              <Badge tone="polish" title={reason}>
                <CheckCircle2 className="w-3 h-3 text-polish" />
                Hoạt động
              </Badge>
            );
          })()}

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
          <span>TPM: <strong className="text-text-main">{formatTokenCount(keyModelStats.tokensThisMinute)}</strong></span>
          <span>Hôm nay: <strong className="text-text-main">{keyModelStats.requestsToday}</strong> reqs ({formatTokenCount(keyModelStats.tokensToday)} tok)</span>
          {keyModelStats.errorsTotal > 0 && (
            <span className="text-polish font-bold">Lỗi: {keyModelStats.errorsTotal}</span>
          )}
        </div>
      </div>

      {/* Metrics Grid with Sliding Window RPM & TPM Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {/* RPM Gauge */}
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RPM (60s)</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {item.requestsThisMinute} <span className="text-[10px] text-text-muted font-normal">/ {safeLimit.maxRpm}</span>
          </div>
          <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${rpmPercent >= 90 ? 'bg-polish' : rpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
              style={{ width: `${rpmPercent}%` }}
            />
          </div>
        </div>

        {/* TPM Gauge */}
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center justify-center gap-1">
            <Zap className="w-2.5 h-2.5 text-polish" /> TPM (60s)
          </div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {formatTokenCount(tokensThisMinute)} <span className="text-[10px] text-text-muted font-normal">/ {formatTokenCount(safeLimit.maxTpm)}</span>
          </div>
          <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${tpmPercent >= 90 ? 'bg-polish' : tpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
              style={{ width: `${tpmPercent}%` }}
            />
          </div>
        </div>

        {/* RPD Gauge */}
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Lượt gọi API Hôm nay</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {item.requestsToday} <span className="text-[10px] text-text-muted font-normal">/ {safeLimit.maxRpd}</span>
          </div>
          <div className="w-full bg-parchment-2 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${rpdPercent >= 90 ? 'bg-polish' : rpdPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
              style={{ width: `${rpdPercent}%` }}
            />
          </div>
        </div>

        {/* Tokens Today / Total */}
        <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-2">
          <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Token Hôm nay / Tổng</div>
          <div className="text-sm font-mono font-bold text-text-main mt-0.5">
            {formatTokenCount(tokensToday)} <span className="text-[10px] text-text-muted font-normal">/ {formatTokenCount(tokensTotal)}</span>
          </div>
          <div className="text-[9px] text-text-muted mt-1">
            {item.errorsTotal > 0 ? (
              <span className="text-polish font-bold">{item.errorsTotal} lỗi phát sinh</span>
            ) : (
              '0 lỗi phát sinh'
            )}
          </div>
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
                  <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                    <span>RPM: <strong className="text-text-main">{mStats.requestsThisMinute}</strong></span>
                    <span>TPM: <strong className="text-text-main">{formatTokenCount(mStats.tokensThisMinute)}</strong></span>
                    <span>RPD: <strong className="text-text-main">{mStats.requestsToday}</strong></span>
                    <span>TPD: <strong className="text-text-main">{formatTokenCount(mStats.tokensToday)}</strong></span>
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
  onUpdateLimit: (keyHash: string, field: 'maxRpm' | 'maxRpd' | 'maxTpm', value: number) => void;
}

/**
 * Bảng cấu hình giới hạn người dùng tự đặt (RPM, TPM, RPD), bọc React.memo
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
        Thiết lập ngưỡng RPM (Request / Phút), TPM (Token / Phút) và RPD (Request / Ngày) để hiển thị thanh tiến độ phần trăm trực quan trên từng key.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || DEFAULT_CUSTOM_LIMIT;
          return (
            <div key={item.keyHash || idx} className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
              <div className="text-[11px] font-bold text-text-main flex items-center justify-between">
                <span>Khóa #{idx + 1}</span>
                <span className="font-mono text-text-muted text-[10px]">{item.maskedKey}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">
                    Max RPM <span className="text-[8px] text-polish">({formatPacingSummary(limit.maxRpm).intervalSec}/lần)</span>:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={limit.maxRpm || 15}
                    onChange={e => onUpdateLimit(item.keyHash, 'maxRpm', parseInt(e.target.value, 10))}
                    className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Max TPM:</label>
                  <input
                    type="number"
                    min="1000"
                    max="100000000"
                    step="10000"
                    value={limit.maxTpm || 1000000}
                    onChange={e => onUpdateLimit(item.keyHash, 'maxTpm', parseInt(e.target.value, 10))}
                    className="w-full bg-parchment-2/40 border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main text-xs font-mono outline-none focus:border-polish"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Max RPD:</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={limit.maxRpd || 1500}
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

  const handleUpdateLimit = useCallback((keyHash: string, field: 'maxRpm' | 'maxRpd' | 'maxTpm', value: number) => {
    setCustomLimits(prev => {
      const current = prev[keyHash] || DEFAULT_CUSTOM_LIMIT;
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
          onUpdateLimit={handleUpdateLimit}
        />
      )}

      {/* List of Keys Quota Cards */}
      <div className="space-y-3">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || DEFAULT_CUSTOM_LIMIT;
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
