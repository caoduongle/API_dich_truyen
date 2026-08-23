import React from 'react';
import { Settings2 } from 'lucide-react';
import { KeyQuotaFullSnapshot } from '../../utils/apiClient';
import { formatPacingSummary } from '../../utils/modelRegistry';

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

export function formatClientMaskedKey(rawKey?: string, fallbackMask?: string): string {
  if (!rawKey || typeof rawKey !== 'string') return fallbackMask || '***';
  const trimmed = rawKey.trim();
  if (trimmed.length <= 10) return '***';
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export interface CustomLimitsPanelProps {
  snapshotKeys: KeyQuotaFullSnapshot[];
  customLimits: Record<string, CustomLimit>;
  apiKeys?: string[];
  onUpdateLimit: (keyHash: string, field: 'maxRpm' | 'maxRpd' | 'maxTpm', value: number) => void;
}

/**
 * Bảng cấu hình giới hạn người dùng tự đặt (RPM, TPM, RPD), bọc React.memo
 */
export const CustomLimitsPanel = React.memo(function CustomLimitsPanel({
  snapshotKeys,
  customLimits,
  apiKeys,
  onUpdateLimit,
}: CustomLimitsPanelProps) {
  return (
    <div className="bg-parchment-2/20 border border-parchment-2 rounded-[2px] p-3.5 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
        <Settings2 className="w-3.5 h-3.5 text-polish" />
        Cấu hình Ngưỡng Hạn ngạch &amp; Gợi ý Điều phối (Quota Group Settings / Scheduling Hints)
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Thiết lập ngưỡng RPM (Request / Phút), TPM (Token / Phút) và RPD (Request / Ngày) để điều phối nhịp độ an toàn (Scheduling Hints) cho các nhóm khóa dự án.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {snapshotKeys.map((item, idx) => {
          const limit = customLimits[item.keyHash] || DEFAULT_CUSTOM_LIMIT;
          const displayMask = formatClientMaskedKey(apiKeys?.[idx], item.maskedKey);
          return (
            <div key={item.keyHash || idx} className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
              <div className="text-[11px] font-bold text-text-main flex items-center justify-between">
                <span>Khóa #{idx + 1}</span>
                <span className="font-mono text-text-muted text-[10px]">{displayMask}</span>
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
