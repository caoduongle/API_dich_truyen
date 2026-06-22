import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { GlossaryItem } from '../../types';

export interface GlossarySidebarProps {
  glossaryLength: number;
  visibleGlossary: GlossaryItem[];
  onlyShowMatching: boolean;
  setOnlyShowMatching: (b: boolean) => void;
  glossarySearch: string;
  setGlossarySearch: (s: string) => void;
}

export const GlossarySidebar = React.memo(function GlossarySidebar({
  glossaryLength,
  visibleGlossary,
  onlyShowMatching,
  setOnlyShowMatching,
  glossarySearch,
  setGlossarySearch,
}: GlossarySidebarProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-indigo-650" />
          Tra cứu từ điển ({glossaryLength} từ)
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-650 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShowMatching}
              onChange={(e) => setOnlyShowMatching(e.target.checked)}
              className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-550 w-3.5 h-3.5 cursor-pointer"
            />
            Chỉ hiện từ trong chương
          </label>
          <input
            type="text"
            placeholder="Tìm nhanh..."
            value={glossarySearch}
            onChange={(e) => setGlossarySearch(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-500 w-32 font-sans"
          />
        </div>
      </div>

      {glossaryLength === 0 ? (
        <div className="text-xs text-slate-505 text-slate-500 italic">
          Bạn chưa khai báo từ điển nào cho chương truyện này. Thử nhấp nút &quot;Phân tích gợi ý nhân vật&quot; bên trên để tạo từ điển tự động!
        </div>
      ) : visibleGlossary.length === 0 ? (
        <div className="text-xs text-slate-400 italic">
          Không tìm thấy từ khóa nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {visibleGlossary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs shadow-xs text-slate-600 font-sans"
                title={`${item.chinese} -> ${item.vietnamese} (${item.note})`}
              >
                <code className="font-mono bg-slate-100 px-1 rounded text-red-600 font-bold text-[11px]">{item.chinese}</code>
                <ChevronRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="font-bold text-indigo-950 bg-indigo-50/40 border border-indigo-100 px-1 py-0.2 rounded text-[11px]">{item.vietnamese}</span>
                {item.type === 'character' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>}
              </span>
            ))}
          </div>
          {glossaryLength > visibleGlossary.length && !glossarySearch && !onlyShowMatching && (
            <p className="text-[10px] text-slate-400 italic">
              Hiển thị tối đa 100 từ điển hàng đầu. Sử dụng tìm kiếm hoặc chọn lọc để xem thêm.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
