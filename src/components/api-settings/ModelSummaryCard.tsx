import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  X, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { 
  ModelStatsSummary, 
  getModelDefinition, 
  formatPacingSummary, 
  formatTokenCount 
} from '../../utils/modelRegistry';

export interface ModelSummaryCardProps {
  summary: ModelStatsSummary;
  onInspectClick: () => void;
}

export function ModelSummaryCard({ 
  summary, 
  onInspectClick 
}: ModelSummaryCardProps) {
  const modelDef = getModelDefinition(summary.modelId);
  const isDeprecated = modelDef?.status === 'deprecated';
  const isShutdown = modelDef?.status === 'shutdown';
  const isVerified = modelDef?.verified === true;

  let customRpm: number | undefined;
  try {
    const saved = localStorage.getItem('gemini_quota_custom_limits');
    if (saved) {
      const parsed = JSON.parse(saved);
      const firstLimit = Object.values(parsed)[0] as any;
      if (firstLimit?.maxRpm && typeof firstLimit.maxRpm === 'number') {
        customRpm = firstLimit.maxRpm;
      }
    }
  } catch {}

  const pacing = formatPacingSummary(customRpm, summary.modelId);

  return (
    <div className="bg-parchment-2/15 border border-parchment-2 rounded-[2px] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-text-main uppercase tracking-wider">
            Trạng thái Mô hình:
          </span>
          <span className="text-xs font-semibold text-polish font-serif">
            {summary.displayName.split('(')[0].trim()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isVerified && (
            <Badge tone="polish">
              <ShieldCheck className="w-3 h-3 text-polish" />
              Đã xác minh
            </Badge>
          )}
          {isDeprecated && (
            <Badge tone="warning">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Sắp ngừng hỗ trợ (Deprecated)
            </Badge>
          )}
          {isShutdown && (
            <Badge tone="danger">
              <X className="w-3 h-3 text-red-400" />
              Đã ngừng hoạt động (Shutdown)
            </Badge>
          )}
          {summary.hasChecked ? (
            summary.isUnavailable ? (
              <Badge tone="warning" className="animate-pulse">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                0 / {summary.totalKeys} key hỗ trợ
              </Badge>
            ) : (
              <Badge tone="polish">
                <CheckCircle2 className="w-3 h-3 text-polish" />
                {summary.availableKeyCount} / {summary.totalKeys} key hỗ trợ
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

      {isDeprecated && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Mô hình này sắp ngừng hỗ trợ. Khuyến nghị chuyển sang: <strong>{modelDef?.replacementId || 'model mới hơn'}</strong></span>
          </div>
        </div>
      )}

      {isShutdown && (
        <div className="bg-red-950/30 border border-red-800/60 rounded-[2px] p-2.5 text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Mô hình này đã bị Google khai tử. Vui lòng chọn mô hình khác để tiếp tục dịch.</span>
          </div>
        </div>
      )}

      {summary.isUnavailable && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-[2px] p-2.5 text-xs text-amber-300 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Model đang chọn hiện không có API key nào hỗ trợ.</span>
          </div>
          <button
            type="button"
            onClick={onInspectClick}
            className="text-[11px] font-bold text-amber-200 hover:text-white underline cursor-pointer shrink-0"
          >
            Chuyển sang Quota để kiểm tra lại
          </button>
        </div>
      )}

      {/* Dynamic Pacing Info Line */}
      <div className="bg-parchment-2/20 border border-parchment-2/70 rounded-[2px] px-2.5 py-1 flex items-center justify-between text-[11px] text-text-muted flex-wrap gap-1">
        <span className="flex items-center gap-1 font-medium">
          <Zap className="w-3 h-3 text-polish" />
          <span>Tốc độ điều phối: <strong className="text-text-main">~{pacing.estimatedRpm} req/phút</strong> (~{pacing.intervalSec}/lần gọi)</span>
        </span>
        <span className="text-[10px] italic">
          {pacing.isCustom ? 'Tự động tối ưu theo hạn mức bạn nhập' : 'Mặc định theo tier model'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">RPM (60s)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {summary.requestsThisMinute}
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">TPM (60s)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {formatTokenCount(summary.tokensThisMinute)}
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Hôm nay (PST)</div>
          <div className="text-xs font-mono font-bold text-text-main mt-0.5">
            {summary.requestsToday} <span className="text-[9px] text-text-muted">({formatTokenCount(summary.tokensToday)})</span>
          </div>
        </div>

        <div className="bg-ink border border-parchment-2 rounded-[2px] p-1.5">
          <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Tổng Token</div>
          <div className={`text-xs font-mono font-bold mt-0.5 ${summary.errorsTotal > 0 ? 'text-polish' : 'text-text-main'}`}>
            {formatTokenCount(summary.totalTokens)}
          </div>
        </div>
      </div>
    </div>
  );
}
