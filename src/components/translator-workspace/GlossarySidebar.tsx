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
    <div className="bg-parchment border border-parchment-2 rounded-md p-5 space-y-3 shadow-xs animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-parchment-2 pb-3">
        <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-polish" />
          Tra cứu từ điển ({glossaryLength} từ)
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShowMatching}
              onChange={(e) => setOnlyShowMatching(e.target.checked)}
              className="rounded-[2px] border-parchment-2 text-polish focus:ring-polish w-3.5 h-3.5 cursor-pointer bg-ink"
            />
            Chỉ từ trong chương
          </label>
          <input
            type="text"
            placeholder="Tìm nhanh..."
            value={glossarySearch}
            onChange={(e) => setGlossarySearch(e.target.value)}
            className="bg-ink border border-parchment-2 text-text-main rounded-[2px] px-2.5 py-1 text-xs focus:outline-none focus:border-polish w-32 font-sans transition-all"
          />
        </div>
      </div>

      {glossaryLength === 0 ? (
        <div className="text-xs text-text-muted italic leading-relaxed">
          Chưa khai báo từ điển. Thử click nút &quot;Tìm nhân vật&quot; để tạo từ điển tự động.
        </div>
      ) : visibleGlossary.length === 0 ? (
        <div className="text-xs text-text-muted italic leading-relaxed">
          Không tìm thấy từ khóa phù hợp.
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {visibleGlossary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs shadow-xs text-text-main font-sans hover:border-polish transition-all cursor-default"
                title={`${item.chinese} -> ${item.vietnamese} (${item.note || 'Không có ghi chú'})`}
              >
                <code className="font-serif bg-parchment px-1.5 py-0.5 rounded-[2px] text-polish font-bold text-[10px]">{item.chinese}</code>
                <ChevronRight className="w-2.5 h-2.5 text-text-muted shrink-0" />
                <span className="font-semibold text-text-main">{item.vietnamese}</span>
                {item.type === 'character' && <span className="w-1.5 h-1.5 rounded-full bg-polish shrink-0" title="Nhân vật"></span>}
                {item.type === 'location' && <span className="w-1.5 h-1.5 rounded-full bg-draft shrink-0" title="Địa danh"></span>}
                {item.type === 'term' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Thuật ngữ"></span>}
              </span>
            ))}
          </div>
          {glossaryLength > visibleGlossary.length && !glossarySearch && !onlyShowMatching && (
            <p className="text-[10px] text-text-muted italic">
              Hiển thị tối đa 100 từ điển hàng đầu. Sử dụng tìm kiếm hoặc chọn lọc để xem thêm.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
