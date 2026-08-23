import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { KeyQuotaFullSnapshot, ModelInfoItem } from '../../utils/apiClient';
import { getKeyModelStats, normalizeModelId, formatTokenCount } from '../../utils/modelRegistry';
import { CountdownBadge } from './CountdownBadge';
import { CustomLimit, DEFAULT_CUSTOM_LIMIT, formatClientMaskedKey } from './CustomLimitsPanel';

export interface KeyCardItemProps {
  item: KeyQuotaFullSnapshot;
  idx: number;
  limit?: CustomLimit;
  rawKey?: string;
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
  rawKey,
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
  const displayMask = formatClientMaskedKey(rawKey, item.maskedKey);

  return (
    <div className="border border-parchment-2 bg-ink rounded-[2px] p-3.5 space-y-3 transition-colors hover:border-parchment-2/80">
      {/* Top row: Key title, masked key & Status badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-main">
            Khóa #{idx + 1}
          </span>
          <span className="font-mono text-xs text-text-muted bg-parchment-2/30 px-2 py-0.5 rounded-[2px] border border-parchment-2">
            {displayMask}
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
