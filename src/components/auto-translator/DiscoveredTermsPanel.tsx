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
    <div className="bg-emerald-950/10 border border-emerald-800/30 text-emerald-300 p-4 rounded-xl space-y-2 shadow-3xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <Sparkles className="w-4 h-4 text-emerald-500 animate-bounce" />
          <span>Tổng thuật ngữ thu hoạch mới kì này ({autoDiscoveredBatch.length})</span>
        </div>
        <span className="text-[9px] text-emerald-400 bg-slate-900 border border-emerald-900/60 px-2 py-0.5 rounded-full font-bold">
          Tự động liên kết gối đầu thành công
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
        {autoDiscoveredBatch.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 bg-slate-950 border border-emerald-900/60 rounded px-2 py-0.5 text-xs shadow-3xs font-semibold"
            title={`Ghi chú: ${item.note || 'Không có'}`}
          >
            <code className="text-rose-400 font-bold font-mono text-[10px]">{item.chinese}</code>
            <ChevronRight className="w-2.5 h-2.5 text-emerald-600" />
            <span className="text-indigo-300 font-extrabold">{item.vietnamese}</span>
            <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 rounded">
              {item.type === 'character' ? 'Nhân vật' : item.type === 'location' ? 'Địa danh' : 'Bí pháp'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});
