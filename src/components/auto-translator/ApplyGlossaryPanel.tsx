import React from 'react';
import { BookOpen, ListOrdered, Check, Eye, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

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
    <div id="apply-glossary-card" className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs">
      <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-parchment-2 pb-2 font-display">
        <BookOpen className="w-4 h-4 text-amber-500" /> Áp dụng từ điển vào raw
      </h3>
      <p className="text-[11px] text-text-muted">Thay thế trước các từ tiếng Trung trong <strong>văn bản gốc</strong> của chương được chọn bằng bản dịch từ từ điển. Khi dịch tự động sẽ ưu tiên dùng văn bản đã xử lý này.</p>

      {/* Phạm vi chương */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-main flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-400" /> Giới hạn phạm vi chương</span>
          <button
            type="button"
            onClick={() => setApplyGlossaryRangeEnabled(!applyGlossaryRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${applyGlossaryRangeEnabled ? 'bg-amber-600' : 'bg-parchment-2'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${applyGlossaryRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {applyGlossaryRangeEnabled && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Từ chương</label>
              <input
                type="number" min={1} max={totalChapters}
                value={applyGlossaryRangeStart}
                onChange={e => {
                  const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                  setApplyGlossaryRangeStart(v);
                  if (v > applyGlossaryRangeEnd) setApplyGlossaryRangeEnd(v);
                }}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Đến chương</label>
              <input
                type="number" min={applyGlossaryRangeStart} max={totalChapters}
                value={applyGlossaryRangeEnd}
                onChange={e => setApplyGlossaryRangeEnd(Math.max(applyGlossaryRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="col-span-2 bg-ink border border-parchment-2 rounded-[2px] px-3 py-1.5 text-[11px] text-amber-300 flex items-center justify-between">
              <span className="text-text-muted">Phạm vi áp dụng:</span>
              <strong className="text-amber-400 font-bold">{applyGlossaryRangeEnd - applyGlossaryRangeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      {applyGlossaryResult && !isApplyingGlossary && (
        <div className="bg-ink border border-amber-800/30 rounded-[2px] px-3 py-2 text-[11px] text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Đã thay <strong>{applyGlossaryResult.replaced}</strong> thuật ngữ trên <strong>{applyGlossaryResult.chapters}</strong> chương.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            icon={<Eye className="w-3 h-3" />}
            className="text-amber-300 border-amber-800/40 hover:text-amber-200"
          >
            Xem chi tiết
          </Button>
        </div>
      )}

      {/* Nút xem chi tiết khi chưa có kết quả mới nhưng đã có chương được xử lý */}
      {!applyGlossaryResult && hasProcessedChapters && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onViewDetails}
          icon={<Eye className="w-3.5 h-3.5 text-amber-400" />}
          className="w-full text-amber-300 border-amber-800/40"
        >
          Xem chi tiết các chương đã xử lý
        </Button>
      )}

      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={isApplyingGlossary || isProcessing || glossaryLength === 0 || totalChapters === 0}
        onClick={handleApplyGlossaryToAllChapters}
        icon={isApplyingGlossary ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
      >
        {isApplyingGlossary
          ? 'Đang xử lý chương...'
          : `Áp dụng từ điển (${glossaryLength} từ / ${applyGlossaryRangeEnabled ? `${applyGlossaryRangeEnd - applyGlossaryRangeStart + 1}` : totalChapters} chương)`}
      </Button>
    </div>
  );
});

export default ApplyGlossaryPanel;
