import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import { GlossaryExportFormat, GlossaryExportOptions, GlossaryExportScope } from '../../services/glossaryIO';

export interface ExportGlossaryModalProps {
  open: boolean;
  onClose: () => void;
  totalCount: number;
  filteredCount: number;
  isFiltered: boolean;
  onExport: (options: GlossaryExportOptions) => void;
}

const FORMAT_OPTIONS: Array<{
  value: GlossaryExportFormat;
  label: string;
  ext: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'md',
    label: 'Markdown',
    ext: '.md',
    desc: 'Bảng phân nhóm dễ đọc, kèm cột Ngày thêm',
    icon: <FileText className="w-4 h-4 text-polish" />,
  },
  {
    value: 'csv',
    label: 'Bảng tính CSV',
    ext: '.csv',
    desc: 'UTF-8 BOM mở trực tiếp bằng Excel / Sheets, kèm Ngày thêm',
    icon: <FileSpreadsheet className="w-4 h-4 text-polish" />,
  },
  {
    value: 'json',
    label: 'Sao lưu JSON',
    ext: '.json',
    desc: 'Lưu trọn vẹn biến thể, hồ sơ nhân vật và thời gian tạo',
    icon: <FileJson className="w-4 h-4 text-polish" />,
  },
];

export const ExportGlossaryModal = React.memo(function ExportGlossaryModal({
  open,
  onClose,
  totalCount,
  filteredCount,
  isFiltered,
  onExport,
}: ExportGlossaryModalProps) {
  const [format, setFormat] = useState<GlossaryExportFormat>('md');
  const [scope, setScope] = useState<GlossaryExportScope>(isFiltered ? 'filtered' : 'all');

  const effectiveScope: GlossaryExportScope = isFiltered ? scope : 'all';
  const targetCount = effectiveScope === 'filtered' ? filteredCount : totalCount;

  const handleConfirm = () => {
    onExport({ format, scope: effectiveScope });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xuất Từ Điển Dự Án"
      description="Chọn định dạng tệp và phạm vi thuật ngữ cần xuất. Mọi định dạng đều bao gồm thông tin Ngày thêm."
      icon={<Download className="w-4 h-4" />}
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Định dạng tệp
          </div>
          <div className="grid grid-cols-1 gap-2">
            {FORMAT_OPTIONS.map((opt) => {
              const active = format === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-[3px] border text-left transition-colors cursor-pointer',
                    active
                      ? 'bg-polish/10 border-polish text-text-main'
                      : 'bg-ink border-parchment-2 text-text-muted hover:border-polish/50 hover:text-text-main'
                  )}
                >
                  <div className="mt-0.5 shrink-0">{opt.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-main">{opt.label}</span>
                      <Badge tone={active ? 'polish' : 'neutral'}>{opt.ext}</Badge>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Phạm vi xuất
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={cn(
                'p-2.5 rounded-[3px] border text-left transition-colors cursor-pointer',
                effectiveScope === 'all'
                  ? 'bg-polish/10 border-polish text-text-main'
                  : 'bg-ink border-parchment-2 text-text-muted hover:border-polish/50'
              )}
            >
              <div className="text-xs font-bold text-text-main">Toàn bộ từ điển</div>
              <div className="text-[11px] font-mono text-text-muted mt-0.5">{totalCount} thuật ngữ</div>
            </button>

            <button
              type="button"
              disabled={!isFiltered}
              onClick={() => setScope('filtered')}
              className={cn(
                'p-2.5 rounded-[3px] border text-left transition-colors',
                !isFiltered && 'opacity-45 cursor-not-allowed',
                isFiltered && 'cursor-pointer',
                effectiveScope === 'filtered' && isFiltered
                  ? 'bg-polish/10 border-polish text-text-main'
                  : 'bg-ink border-parchment-2 text-text-muted hover:border-polish/50'
              )}
            >
              <div className="text-xs font-bold text-text-main">Theo bộ lọc hiện tại</div>
              <div className="text-[11px] font-mono text-text-muted mt-0.5">
                {isFiltered ? `${filteredCount} thuật ngữ` : 'Chưa áp dụng bộ lọc'}
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-parchment-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button
            id="btn-confirm-export-glossary"
            variant="primary"
            size="sm"
            disabled={targetCount === 0}
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleConfirm}
          >
            Xuất {targetCount} thuật ngữ ({FORMAT_OPTIONS.find((f) => f.value === format)?.ext})
          </Button>
        </div>
      </div>
    </Modal>
  );
});

export default ExportGlossaryModal;
