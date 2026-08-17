import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { GlossaryItem } from '../../types';

export interface DiscoveredTermsPanelProps {
  autoDiscoveredBatch: GlossaryItem[];
}

export const DiscoveredTermsPanel = React.memo(function DiscoveredTermsPanel({
  autoDiscoveredBatch,
}: DiscoveredTermsPanelProps) {
  if (autoDiscoveredBatch.length === 0) return null;

  return (
    <div className="bg-parchment border border-parchment-2 text-text-main p-4 rounded-md space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-polish">
          <Sparkles className="w-4 h-4 text-polish animate-pulse" />
          <span>Tổng thuật ngữ thu hoạch mới kì này ({autoDiscoveredBatch.length})</span>
        </div>
        <span className="text-[9px] text-text-muted bg-ink border border-parchment-2 px-2 py-0.5 rounded-[2px] font-bold">
          Tự động liên kết gối đầu thành công
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
        {autoDiscoveredBatch.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 bg-ink border border-parchment-2 rounded-[2px] px-2 py-0.5 text-xs shadow-xs font-semibold"
            title={`Ghi chú: ${item.note || 'Không có'}`}
          >
            <code className="text-polish font-serif text-[10px]">{item.chinese}</code>
            <ChevronRight className="w-2.5 h-2.5 text-text-muted" />
            <span className="text-text-main font-bold">{item.vietnamese}</span>
            <span className="text-[9px] bg-parchment text-text-muted border border-parchment-2 px-1 rounded-[2px]">
              {item.type === 'character' ? 'Nhân vật' : item.type === 'location' ? 'Địa danh' : 'Bí pháp'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});
