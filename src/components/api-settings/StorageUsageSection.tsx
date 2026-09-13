import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import { estimateStorageUsage, StorageUsageEstimate } from '../../services/db';

export interface StorageUsageSectionProps {
  className?: string;
}

export function StorageUsageSection({ className }: StorageUsageSectionProps) {
  const [estimate, setEstimate] = useState<StorageUsageEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEstimate = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    }
    try {
      const data = await estimateStorageUsage();
      setEstimate(data);
    } catch {
      setEstimate(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEstimate(false);
  }, [fetchEstimate]);

  // Gracefully hide component if storage estimate API is unsupported or returned null
  if (!loading && estimate === null) {
    return null;
  }

  // Hide during initial load to prevent 0% layout flash
  if (loading && estimate === null) {
    return null;
  }

  return (
    <div className={cn('space-y-2.5 pt-3 border-t border-parchment-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-polish" />
          Dung lượng bộ nhớ cục bộ (IndexedDB)
        </label>

        <button
          type="button"
          onClick={() => fetchEstimate(true)}
          disabled={isRefreshing}
          className={cn(
            'text-[11px] font-bold text-polish hover:text-[#A03522] flex items-center gap-1 cursor-pointer transition-opacity',
            isRefreshing && 'opacity-70 cursor-not-allowed'
          )}
          title="Làm mới dung lượng"
        >
          <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin text-polish')} />
          {isRefreshing ? 'Đang kiểm tra...' : 'Làm mới'}
        </button>
      </div>

      <div className="bg-parchment-2/15 border border-parchment-2 rounded-[2px] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-text-muted">
          <span>
            {estimate!.formattedUsage} / {estimate!.formattedQuota} ({estimate!.percentUsed}%)
          </span>
          <div className="flex items-center gap-1.5">
            {estimate!.isNearLimit && (
              <Badge tone="warning" title="Dung lượng bộ nhớ sắp đầy">
                Sắp đầy
              </Badge>
            )}
          </div>
        </div>

        <div className="w-full h-1.5 bg-parchment-2 rounded-[2px] overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 rounded-[2px]',
              estimate!.isNearLimit ? 'bg-amber-500' : 'bg-polish'
            )}
            style={{ width: `${Math.min(100, Math.max(0, estimate!.percentUsed))}%` }}
          />
        </div>

        {estimate!.isNearLimit && (
          <div className="bg-amber-950/20 border border-amber-800/60 rounded-[2px] p-2 text-xs text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Bộ nhớ trình duyệt sắp đầy (&ge; 80% hoặc dưới 100MB còn lại). Bạn nên xuất dữ liệu hoặc dọn dẹp các dự án cũ.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
