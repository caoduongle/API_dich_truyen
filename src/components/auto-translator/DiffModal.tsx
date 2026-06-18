import React, { useRef, useEffect } from 'react';
import { Eye, X, ChevronRight } from 'lucide-react';
import { Chapter, GlossaryItem } from '../../types';

export interface DiffModalProps {
  chapters: Chapter[];
  glossary: GlossaryItem[];
  diffModalChapterIndex: number;
  setDiffModalChapterIndex: (n: number) => void;
  onClose: () => void;
}

export const DiffModal = React.memo(function DiffModal({
  chapters,
  glossary,
  diffModalChapterIndex,
  setDiffModalChapterIndex,
  onClose,
}: DiffModalProps) {
  const processedChapters = chapters.filter(c => c.processedSourceText);
  if (processedChapters.length === 0) return null;

  const safeIdx = Math.min(diffModalChapterIndex, processedChapters.length - 1);
  const chap = processedChapters[safeIdx];

  // Tìm các từ đã được thay trong chương này
  const replacedTerms = glossary.filter(item => {
    if (!item.chinese || !item.vietnamese) return false;
    return chap.sourceText.includes(item.chinese);
  });

  // Tham chiếu đồng bộ cuộn
  const diffLeftScrollRef = useRef<HTMLPreElement | null>(null);
  const diffRightScrollRef = useRef<HTMLDivElement | null>(null);

  const handleDiffLeftScroll = (e: React.UIEvent<HTMLPreElement>) => {
    if (diffRightScrollRef.current && diffRightScrollRef.current.scrollTop !== e.currentTarget.scrollTop) {
      diffRightScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleDiffRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (diffLeftScrollRef.current && diffLeftScrollRef.current.scrollTop !== e.currentTarget.scrollTop) {
      diffLeftScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    if (diffLeftScrollRef.current) diffLeftScrollRef.current.scrollTop = 0;
    if (diffRightScrollRef.current) diffRightScrollRef.current.scrollTop = 0;
  }, [diffModalChapterIndex]);

  // Highlight processedSourceText: bọc các từ đã thay bằng span màu
  const buildHighlightedHtml = (text: string) => {
    let result = text;
    const sorted = [...glossary]
      .filter(i => i.vietnamese)
      .sort((a, b) => b.vietnamese.length - a.vietnamese.length);
    const placeholder: Record<string, string> = {};
    sorted.forEach((item, idx) => {
      if (!item.vietnamese) return;
      const escaped = item.vietnamese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const key = `««TERM_${idx}»»`;
      result = result.replace(new RegExp(escaped, 'g'), key);
      placeholder[key] = `<mark class="bg-amber-200 text-amber-900 rounded px-0.5 font-bold">${item.vietnamese}</mark>`;
    });
    Object.entries(placeholder).forEach(([k, v]) => {
      result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
    });
    return result;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">Kiểm tra thay thế từ điển vào văn bản gốc</h2>
            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">{processedChapters.length} chương đã xử lý</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Chapter selector */}
        <div className="px-5 py-2.5 border-b border-slate-100 shrink-0 flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 shrink-0">Chương:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
            {processedChapters.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDiffModalChapterIndex(idx)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                  idx === safeIdx
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Từ đã thay */}
        {replacedTerms.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-200 shrink-0 bg-amber-50/40">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">Thuật ngữ được thay trong chương này ({replacedTerms.length}):</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-2 pb-1.5">
              {replacedTerms.map(item => (
                <span key={item.id} className="inline-flex items-center gap-1 bg-white border border-amber-200 rounded px-2 py-0.5 text-[11px] font-semibold">
                  <code className="text-rose-600 font-bold font-mono text-[10px]">{item.chinese}</code>
                  <ChevronRight className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-amber-900 font-bold">{item.vietnamese}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Diff view */}
        <div className="grid grid-cols-2 flex-1 overflow-hidden">
          {/* Cột trái: sourceText gốc */}
          <div className="flex flex-col border-r border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 shrink-0">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">● Văn bản gốc (sourceText)</span>
            </div>
            <pre
              ref={diffLeftScrollRef}
              onScroll={handleDiffLeftScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap break-words scrollbar-none"
            >
              {chap.sourceText}
            </pre>
          </div>

          {/* Cột phải: processedSourceText có highlight */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">● Đã áp dụng từ điển (processedSourceText)</span>
            </div>
            <div
              ref={diffRightScrollRef}
              onScroll={handleDiffRightScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(chap.processedSourceText || '') }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
});
