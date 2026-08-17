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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-parchment border border-parchment-2 p-4 rounded-md shadow-xs">
      <div>
        <h2 className="text-sm font-display font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-polish" />
          Từ Điển Quy Định Dự Án &amp; Kho Cẩm Nang
        </h2>
        <p className="text-xs text-text-muted">
          Khai báo thuật ngữ để AI dịch nhất quán văn phong. Hệ thống tự động ghi nhận thời gian tạo và hỗ trợ tra cứu từ vựng theo ngày.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          id="btn-export-glossary-md"
          onClick={exportGlossaryToMd}
          disabled={glossaryLength === 0}
          className="flex items-center gap-1.5 bg-ink hover:bg-parchment-2 border border-parchment-2 text-text-main font-semibold px-3 py-1.5 text-xs rounded-[2px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={glossaryLength === 0 ? 'Từ điển đang trống' : `Xuất ${glossaryLength} thuật ngữ ra file .md`}
        >
          <Download className="w-3.5 h-3.5 text-polish" />
          Xuất từ điển (.md)
        </button>

        <button
          id="btn-filter-duplicates"
          onClick={handleOpenDuplicatePanel}
          disabled={glossaryLength < 2}
          className={`flex items-center gap-1.5 font-semibold px-3 py-1.5 text-xs rounded-[2px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            showDuplicatePanel && duplicateGroupsLength > 0
              ? 'bg-amber-950/30 hover:bg-amber-950/50 text-amber-300 border border-amber-800/50'
              : 'bg-ink hover:bg-parchment-2 text-text-muted hover:text-text-main border border-parchment-2'
          }`}
          title="Quét và lọc các từ bị trùng tiếng Trung hoặc tiếng Việt trong từ điển"
        >
          <Link2 className="w-3.5 h-3.5" />
          Lọc từ trùng
          {showDuplicatePanel && duplicateGroupsLength > 0 && (
            <span className="bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
              {duplicateGroupsLength}
            </span>
          )}
        </button>

        <button
          id="btn-merge-han-variants"
          onClick={handleOpenMergeHanPanel}
          disabled={glossaryLength < 2}
          className={`flex items-center gap-1.5 font-semibold px-3 py-1.5 text-xs rounded-[2px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            showMergeHanPanel && mergeGroupsLength > 0
              ? 'bg-amber-950/30 hover:bg-amber-950/50 text-amber-300 border border-amber-800/50'
              : 'bg-ink hover:bg-parchment-2 text-text-muted hover:text-text-main border border-parchment-2'
          }`}
          title="Quét các từ bị trùng do khác ký tự Phồn/Giản để gộp thành biến thể"
        >
          <Sparkles className="w-3.5 h-3.5 text-polish" />
          Gộp Phồn/Giản
          {showMergeHanPanel && mergeGroupsLength > 0 && (
            <span className="bg-polish text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
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
          className="flex items-center gap-1.5 bg-ink hover:bg-parchment-2 border border-parchment-2 text-text-main font-semibold px-3 py-1.5 text-xs rounded-[2px] transition-all cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-polish" />
          Nhập file cẩm nang (.md)
        </button>

        <button
          id="btn-trigger-add-glossary"
          onClick={() => {
            setIsAdding(!isAdding);
            setIsImporting(false);
          }}
          className="flex items-center gap-1.5 bg-polish hover:bg-[#A03522] text-white font-bold px-3.5 py-1.5 text-xs rounded-[2px] transition-all cursor-pointer shadow-xs"
        >
          {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isAdding ? 'Hủy thêm mới' : 'Thêm từ mới'}
        </button>
      </div>
    </div>
  );
});
