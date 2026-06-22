import React from 'react';
import { FileText } from 'lucide-react';

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
}: ExportFilesPanelProps) {
  const maxLimit = exportMode === 'web' ? 20 : 10;

  return (
    <div id="export-txt-card" className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileText className="w-4 h-4 text-emerald-600" /> Sản xuất tập tin kết quả sau dịch
      </h3>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => handleExportModeChange('web')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'web' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
            <span className="text-[11px] font-bold">Web Truyện</span>
            <span className="text-[8px] text-slate-400 font-normal mt-0.5">Giữ tiêu đề (≤20 ch.)</span>
          </button>
          <button type="button" onClick={() => handleExportModeChange('audio')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'audio' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
            <span className="text-[11px] font-bold">Làm Audio</span>
            <span className="text-[8px] text-slate-400 font-normal mt-0.5">Xóa tiêu đề (≤10 ch.)</span>
          </button>
          <button type="button" onClick={() => handleExportModeChange('align_jsonl')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'align_jsonl' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
            <span className="text-[11px] font-bold">Gióng hàng FT</span>
            <span className="text-[8px] text-slate-400 font-normal mt-0.5">JSONL Song ngữ</span>
          </button>
        </div>
      </div>

      {exportMode !== 'align_jsonl' ? (
        <>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Gom chương mỗi tệp:</span>
              <span className="bg-emerald-600 text-white rounded-full px-2 py-0.5 text-[10px] font-extrabold">{chaptersPerFile} chương / file</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={maxLimit} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Number(e.target.value))} className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
              <input type="number" min={1} max={maxLimit} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Math.min(maxLimit, Math.max(1, Number(e.target.value))))} className="w-12 text-center text-xs border border-slate-250 rounded bg-slate-50 py-0.5 font-bold" />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-700 block">Lọc phạm vi xuất:</label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button type="button" onClick={() => setExportScope('translated')} className={`py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${exportScope === 'translated' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 font-semibold'}`}>Chỉ chương đã dịch</button>
              <button type="button" onClick={() => setExportScope('all')} className={`py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${exportScope === 'all' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 font-semibold'}`}>Toàn bộ dự án</button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-indigo-50/40 border border-indigo-100 p-3 rounded-lg text-[10px] text-indigo-900 leading-relaxed">• Mỗi chương trích một file `.jsonl` độc lập.<br />• Khớp sọc đối nghĩa Trung-Việt 100% làm học liệu huấn luyện tinh chỉnh AI.</div>
      )}

      <button onClick={exportMode === 'align_jsonl' ? handleExportAlignJsonl : handleExportTxt} disabled={isExportingTxt} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
        {isExportingTxt ? "Đang xử lý kết xuất..." : exportMode === 'align_jsonl' ? "Bắt đầu gióng hàng & tải .JSONL" : "Bắt đầu xuất tải tệp .TXT sỉ"}
      </button>
    </div>
  );
});
