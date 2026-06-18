import React from 'react';
import { BookOpen, ListOrdered, Check, Eye } from 'lucide-react';

export interface ApplyGlossaryPanelProps {
  applyGlossaryRangeEnabled: boolean;
  setApplyGlossaryRangeEnabled: (b: boolean) => void;
  applyGlossaryRangeStart: number;
  setApplyGlossaryRangeStart: (n: number) => void;
  applyGlossaryRangeEnd: number;
  setApplyGlossaryRangeEnd: (n: number) => void;
  totalChapters: number;
  glossaryLength: number;
  isApplyingGlossary: boolean;
  applyGlossaryResult: { replaced: number; chapters: number } | null;
  isProcessing: boolean;
  handleApplyGlossaryToAllChapters: () => void;
  onViewDetails: () => void;
  hasProcessedChapters: boolean;
}

export const ApplyGlossaryPanel = React.memo(function ApplyGlossaryPanel({
  applyGlossaryRangeEnabled,
  setApplyGlossaryRangeEnabled,
  applyGlossaryRangeStart,
  setApplyGlossaryRangeStart,
  applyGlossaryRangeEnd,
  setApplyGlossaryRangeEnd,
  totalChapters,
  glossaryLength,
  isApplyingGlossary,
  applyGlossaryResult,
  isProcessing,
  handleApplyGlossaryToAllChapters,
  onViewDetails,
  hasProcessedChapters,
}: ApplyGlossaryPanelProps) {
  return (
    <div id="apply-glossary-card" className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
        <BookOpen className="w-4 h-4 text-amber-600" /> Áp dụng từ điển vào raw
      </h3>
      <p className="text-[11px] text-slate-500">Thay thế trước các từ tiếng Trung trong <strong>văn bản gốc</strong> của chương được chọn bằng bản dịch từ từ điển. Khi dịch tự động sẽ ưu tiên dùng văn bản đã xử lý này.</p>

      {/* Phạm vi chương */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-500" /> Giới hạn phạm vi chương</span>
          <button
            type="button"
            onClick={() => setApplyGlossaryRangeEnabled(!applyGlossaryRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${applyGlossaryRangeEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${applyGlossaryRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {applyGlossaryRangeEnabled && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Từ chương</label>
              <input
                type="number" min={1} max={totalChapters}
                value={applyGlossaryRangeStart}
                onChange={e => {
                  const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                  setApplyGlossaryRangeStart(v);
                  if (v > applyGlossaryRangeEnd) setApplyGlossaryRangeEnd(v);
                }}
                className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Đến chương</label>
              <input
                type="number" min={applyGlossaryRangeStart} max={totalChapters}
                value={applyGlossaryRangeEnd}
                onChange={e => setApplyGlossaryRangeEnd(Math.max(applyGlossaryRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
              <span>Phạm vi áp dụng:</span>
              <strong className="text-amber-700 font-extrabold">{applyGlossaryRangeEnd - applyGlossaryRangeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      {applyGlossaryResult && !isApplyingGlossary && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Đã thay <strong>{applyGlossaryResult.replaced}</strong> thuật ngữ trên <strong>{applyGlossaryResult.chapters}</strong> chương.</span>
          </div>
          <button
            type="button"
            onClick={onViewDetails}
            className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-bold shrink-0 border border-amber-300 bg-white px-2 py-0.5 rounded cursor-pointer hover:bg-amber-50 transition-colors"
          >
            <Eye className="w-3 h-3" /> Xem chi tiết
          </button>
        </div>
      )}

      {/* Nút xem chi tiết khi chưa có kết quả mới nhưng đã có chương được xử lý */}
      {!applyGlossaryResult && hasProcessedChapters && (
        <button
          type="button"
          onClick={onViewDetails}
          className="w-full flex items-center justify-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold px-3 py-1.5 rounded text-xs cursor-pointer transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Xem chi tiết các chương đã xử lý
        </button>
      )}

      <button
        type="button"
        disabled={isApplyingGlossary || isProcessing || glossaryLength === 0 || totalChapters === 0}
        onClick={handleApplyGlossaryToAllChapters}
        className={`w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
          isApplyingGlossary
            ? 'bg-amber-400 text-white cursor-wait'
            : 'bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        {isApplyingGlossary ? (
          <><RefreshCwIcon className="w-3.5 h-3.5 animate-spin" /> Đang xử lý chương...</>
        ) : (
          <><BookOpen className="w-3.5 h-3.5" /> Áp dụng từ điển ({glossaryLength} từ / {applyGlossaryRangeEnabled ? `${applyGlossaryRangeEnd - applyGlossaryRangeStart + 1}` : totalChapters} chương)</>
        )}
      </button>
    </div>
  );
});

function RefreshCwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
