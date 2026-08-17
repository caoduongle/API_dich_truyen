import React from 'react';
import { Sparkles } from 'lucide-react';
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
    <div id="entities-analysis-drawer" className="bg-parchment border border-parchment-2 text-text-main rounded-md p-4 space-y-3 shadow-xs animate-slideUp">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-polish uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-polish" />
            Kết Quả Gợi Ý Từ Điển Âm Hán Việt &amp; Nhân Vật
          </h4>
          <p className="text-[11px] text-text-muted">
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
            className="text-[10px] font-bold text-text-muted hover:text-text-main cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-text-main"
          >
            Chọn tất cả
          </button>
          <span className="text-text-muted">|</span>
          <button
            onClick={() => setSelectedSuggestions({})}
            className="text-[10px] font-bold text-text-muted hover:text-text-main cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-text-main"
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
            className={`p-2 rounded-[2px] border transition-all cursor-pointer flex items-start gap-2 ${
              selectedSuggestions[idx]
                ? 'bg-ink border-polish text-text-main shadow-xs'
                : 'bg-ink/50 border-parchment-2 text-text-muted hover:border-text-muted'
            }`}
          >
            <input
              type="checkbox"
              checked={!!selectedSuggestions[idx]}
              onChange={() => {}}
              className="mt-0.5 rounded-[2px] accent-polish shrink-0 cursor-pointer pointer-events-none"
            />
            <div className="text-[11px] space-y-0.5">
              <div className="flex items-center gap-1">
                <strong className="font-serif text-polish tracking-wide">{item.chinese}</strong>
                <span className="text-text-muted text-[9px]">({item.pinyin})</span>
              </div>
              <div>
                <span className="text-text-muted">Dịch: </span>
                <strong className="text-text-main font-semibold">{item.vietnamese}</strong>
              </div>
              <div className="text-[9px] text-text-muted line-clamp-1 italic">
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
          className="bg-polish hover:bg-[#A03522] text-white font-bold text-xs px-3 py-1.5 rounded-[2px] transition-colors cursor-pointer shadow-xs"
        >
          Lưu các từ đã chọn vào Từ Điển Dự Án
        </button>
      </div>
    </div>
  );
});
