import React, { useState } from 'react';
import { FileText, UploadCloud, Sparkles, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import { DuplicateResolutionStrategy, GlossaryImportPreview } from '../../services/glossaryIO';

export interface ImportGuidelinesModalProps {
  isImporting: boolean;
  setIsImporting: (b: boolean) => void;
  mdFileName: string;
  isAnalyzingMd: boolean;
  mdInputRef: React.RefObject<HTMLInputElement | null>;
  handleMdImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportFile: (file: File) => void;
  importPreview: GlossaryImportPreview | null;
  importError: string | null;
  confirmImport: (strategy: DuplicateResolutionStrategy) => void;
  retryImportWithAi: () => void;
  resetImportPreview: () => void;
}

export const ImportGuidelinesModal = React.memo(function ImportGuidelinesModal({
  isImporting,
  setIsImporting,
  mdFileName,
  isAnalyzingMd,
  mdInputRef,
  handleMdImportFileChange,
  handleImportFile,
  importPreview,
  importError,
  confirmImport,
  retryImportWithAi,
  resetImportPreview,
}: ImportGuidelinesModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [strategy, setStrategy] = useState<DuplicateResolutionStrategy>('review');

  const handleClose = () => {
    setIsDragging(false);
    resetImportPreview();
    setIsImporting(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAnalyzingMd) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isAnalyzingMd) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImportFile(file);
    }
  };

  const hasConflicts = (importPreview?.conflicts.length ?? 0) > 0;
  const totalParsed = (importPreview?.cleanItems.length ?? 0) + (importPreview?.conflicts.length ?? 0);

  return (
    <Modal
      open={isImporting}
      onClose={handleClose}
      title="Nhập Thuật Ngữ Từ Cẩm Nang & Từ Điển"
      description="Hỗ trợ tệp cấu trúc (.md, .csv, .json) đọc trực tiếp ngoại tuyến giữ nguyên Ngày thêm, hoặc cẩm nang văn xuôi (.md, .txt) trích xuất bằng AI."
      icon={<FileText className="w-4 h-4" />}
      size="xl"
    >
      <div id="md-uploader-zone" className="space-y-4">
        {!importPreview && (
          <div
            onClick={() => !isAnalyzingMd && mdInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed bg-ink p-8 rounded-md text-center transition-all flex flex-col items-center justify-center space-y-3 group',
              isAnalyzingMd ? 'opacity-60 cursor-wait' : 'cursor-pointer',
              isDragging
                ? 'border-polish bg-polish/5'
                : 'border-parchment-2 hover:border-polish'
            )}
          >
            <UploadCloud
              className={cn(
                'w-9 h-9 transition-colors',
                isDragging ? 'text-polish' : 'text-text-muted group-hover:text-polish'
              )}
            />
            <div className="text-xs font-medium text-text-main">
              {mdFileName ? (
                <span className="text-polish font-bold block">{mdFileName} (Nhấp hoặc thả tệp khác để thay đổi)</span>
              ) : (
                <span>
                  Kéo thả tệp cẩm nang / từ điển tại đây hoặc{' '}
                  <strong className="text-polish font-bold">Nhấp để chọn tệp từ máy</strong>
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-muted font-mono">
              Định dạng hỗ trợ: .md, .csv, .json, .txt (tối đa 10 MB)
            </span>
            <input
              type="file"
              accept=".md,.markdown,.txt,.csv,.json"
              ref={mdInputRef}
              onChange={handleMdImportFileChange}
              className="hidden"
            />
          </div>
        )}

        {isAnalyzingMd && (
          <div className="flex items-center gap-2 justify-center py-2.5 text-polish bg-ink border border-parchment-2 rounded-[2px] text-xs font-bold animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-polish" />
            Đang phân tích nội dung tệp... Vui lòng chờ trong giây lát.
          </div>
        )}

        {importError && !isAnalyzingMd && (
          <div className="flex items-start gap-2.5 p-3 rounded-[3px] bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Không thể đọc tệp đã chọn</div>
              <div className="text-amber-200/90">{importError}</div>
            </div>
          </div>
        )}

        {importPreview && !isAnalyzingMd && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-[3px] bg-ink border border-parchment-2 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-polish shrink-0" />
                  <span className="text-xs font-bold text-text-main truncate">{importPreview.fileName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={importPreview.mode === 'direct' ? 'polish' : 'warning'}>
                    {importPreview.mode === 'direct' ? 'Đọc trực tiếp (ngoại tuyến)' : 'Trích xuất AI'}
                  </Badge>
                  <Badge tone="neutral">.{importPreview.sourceFormat}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-[2px] bg-parchment border border-parchment-2">
                  <div className="text-[10px] text-text-muted uppercase">Tổng đọc được</div>
                  <div className="text-sm font-mono font-bold text-text-main">{totalParsed}</div>
                </div>
                <div className="p-2 rounded-[2px] bg-parchment border border-parchment-2">
                  <div className="text-[10px] text-text-muted uppercase">Từ mới hợp lệ</div>
                  <div className="text-sm font-mono font-bold text-polish">{importPreview.cleanItems.length}</div>
                </div>
                <div className="p-2 rounded-[2px] bg-parchment border border-parchment-2">
                  <div className="text-[10px] text-text-muted uppercase">Trùng / Lặp</div>
                  <div className="text-sm font-mono font-bold text-amber-300">{importPreview.conflicts.length}</div>
                </div>
              </div>

              {(importPreview.skippedRows > 0 || importPreview.warnings.length > 0) && (
                <div className="p-2.5 rounded-[2px] bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px] space-y-1">
                  {importPreview.skippedRows > 0 && (
                    <div>Đã bỏ qua {importPreview.skippedRows} dòng thiếu Tiếng Trung hoặc Tiếng Việt.</div>
                  )}
                  {importPreview.warnings.map((w, idx) => (
                    <div key={idx}>{w}</div>
                  ))}
                </div>
              )}
            </div>

            {hasConflicts && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Xử lý {importPreview.conflicts.length} mục trùng lặp
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      value: 'review' as const,
                      label: 'Rà soát trùng lặp',
                      desc: 'Chuyển vào hàng chờ để kiểm tra từng từ',
                    },
                    {
                      value: 'skip' as const,
                      label: 'Bỏ qua từ trùng',
                      desc: 'Chỉ thêm các thuật ngữ mới hoàn toàn',
                    },
                    {
                      value: 'overwrite' as const,
                      label: 'Ghi đè từ trùng',
                      desc: 'Cập nhật mục trùng chữ Hán bằng dữ liệu mới',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStrategy(opt.value)}
                      className={cn(
                        'p-2.5 rounded-[3px] border text-left transition-colors cursor-pointer',
                        strategy === opt.value
                          ? 'bg-polish/10 border-polish text-text-main'
                          : 'bg-ink border-parchment-2 text-text-muted hover:border-polish/50'
                      )}
                    >
                      <div className="text-xs font-bold text-text-main">{opt.label}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-parchment-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={resetImportPreview}
                >
                  Chọn tệp khác
                </Button>
                {importPreview.mode === 'direct' && importPreview.rawTextForAiFallback && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Sparkles className="w-3.5 h-3.5 text-polish" />}
                    onClick={retryImportWithAi}
                  >
                    Phân tích thêm bằng AI
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  Hủy
                </Button>
                <Button
                  id="btn-confirm-import-glossary"
                  variant="primary"
                  size="sm"
                  disabled={totalParsed === 0}
                  onClick={() => confirmImport(hasConflicts ? strategy : 'skip')}
                >
                  Xác nhận nhập từ điển
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
});

export default ImportGuidelinesModal;
