import React from 'react';
import { Sparkles, Download, Link2, UploadCloud, Plus, X } from 'lucide-react';

export interface GlossaryHeaderProps {
  exportGlossaryToMd: () => void;
  glossaryLength: number;
  showDuplicatePanel: boolean;
  duplicateGroupsLength: number;
  handleOpenDuplicatePanel: () => void;
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
  isImporting,
  setIsImporting,
  isAdding,
  setIsAdding,
}: GlossaryHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-650" />
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
          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={glossaryLength === 0 ? 'Từ điển đang trống' : `Xuất ${glossaryLength} thuật ngữ ra file .md`}
        >
          <Download className="w-3.5 h-3.5" />
          Xuất từ điển (.md)
        </button>

        <button
          id="btn-filter-duplicates"
          onClick={handleOpenDuplicatePanel}
          disabled={glossaryLength < 2}
          className={`flex items-center gap-1.5 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            showDuplicatePanel && duplicateGroupsLength > 0
              ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200'
              : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
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
          id="btn-trigger-import-md"
          onClick={() => {
            setIsImporting(!isImporting);
            setIsAdding(false);
          }}
          className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
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
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
        >
          {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isAdding ? 'Hủy thêm mới' : 'Thêm từ mới'}
        </button>
      </div>
    </div>
  );
});
