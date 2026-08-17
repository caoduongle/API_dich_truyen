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
        <span className="text-slate-400 font-semibold whitespace-nowrap hidden xs:inline">Chương chưa dịch:</span>
        <select
          id="select-untranslated-chapter"
          onChange={(e) => {
            const chapId = e.target.value;
            if (!chapId) return;
            onLoadChapterById(chapId);
            e.target.value = '';
          }}
          className="bg-[#161f30] hover:bg-[#1a253a] text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[150px] xs:max-w-[200px] truncate cursor-pointer transition-colors"
          defaultValue=""
        >
          <option value="" className="bg-[#0f1524] text-slate-400" disabled>-- Chọn chương --</option>
          {untranslatedChapters.length === 0 ? (
            <option value="" className="bg-[#0f1524] text-slate-400" disabled>Không có chương chưa dịch</option>
          ) : (
            untranslatedChapters.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0f1524] text-slate-200">
                {c.title}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Examples section if source text is empty */}
      {!sourceText && (
        <div className="bg-[#161f30] border border-slate-800/80 p-4 rounded-xl space-y-2.5 animate-fadeIn">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Ví dụ nạp thử nghiệm</span>
          <div className="flex flex-wrap gap-2">
            {CHINESE_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => onLoadExample(idx)}
                className="bg-[#1c283f] border border-slate-700/65 hover:border-indigo-500 hover:bg-[#22314d] rounded-lg px-2.5 py-1 text-xs text-slate-300 font-bold transition cursor-pointer"
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
