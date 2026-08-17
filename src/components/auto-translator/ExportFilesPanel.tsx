import React from 'react';
import { FileText, ListOrdered } from 'lucide-react';

export interface ExportFilesPanelProps {
  exportMode: 'web' | 'audio' | 'align_jsonl';
  handleExportModeChange: (mode: 'web' | 'audio' | 'align_jsonl') => void;
  chaptersPerFile: number;
  setChaptersPerFile: (n: number) => void;
  exportScope: 'all' | 'translated';
  setExportScope: (scope: 'all' | 'translated') => void;
  isExportingTxt: boolean;
  handleExportTxt: () => void;
  handleExportAlignJsonl: () => void;
  exportRangeEnabled: boolean;
  setExportRangeEnabled: (b: boolean) => void;
  exportRangeStart: number;
  setExportRangeStart: (n: number) => void;
  exportRangeEnd: number;
  setExportRangeEnd: (n: number) => void;
  totalChapters: number;
}

export const ExportFilesPanel = React.memo(function ExportFilesPanel({
  exportMode,
  handleExportModeChange,
  chaptersPerFile,
  setChaptersPerFile,
  exportScope,
  setExportScope,
  isExportingTxt,
  handleExportTxt,
  handleExportAlignJsonl,
  exportRangeEnabled,
  setExportRangeEnabled,
  exportRangeStart,
  setExportRangeStart,
  exportRangeEnd,
  setExportRangeEnd,
  totalChapters,
}: ExportFilesPanelProps) {
  const maxLimit = exportMode === 'web' ? 20 : 10;
  const safeStart = Math.max(1, Math.min(exportRangeStart, totalChapters));
  const safeEnd = Math.max(safeStart, Math.min(exportRangeEnd, totalChapters));

  return (
    <div id="export-txt-card" className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs">
      <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-parchment-2 pb-2">
        <FileText className="w-4 h-4 text-polish" /> Sản xuất tập tin kết quả sau dịch
      </h3>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => handleExportModeChange('web')} className={`py-2 px-1 rounded-[2px] text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'web' ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>
            <span className="text-[11px] font-bold">Web Truyện</span>
            <span className="text-[8px] text-text-muted font-normal mt-0.5">Giữ tiêu đề (≤20 ch.)</span>
          </button>
          <button type="button" onClick={() => handleExportModeChange('audio')} className={`py-2 px-1 rounded-[2px] text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'audio' ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>
            <span className="text-[11px] font-bold">Làm Audio</span>
            <span className="text-[8px] text-text-muted font-normal mt-0.5">Xóa tiêu đề (≤10 ch.)</span>
          </button>
          <button type="button" onClick={() => handleExportModeChange('align_jsonl')} className={`py-2 px-1 rounded-[2px] text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'align_jsonl' ? 'border-draft bg-draft/20 text-text-main font-bold' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>
            <span className="text-[11px] font-bold">Gióng hàng FT</span>
            <span className="text-[8px] text-text-muted font-normal mt-0.5">JSONL Song ngữ</span>
          </button>
        </div>
      </div>

      {exportMode !== 'align_jsonl' ? (
        <>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-text-main">Gom chương mỗi tệp:</span>
              <span className="bg-ink border border-parchment-2 text-polish rounded-[2px] px-2.5 py-0.5 text-[10px] font-bold">{chaptersPerFile} chương / file</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={maxLimit} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Number(e.target.value))} className="flex-1 h-1.5 bg-ink rounded-lg appearance-none cursor-pointer accent-polish" />
              <input type="number" min={1} max={maxLimit} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Math.min(maxLimit, Math.max(1, Number(e.target.value))))} className="w-12 text-center text-xs border border-parchment-2 rounded-[2px] bg-ink py-0.5 font-bold text-text-main focus:outline-none focus:border-polish" />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-text-main block">Lọc phạm vi xuất:</label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button type="button" onClick={() => setExportScope('translated')} className={`py-1.5 px-2 rounded-[2px] text-xs font-bold border cursor-pointer ${exportScope === 'translated' ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>Chỉ chương đã dịch</button>
              <button type="button" onClick={() => setExportScope('all')} className={`py-1.5 px-2 rounded-[2px] text-xs font-bold border cursor-pointer ${exportScope === 'all' ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>Toàn bộ dự án</button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-draft/15 border border-draft/30 p-3 rounded-[2px] text-[10px] text-text-main leading-relaxed">• Mỗi chương trích một file `.jsonl` độc lập.<br />• Khớp sọc đối nghĩa Trung-Việt 100% làm học liệu huấn luyện tinh chỉnh AI.</div>
      )}

      {/* Giới hạn phân đoạn vùng chương xuất */}
      <div className="space-y-2.5 pt-3 border-t border-parchment-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-polish" /> Giới hạn phạm vi chương xuất
            </span>
            <span className="text-[10px] text-text-muted font-normal mt-0.5">
              Chỉ xuất các chương trong khoảng đã chọn
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExportRangeEnabled(!exportRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${exportRangeEnabled ? 'bg-polish' : 'bg-parchment-2'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${exportRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {exportRangeEnabled && (
          <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase block">Từ số</label>
                <input
                  type="number"
                  min={1}
                  max={totalChapters}
                  value={exportRangeStart}
                  onChange={e => {
                    const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                    setExportRangeStart(v);
                    if (v > exportRangeEnd) setExportRangeEnd(v);
                  }}
                  className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-text-main focus:outline-none focus:border-polish"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase block">Đến số</label>
                <input
                  type="number"
                  min={exportRangeStart}
                  max={totalChapters}
                  value={exportRangeEnd}
                  onChange={e => setExportRangeEnd(Math.max(exportRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                  className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-text-main focus:outline-none focus:border-polish"
                />
              </div>
            </div>
            <div className="bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-[11px] text-text-main flex items-center justify-between">
              <span className="text-text-muted">Số chương trong phạm vi:</span>
              <strong className="text-polish font-bold">{totalChapters > 0 ? (safeEnd - safeStart + 1) : 0} chương</strong>
            </div>
          </div>
        )}
      </div>

      <button onClick={exportMode === 'align_jsonl' ? handleExportAlignJsonl : handleExportTxt} disabled={isExportingTxt} className="w-full py-2.5 bg-polish hover:bg-[#A03522] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[2px] text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer glow-polish">
        {isExportingTxt ? "Đang xử lý kết xuất..." : exportMode === 'align_jsonl' ? "Bắt đầu gióng hàng & tải .JSONL" : "Bắt đầu xuất tải tệp .TXT sỉ"}
      </button>
    </div>
  );
});
