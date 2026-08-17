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

  // Escape 5 ký tự đặc biệt HTML để ngăn XSS khi dùng dangerouslySetInnerHTML
  // Test cases thủ công:
  // - Input: '<script>alert("xss")</script>' → phải hiển thị dạng text thuần, không thực thi
  // - Input: 'A & B < C > D' → phải hiển thị đúng ký tự &, <, >
  // - Input: 'Nói "hello"' → dấu ngoặc kép không bị biến thành attribute HTML
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Highlight processedSourceText: bọc các từ đã thay bằng span màu
  // Quy trình: (1) Escape toàn bộ text → (2) Thay thế bằng placeholder → (3) Chèn <mark> HTML
  // Placeholder dùng ký tự «» không bị escape nên không bị ảnh hưởng ở bước (1)
  const buildHighlightedHtml = (text: string) => {
    // Bước 1: Escape HTML toàn bộ text trước
    let result = escapeHtml(text);
    const sorted = [...glossary]
      .filter(i => i.vietnamese)
      .sort((a, b) => b.vietnamese.length - a.vietnamese.length);
    const placeholder: Record<string, string> = {};
    sorted.forEach((item, idx) => {
      if (!item.vietnamese) return;
      // Escape phần vietnamese trước khi tìm kiếm (vì text đã được escape)
      const escapedVietnamese = escapeHtml(item.vietnamese);
      const regexEscaped = escapedVietnamese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const key = `««TERM_${idx}»»`;
      result = result.replace(new RegExp(regexEscaped, 'g'), key);
      // Nội dung hiển thị trong <mark> cũng phải được escape
      placeholder[key] = `<mark class="bg-amber-500/20 text-amber-300 border border-amber-500/35 rounded px-0.5 font-bold">${escapedVietnamese}</mark>`;
    });
    Object.entries(placeholder).forEach(([k, v]) => {
      result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
    });
    return result;
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-950/40 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-200">Kiểm tra thay thế từ điển vào văn bản gốc</h2>
            <span className="text-[10px] bg-amber-950/20 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full font-bold">{processedChapters.length} chương đã xử lý</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Chapter selector */}
        <div className="px-5 py-2.5 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 shrink-0">Chương:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
            {processedChapters.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDiffModalChapterIndex(idx)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                  idx === safeIdx
                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-950/20'
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Từ đã thay */}
        {replacedTerms.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-800/80 shrink-0 bg-amber-950/10">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Thuật ngữ được thay trong chương này ({replacedTerms.length}):</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-2 pb-1.5">
              {replacedTerms.map(item => (
                <span key={item.id} className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-semibold">
                  <code className="text-rose-400 font-bold font-mono text-[10px]">{item.chinese}</code>
                  <ChevronRight className="w-2.5 h-2.5 text-amber-500" />
                  <span className="text-amber-300 font-bold">{item.vietnamese}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Diff view */}
        <div className="grid grid-cols-2 flex-1 overflow-hidden">
          {/* Cột trái: sourceText gốc */}
          <div className="flex flex-col border-r border-slate-800 overflow-hidden bg-slate-950/20">
            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">● Văn bản gốc (sourceText)</span>
            </div>
            <pre
              ref={diffLeftScrollRef}
              onScroll={handleDiffLeftScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words scrollbar-none"
            >
              {chap.sourceText}
            </pre>
          </div>

          {/* Cột phải: processedSourceText có highlight */}
          <div className="flex flex-col overflow-hidden bg-slate-950/40">
            <div className="px-4 py-2 bg-amber-950/10 border-b border-amber-900/20 shrink-0">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">● Đã áp dụng từ điển (processedSourceText)</span>
            </div>
            <div
              ref={diffRightScrollRef}
              onScroll={handleDiffRightScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(chap.processedSourceText || '') }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 shrink-0 flex justify-end bg-slate-950/20">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
});
