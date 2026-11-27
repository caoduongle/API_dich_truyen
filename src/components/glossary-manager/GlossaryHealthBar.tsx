import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileWarning, UserCog, X } from 'lucide-react';
import { GlossaryHealthFilter, GlossaryHealthReport } from '../../lib/glossaryMatch';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

export interface GlossaryHealthBarProps {
  healthReport: GlossaryHealthReport;
  healthFilter: GlossaryHealthFilter;
  onSelectFilter: (filter: GlossaryHealthFilter) => void;
  totalGlossaryCount: number;
}

export const GlossaryHealthBar = React.memo(function GlossaryHealthBar({
  healthReport,
  healthFilter,
  onSelectFilter,
  totalGlossaryCount,
}: GlossaryHealthBarProps) {
  if (totalGlossaryCount === 0) {
    return null;
  }

  const { conflictGroupCount, missingProfileCharIds, incompleteViIds, totalIssueItems } = healthReport;
  const isHealthy = totalIssueItems === 0;

  const toggleFilter = (target: GlossaryHealthFilter) => {
    onSelectFilter(healthFilter === target ? 'all' : target);
  };

  return (
    <div
      id="glossary-health-bar"
      className="bg-parchment border border-parchment-2 px-3.5 py-2.5 rounded-md flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-display font-bold uppercase tracking-wider text-[11px] text-text-main">
          <Activity className="w-3.5 h-3.5 text-polish" />
          Sức khỏe từ điển
        </span>

        {isHealthy ? (
          <Badge tone="polish" className="gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Sẵn sàng dịch ({totalGlossaryCount} thuật ngữ sạch)
          </Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {conflictGroupCount > 0 && (
              <button
                type="button"
                id="btn-health-filter-conflicts"
                onClick={() => toggleFilter('conflicts')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] border text-[11px] font-medium transition-colors cursor-pointer',
                  healthFilter === 'conflicts'
                    ? 'bg-polish text-white border-polish'
                    : 'bg-amber-950/35 text-amber-300 border-amber-800/50 hover:border-amber-600'
                )}
                title="Lọc các mục đang xung đột bản dịch tiếng Việt (gồm cả Giản/Phồn thể và biến thể)"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Xung đột dịch nghĩa</span>
                <span className="font-mono font-bold">({conflictGroupCount} nhóm)</span>
              </button>
            )}

            {missingProfileCharIds.length > 0 && (
              <button
                type="button"
                id="btn-health-filter-missing-profile"
                onClick={() => toggleFilter('missing_profile')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] border text-[11px] font-medium transition-colors cursor-pointer',
                  healthFilter === 'missing_profile'
                    ? 'bg-polish text-white border-polish'
                    : 'bg-ink text-text-main border-parchment-2 hover:border-polish/60'
                )}
                title="Lọc các nhân vật chưa thiết lập giới tính hoặc đại từ tự sự"
              >
                <UserCog className={cn('w-3 h-3', healthFilter === 'missing_profile' ? 'text-white' : 'text-polish')} />
                <span>Nhân vật thiếu hồ sơ</span>
                <span className="font-mono font-bold">({missingProfileCharIds.length})</span>
              </button>
            )}

            {incompleteViIds.length > 0 && (
              <button
                type="button"
                id="btn-health-filter-incomplete"
                onClick={() => toggleFilter('incomplete')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] border text-[11px] font-medium transition-colors cursor-pointer',
                  healthFilter === 'incomplete'
                    ? 'bg-polish text-white border-polish'
                    : 'bg-amber-950/25 text-amber-200 border-amber-800/40 hover:border-amber-600'
                )}
                title="Lọc các mục bị trống bản dịch tiếng Việt"
              >
                <FileWarning className="w-3 h-3" />
                <span>Thiếu nghĩa Việt</span>
                <span className="font-mono font-bold">({incompleteViIds.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {healthFilter !== 'all' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<X className="w-3 h-3" />}
          onClick={() => onSelectFilter('all')}
        >
          Hiển thị tất cả
        </Button>
      )}
    </div>
  );
});

export default GlossaryHealthBar;
