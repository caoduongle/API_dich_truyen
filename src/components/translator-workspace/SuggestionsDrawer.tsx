import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { GlossaryItem } from '../../types';

export interface SuggestionsDrawerProps {
  suggestions: Omit<GlossaryItem, 'id'>[];
  selectedSuggestions: Record<number, boolean>;
  toggleCheck: (idx: number) => void;
  handleImportSuggestions: () => void;
  setSelectedSuggestions: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export const SuggestionsDrawer = React.memo(function SuggestionsDrawer({
  suggestions,
  selectedSuggestions,
  toggleCheck,
  handleImportSuggestions,
  setSelectedSuggestions,
}: SuggestionsDrawerProps) {
  if (suggestions.length === 0) return null;

  return (
    <div id="entities-analysis-drawer" className="bg-slate-900 border border-slate-800 text-white rounded-xl p-4 space-y-3 shadow-md animate-slideUp">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 fill-current text-indigo-400" />
            Kết Quả Gợi Ý Từ Điển Âm Hán Việt &amp; Nhân Vật
          </h4>
          <p className="text-[11px] text-slate-400">
            AI đã tự động phát hiện được {suggestions.length} danh từ riêng quan trọng. Hãy lọc và thêm vào bộ Quy định.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const checkAll: Record<number, boolean> = {};
              suggestions.forEach((_, idx) => { checkAll[idx] = true; });
              setSelectedSuggestions(checkAll);
            }}
            className="text-[10px] font-bold text-slate-300 hover:text-white pointer cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-slate-300"
          >
            Chọn tất cả
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setSelectedSuggestions({})}
            className="text-[10px] font-bold text-slate-300 hover:text-white pointer cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-slate-300"
          >
            Bỏ chọn
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
        {suggestions.map((item, idx) => (
          <div
            key={idx}
            onClick={() => toggleCheck(idx)}
            className={`p-2 rounded border transition-all cursor-pointer flex items-start gap-2 ${
              selectedSuggestions[idx]
                ? 'bg-slate-850 border-indigo-500 text-white shadow-xs'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={!!selectedSuggestions[idx]}
              onChange={() => {}} // handled by div click
              className="mt-0.5 rounded accent-indigo-600 shrink-0 cursor-pointer pointer-events-none"
            />
            <div className="text-[11px] space-y-0.5">
              <div className="flex items-center gap-1">
                <strong className="font-mono text-white tracking-wide">{item.chinese}</strong>
                <span className="text-slate-500 text-[9px]">({item.pinyin})</span>
              </div>
              <div>
                <span className="text-slate-500">Dịch: </span>
                <strong className="text-indigo-300">{item.vietnamese}</strong>
              </div>
              <div className="text-[9px] text-slate-505 text-slate-500 line-clamp-1 italic">
                {item.note || `Thể loại: ${item.type}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-1">
        <button
          id="btn-import-suggestions"
          onClick={handleImportSuggestions}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors pointer cursor-pointer"
        >
          Lưu các từ đã chọn vào Từ Điển Dự Án
        </button>
      </div>
    </div>
  );
});
