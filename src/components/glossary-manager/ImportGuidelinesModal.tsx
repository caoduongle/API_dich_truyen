import React from 'react';
import { X, FileText, UploadCloud, Sparkles } from 'lucide-react';

export interface ImportGuidelinesModalProps {
  isImporting: boolean;
  setIsImporting: (b: boolean) => void;
  mdFileName: string;
  isAnalyzingMd: boolean;
  mdInputRef: React.RefObject<HTMLInputElement | null>;
  handleMdImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImportGuidelinesModal = React.memo(function ImportGuidelinesModal({
  isImporting,
  setIsImporting,
  mdFileName,
  isAnalyzingMd,
  mdInputRef,
  handleMdImportFileChange,
}: ImportGuidelinesModalProps) {
  if (!isImporting) return null;

  return (
    <div id="md-uploader-zone" className="bg-parchment border border-parchment-2 p-4 rounded-md space-y-3.5 animate-slideUp shadow-xs">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5 font-display">
            <FileText className="w-4 h-4 text-polish" />
            Đồng bộ hóa thuật ngữ từ Cẩm Nang Markdown
          </h3>
          <p className="text-xs text-text-muted">
            Hãy tải lên tệp cẩm nang dịch (.md). Trí tuệ nhân tạo sẽ tự động Sàng lọc cấu trúc các bảng từ khóa, sau đó thực hiện rà soát chuyên nghiệp loại bỏ tuyệt đối các từ ngữ bị trùng khớp.
          </p>
        </div>
        <button onClick={() => setIsImporting(false)} className="text-text-muted hover:text-text-main cursor-pointer p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        onClick={() => mdInputRef.current?.click()}
        className="border-2 border-dashed border-parchment-2 hover:border-polish bg-ink p-6 rounded-md text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
      >
        <UploadCloud className="w-8 h-8 text-text-muted group-hover:text-polish transition-colors" />
        <div className="text-xs font-medium text-text-main">
          {mdFileName ? (
            <span className="text-polish font-bold block">{mdFileName} (Nhấp phát nữa để đổi tệp)</span>
          ) : (
            <span>Kéo thả tệp cẩm nang truyện (.md) tại đây hoặc <strong className="text-polish font-bold">Nhấp để mở thư mục tìm kiếm</strong></span>
          )}
        </div>
        <span className="text-[10px] text-text-muted font-mono">Định dạng khuyên dùng: .md</span>
        <input type="file" accept=".md" ref={mdInputRef} onChange={handleMdImportFileChange} className="hidden" />
      </div>

      {isAnalyzingMd && (
        <div className="flex items-center gap-2 justify-center py-2 text-polish bg-ink border border-parchment-2 rounded-[2px] text-xs font-bold animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin text-polish" />
          Đang phân tích cấu trúc cẩm nang bằng AI... Vui lòng chờ một đến hai giây.
        </div>
      )}
    </div>
  );
});
