import React from 'react';
import { Sparkles, Download, Link2, UploadCloud, Plus, X } from 'lucide-react';

export interface GlossaryHeaderProps {
  exportGlossaryToMd: () => void;
  glossaryLength: number;
  showDuplicatePanel: boolean;
  duplicateGroupsLength: number;
  handleOpenDuplicatePanel: () => void;
  showMergeHanPanel: boolean;
  mergeGroupsLength: number;
  handleOpenMergeHanPanel: () => void;
  isImporting: boolean;
  setIsImporting: (b: boolean) => void;
  isAdding: boolean;
  setIsAdding: (b: boolean) => void;
}

export const GlossaryHeader = React.memo(function GlossaryHeader({
  exportGlossaryToMd,
  glossaryLength,
  showDuplicatePanel,
  duplicateGroupsLength,
  handleOpenDuplicatePanel,
  showMergeHanPanel,
  mergeGroupsLength,
  handleOpenMergeHanPanel,
  isImporting,
  setIsImporting,
  isAdding,
  setIsAdding,
}: GlossaryHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/40 border border-slate-800 p-4 rounded-xl shadow-xl backdrop-blur-md">
      <div>
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Từ Điển Quy Định Dự Án &amp; Kho Cẩm Nang
        </h2>
        <p className="text-xs text-slate-400">
          Khai báo thuật ngữ để AI dịch nhất quán văn phong. Hệ thống tự động ghi nhận thời gian tạo và hỗ trợ tra cứu từ vựng theo ngày.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          id="btn-export-glossary-md"
          onClick={exportGlossaryToMd}
          disabled={glossaryLength === 0}
          className="flex items-center gap-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-900/50 text-emerald-400 font-bold px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={glossaryLength === 0 ? 'Từ điển đang trống' : `Xuất ${glossaryLength} thuật ngữ ra file .md`}
        >
          <Download className="w-3.5 h-3.5" />
          Xuất từ điển (.md)
        </button>

        <button
          id="btn-filter-duplicates"
          onClick={handleOpenDuplicatePanel}
          disabled={glossaryLength < 2}
          className={`flex items-center gap-1.5 font-bold px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            showDuplicatePanel && duplicateGroupsLength > 0
              ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50'
              : 'bg-violet-950/40 hover:bg-violet-900/60 text-violet-400 border border-violet-900/50'
          }`}
          title="Quét và lọc các từ bị trùng tiếng Trung hoặc tiếng Việt trong từ điển"
        >
          <Link2 className="w-3.5 h-3.5" />
          Lọc từ trùng
          {showDuplicatePanel && duplicateGroupsLength > 0 && (
            <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5">
              {duplicateGroupsLength}
            </span>
          )}
        </button>

        <button
          id="btn-merge-han-variants"
          onClick={handleOpenMergeHanPanel}
          disabled={glossaryLength < 2}
          className={`flex items-center gap-1.5 font-bold px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            showMergeHanPanel && mergeGroupsLength > 0
              ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-900/50'
              : 'bg-amber-950/20 hover:bg-amber-900/40 text-amber-500/80 border border-amber-900/30'
          }`}
          title="Quét các từ bị trùng do khác ký tự Phồn/Giản để gộp thành biến thể"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Gộp Phồn/Giản
          {showMergeHanPanel && mergeGroupsLength > 0 && (
            <span className="bg-amber-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5">
              {mergeGroupsLength}
            </span>
          )}
        </button>

        <button
          id="btn-trigger-import-md"
          onClick={() => {
            setIsImporting(!isImporting);
            setIsAdding(false);
          }}
          className="flex items-center gap-1.5 bg-slate-950/40 hover:bg-slate-900/60 border border-slate-800 text-indigo-400 font-bold px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Nhập file cẩm nang (.md)
        </button>

        <button
          id="btn-trigger-add-glossary"
          onClick={() => {
            setIsAdding(!isAdding);
            setIsImporting(false);
          }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer"
        >
          {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isAdding ? 'Hủy thêm mới' : 'Thêm từ mới'}
        </button>
      </div>
    </div>
  );
});
