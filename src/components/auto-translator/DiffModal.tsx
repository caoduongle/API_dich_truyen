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

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const buildHighlightedHtml = (text: string) => {
    let result = escapeHtml(text);
    const sorted = [...glossary]
      .filter(i => i.vietnamese)
      .sort((a, b) => b.vietnamese.length - a.vietnamese.length);
    const placeholder: Record<string, string> = {};
    sorted.forEach((item, idx) => {
      if (!item.vietnamese) return;
      const escapedVietnamese = escapeHtml(item.vietnamese);
      const regexEscaped = escapedVietnamese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const key = `««TERM_${idx}»»`;
      result = result.replace(new RegExp(regexEscaped, 'g'), key);
      placeholder[key] = `<mark class="bg-polish/20 text-polish border border-polish/40 rounded-[2px] px-1 font-bold">${escapedVietnamese}</mark>`;
    });
    Object.entries(placeholder).forEach(([k, v]) => {
      result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
    });
    return result;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-parchment border border-parchment-2 rounded-md shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-text-main">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-parchment-2 shrink-0 bg-ink/40">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-polish" />
            <h2 className="text-sm font-display font-bold text-text-main">Kiểm tra thay thế từ điển vào văn bản gốc</h2>
            <span className="text-[10px] bg-ink text-polish border border-parchment-2 px-2 py-0.5 rounded-[2px] font-bold">{processedChapters.length} chương đã xử lý</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer text-text-muted hover:text-text-main">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chapter selector */}
        <div className="px-5 py-2.5 border-b border-parchment-2 shrink-0 flex items-center gap-3 bg-ink/20">
          <span className="text-xs font-bold text-text-muted shrink-0">Chương:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
            {processedChapters.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDiffModalChapterIndex(idx)}
                className={`shrink-0 px-2.5 py-1 rounded-[2px] text-[11px] font-bold border cursor-pointer transition-colors ${
                  idx === safeIdx
                    ? 'bg-polish border-polish text-white shadow-xs'
                    : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'
                }`}
              >
                {c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Từ đã thay */}
        {replacedTerms.length > 0 && (
          <div className="px-5 py-3 border-b border-parchment-2 shrink-0 bg-ink/40">
            <p className="text-[10px] font-bold text-polish uppercase tracking-wider mb-2">Thuật ngữ được thay trong chương này ({replacedTerms.length}):</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-2 pb-1.5">
              {replacedTerms.map(item => (
                <span key={item.id} className="inline-flex items-center gap-1 bg-parchment border border-parchment-2 rounded-[2px] px-2 py-0.5 text-[11px] font-semibold">
                  <code className="text-polish font-serif text-[10px]">{item.chinese}</code>
                  <ChevronRight className="w-2.5 h-2.5 text-text-muted" />
                  <span className="text-text-main font-bold">{item.vietnamese}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Diff view */}
        <div className="grid grid-cols-2 flex-1 overflow-hidden">
          {/* Cột trái: sourceText gốc */}
          <div className="flex flex-col border-r border-parchment-2 overflow-hidden bg-ink/60">
            <div className="px-4 py-2 bg-ink border-b border-parchment-2 shrink-0">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">● Văn bản gốc (sourceText)</span>
            </div>
            <pre
              ref={diffLeftScrollRef}
              onScroll={handleDiffLeftScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-text-main font-serif leading-relaxed whitespace-pre-wrap break-words scrollbar-none"
            >
              {chap.sourceText}
            </pre>
          </div>

          {/* Cột phải: processedSourceText có highlight */}
          <div className="flex flex-col overflow-hidden bg-ink/30">
            <div className="px-4 py-2 bg-ink border-b border-parchment-2 shrink-0">
              <span className="text-[11px] font-bold text-polish uppercase tracking-wider">● Đã áp dụng từ điển (processedSourceText)</span>
            </div>
            <div
              ref={diffRightScrollRef}
              onScroll={handleDiffRightScroll}
              className="flex-1 overflow-y-auto p-4 text-xs text-text-main font-sans leading-relaxed whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(chap.processedSourceText || '') }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-parchment-2 shrink-0 flex justify-end bg-ink/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-ink hover:bg-parchment-2 text-text-main text-xs font-semibold rounded-[2px] border border-parchment-2 cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
});
