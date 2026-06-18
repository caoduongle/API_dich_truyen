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
    <div className="bg-emerald-50/60 border border-emerald-205 text-emerald-950 p-4 rounded-xl space-y-2 shadow-3xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-850">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-bounce" />
          <span>Tổng thuật ngữ thu hoạch mới kì này ({autoDiscoveredBatch.length})</span>
        </div>
        <span className="text-[9px] text-emerald-600 bg-white border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
          Tự động liên kết gối đầu thành công
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
        {autoDiscoveredBatch.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded px-2 py-0.5 text-xs shadow-3xs font-semibold"
            title={`Ghi chú: ${item.note || 'Không có'}`}
          >
            <code className="text-rose-600 font-bold font-mono text-[10px]">{item.chinese}</code>
            <ChevronRight className="w-2.5 h-2.5 text-emerald-400" />
            <span className="text-indigo-900 font-extrabold">{item.vietnamese}</span>
            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded">
              {item.type === 'character' ? 'Nhân vật' : item.type === 'location' ? 'Địa danh' : 'Bí pháp'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});
