import React from 'react';
import { ChapterMetadata } from '../../types';
import { CHINESE_EXAMPLES } from '../../data/examples';

export interface ChapterSelectorToolbarProps {
  untranslatedChapters: ChapterMetadata[];
  onLoadChapterById: (id: string) => void;
  onLoadExample: (index: number) => void;
  sourceText: string;
}

export function ChapterSelectorToolbar({
  untranslatedChapters,
  onLoadChapterById,
  onLoadExample,
  sourceText,
}: ChapterSelectorToolbarProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-text-muted font-medium whitespace-nowrap hidden xs:inline">Chương chưa dịch:</span>
        <select
          id="select-untranslated-chapter"
          onChange={(e) => {
            const chapId = e.target.value;
            if (!chapId) return;
            onLoadChapterById(chapId);
            e.target.value = '';
          }}
          className="bg-ink hover:bg-parchment-2 text-text-main border border-parchment-2 rounded-[2px] px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-draft max-w-[150px] xs:max-w-[200px] truncate cursor-pointer transition-colors"
          defaultValue=""
        >
          <option value="" className="bg-parchment text-text-muted" disabled>-- Chọn chương --</option>
          {untranslatedChapters.length === 0 ? (
            <option value="" className="bg-parchment text-text-muted" disabled>Không có chương chưa dịch</option>
          ) : (
            untranslatedChapters.map((c) => (
              <option key={c.id} value={c.id} className="bg-parchment text-text-main">
                {c.title}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Examples section if source text is empty */}
      {!sourceText && (
        <div className="bg-ink border border-parchment-2 p-4 rounded-md space-y-2.5 animate-fadeIn">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted block">Văn bản mẫu khảo nghiệm</span>
          <div className="flex flex-wrap gap-2">
            {CHINESE_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => onLoadExample(idx)}
                className="bg-parchment border border-parchment-2 hover:border-draft hover:bg-parchment-2 rounded-[2px] px-2.5 py-1 text-xs text-text-main font-semibold transition cursor-pointer"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
