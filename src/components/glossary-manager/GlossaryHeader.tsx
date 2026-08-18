import React from 'react';
import { Sparkles, Download, Link2, UploadCloud, Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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
        <Button
          id="btn-export-glossary-md"
          variant="secondary"
          size="sm"
          onClick={exportGlossaryToMd}
          disabled={glossaryLength === 0}
          icon={<Download className="w-3.5 h-3.5 text-polish" />}
          title={glossaryLength === 0 ? 'Từ điển đang trống' : `Xuất ${glossaryLength} thuật ngữ ra file .md`}
        >
          Xuất từ điển (.md)
        </Button>

        <Button
          id="btn-filter-duplicates"
          variant={showDuplicatePanel && duplicateGroupsLength > 0 ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleOpenDuplicatePanel}
          disabled={glossaryLength < 2}
          icon={<Link2 className="w-3.5 h-3.5" />}
          className={
            showDuplicatePanel && duplicateGroupsLength > 0
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/50 hover:bg-amber-950/60'
              : ''
          }
          title="Quét và lọc các từ bị trùng tiếng Trung hoặc tiếng Việt trong từ điển"
        >
          Lọc từ trùng
          {showDuplicatePanel && duplicateGroupsLength > 0 && (
            <Badge tone="warning" className="ml-0.5">
              {duplicateGroupsLength}
            </Badge>
          )}
        </Button>

        <Button
          id="btn-merge-han-variants"
          variant={showMergeHanPanel && mergeGroupsLength > 0 ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleOpenMergeHanPanel}
          disabled={glossaryLength < 2}
          icon={<Sparkles className="w-3.5 h-3.5 text-polish" />}
          className={
            showMergeHanPanel && mergeGroupsLength > 0
              ? 'bg-polish/20 text-polish border-polish/40 hover:bg-polish/30'
              : ''
          }
          title="Quét các từ bị trùng do khác ký tự Phồn/Giản để gộp thành biến thể"
        >
          Gộp Phồn/Giản
          {showMergeHanPanel && mergeGroupsLength > 0 && (
            <Badge tone="polish" className="ml-0.5">
              {mergeGroupsLength}
            </Badge>
          )}
        </Button>

        <Button
          id="btn-trigger-import-md"
          variant="secondary"
          size="sm"
          onClick={() => {
            setIsImporting(!isImporting);
            setIsAdding(false);
          }}
          icon={<UploadCloud className="w-3.5 h-3.5 text-polish" />}
        >
          Nhập file cẩm nang (.md)
        </Button>

        <Button
          id="btn-trigger-add-glossary"
          variant="primary"
          size="sm"
          onClick={() => {
            setIsAdding(!isAdding);
            setIsImporting(false);
          }}
          icon={isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        >
          {isAdding ? 'Hủy thêm mới' : 'Thêm từ mới'}
        </Button>
      </div>
    </div>
  );
});

export default GlossaryHeader;
