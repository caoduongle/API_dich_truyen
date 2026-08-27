import React from 'react';
import { Badge } from '../ui/Badge';
import { formatTokenCount } from '../../utils/modelRegistry';

export interface GroupQuotaCardProps {
  groups: any[];
}

export const GroupQuotaCard = React.memo(function GroupQuotaCard({ groups }: GroupQuotaCardProps) {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
      {groups.map((group) => {
        const rpmUsed = group.observedUsage?.requestsThisMinute || 0;
        const rpmMax = group.configuredLimits?.configuredRpm || group.providerQuota?.rpm || 15;
        const rpmPercent = Math.min(100, Math.round((rpmUsed / rpmMax) * 100));

        const tpmUsed = group.observedUsage?.tokensThisMinute || 0;
        const tpmMax = group.configuredLimits?.configuredTpm || group.providerQuota?.tpm || 1000000;
        const tpmPercent = Math.min(100, Math.round((tpmUsed / tpmMax) * 100));

        const rawDelay = group.pacingDelayMs !== undefined
          ? group.pacingDelayMs
          : (group.schedulingHint?.effectiveIntervalMs ?? 4445);
        const safeDelay = Math.max(0, rawDelay);
        const pacingLabel = safeDelay > 0 ? `~${safeDelay}ms/call` : 'Sẵn sàng';

        return (
          <div key={group.id} className="bg-ink/80 border border-parchment-2/80 rounded-[2px] p-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm text-text-main">
                  {group.name || group.id}
                </span>
                {group.projectId && (
                  <span className="text-[10px] text-text-muted font-mono bg-parchment-2/30 px-1.5 py-0.5 rounded">
                    Project: {group.projectId}
                  </span>
                )}
                <Badge tone={group.healthState === 'Available' ? 'polish' : group.healthState === 'InCooldown' ? 'warning' : 'danger'}>
                  {group.healthState === 'Available' ? 'Khả dụng' : group.healthState === 'InCooldown' ? 'Đang tạm dừng (429)' : group.healthState}
                </Badge>
              </div>

              <div className="text-[11px] text-text-muted flex items-center gap-2">
                <span>Điều phối: <strong className="text-text-main">{pacingLabel}</strong></span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                  group.schedulingHint?.source === 'configured'
                    ? 'bg-polish/20 text-polish font-medium'
                    : group.schedulingHint?.source === 'provider'
                    ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                    : 'bg-parchment-2/20 text-text-muted'
                }`}>
                  {group.schedulingHint?.source === 'configured'
                    ? 'Giới hạn người dùng đặt'
                    : group.schedulingHint?.source === 'provider'
                    ? 'Hạn mức Google chính thức (Đã xác minh)'
                    : 'Nhịp độ an toàn dự phòng (Chưa xác minh từ Google)'}
                </span>
              </div>
            </div>

            {/* Group Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] p-2">
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">RPM Nhóm (60s)</div>
                <div className="text-xs font-mono font-bold text-text-main mt-0.5">
                  {rpmUsed} <span className="text-[9px] text-text-muted font-normal">/ {rpmMax}</span>
                </div>
                <div className="w-full bg-parchment-2 h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${rpmPercent >= 90 ? 'bg-polish' : rpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
                    style={{ width: `${rpmPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] p-2">
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">TPM Nhóm (60s)</div>
                <div className="text-xs font-mono font-bold text-text-main mt-0.5">
                  {formatTokenCount(tpmUsed)} <span className="text-[9px] text-text-muted font-normal">/ {formatTokenCount(tpmMax)}</span>
                </div>
                <div className="w-full bg-parchment-2 h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${tpmPercent >= 90 ? 'bg-polish' : tpmPercent >= 70 ? 'bg-amber-400' : 'bg-text-muted'}`}
                    style={{ width: `${tpmPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] p-2">
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Gọi hôm nay (RPD)</div>
                <div className="text-xs font-mono font-bold text-text-main mt-0.5">
                  {group.observedUsage?.requestsToday || 0} <span className="text-[9px] text-text-muted font-normal">/ {group.configuredLimits?.configuredRpd || group.providerQuota?.rpd || 1500}</span>
                </div>
              </div>

              <div className="bg-parchment-2/15 border border-parchment-2/60 rounded-[2px] p-2">
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Khóa thành viên</div>
                <div className="text-xs font-mono font-bold text-text-main mt-0.5">
                  {group.keys ? group.keys.length : 0} API Keys
                </div>
              </div>
            </div>

            {/* Member Keys Health List */}
            {group.keys && group.keys.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1 border-t border-parchment-2/40">
                <span className="text-[10px] text-text-muted font-bold uppercase">Trạng thái khóa:</span>
                {group.keys.map((k: any) => (
                  <span key={k.keyHash} className="inline-flex items-center gap-1 bg-parchment-2/20 px-2 py-0.5 rounded font-mono text-[10px]">
                    <span>{k.maskedKey}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${k.healthState === 'Healthy' || k.runtime?.healthState === 'Healthy' ? 'bg-emerald-400' : (k.healthState === 'Degraded' || k.runtime?.healthState === 'Degraded') ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="text-text-muted">({k.healthState || k.runtime?.healthState || 'Healthy'})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
