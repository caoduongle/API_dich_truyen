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
    <div className="bg-[#0f1524] border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-xl animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          Tra cứu từ điển ({glossaryLength} từ)
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShowMatching}
              onChange={(e) => setOnlyShowMatching(e.target.checked)}
              className="rounded border-slate-700 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer bg-[#161f30]"
            />
            Chỉ từ trong chương
          </label>
          <input
            type="text"
            placeholder="Tìm nhanh..."
            value={glossarySearch}
            onChange={(e) => setGlossarySearch(e.target.value)}
            className="bg-[#161f30] border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 w-32 font-sans transition-all"
          />
        </div>
      </div>

      {glossaryLength === 0 ? (
        <div className="text-xs text-slate-500 italic leading-relaxed">
          Chưa khai báo từ điển. Thử click nút &quot;Tìm nhân vật&quot; để tạo từ điển tự động.
        </div>
      ) : visibleGlossary.length === 0 ? (
        <div className="text-xs text-slate-500 italic leading-relaxed">
          Không tìm thấy từ khóa phù hợp.
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {visibleGlossary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 bg-[#161f30] border border-slate-800 rounded-lg px-2.5 py-1 text-xs shadow-sm text-slate-300 text-slate-300 font-sans hover:border-indigo-500/50 transition-all cursor-default"
                title={`${item.chinese} -> ${item.vietnamese} (${item.note || 'Không có ghi chú'})`}
              >
                <code className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-rose-400 font-bold text-[10px]">{item.chinese}</code>
                <ChevronRight className="w-2.5 h-2.5 text-slate-600 text-slate-600 shrink-0" />
                <span className="font-bold text-indigo-300">{item.vietnamese}</span>
                {item.type === 'character' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 animate-pulse" title="Nhân vật"></span>}
                {item.type === 'location' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Địa danh"></span>}
                {item.type === 'term' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Thuật ngữ"></span>}
              </span>
            ))}
          </div>
          {glossaryLength > visibleGlossary.length && !glossarySearch && !onlyShowMatching && (
            <p className="text-[10px] text-slate-500 italic">
              Hiển thị tối đa 100 từ điển hàng đầu. Sử dụng tìm kiếm hoặc chọn lọc để xem thêm.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
