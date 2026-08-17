import React from 'react';
import { FileText, Upload, Loader2, Check } from 'lucide-react';

export interface ImportChaptersModalProps {
  importedFileName: string;
  importFileRef: React.RefObject<HTMLInputElement | null>;
  handleImportRawFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importMode: 'append' | 'replace';
  setImportMode: (mode: 'append' | 'replace') => void;
  importSplitMethod: 'regex' | 'chunk';
  handleToggleImportSplitMethod: (method: 'regex' | 'chunk') => void;
  isParsingImportFile: boolean;
  parsedChaptersLength: number;
}

export const ImportChaptersModal = React.memo(function ImportChaptersModal({
  importedFileName,
  importFileRef,
  handleImportRawFileChange,
  importMode,
  setImportMode,
  importSplitMethod,
  handleToggleImportSplitMethod,
  isParsingImportFile,
  parsedChaptersLength,
}: ImportChaptersModalProps) {
  return (
    <div className="border-t border-parchment-2 pt-4 space-y-3">
      <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5 uppercase tracking-wider">
        <FileText className="w-4 h-4 text-polish" />
        Nhập thêm / Thay thế File truyện gốc (.txt, .epub)
      </h4>
      
      <div className="flex flex-wrap items-center gap-4 bg-ink p-3.5 rounded-[2px] border border-parchment-2">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".txt,.epub"
            ref={importFileRef}
            onChange={handleImportRawFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-1.5 bg-parchment hover:bg-parchment-2 text-text-main border border-parchment-2 text-xs font-semibold px-3 py-1.5 rounded-[2px] cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-polish" />
            Chọn File mới
          </button>
          <span className="text-xs text-text-muted truncate max-w-[150px]" title={importedFileName}>
            {importedFileName || "Chưa chọn tệp"}
          </span>
        </div>

        {importedFileName && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-text-muted font-medium">Chế độ nhập:</span>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text-main">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-polish cursor-pointer"
                />
                Nhập thêm (Append)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-polish" title="Thay thế hoàn toàn các chương cũ của truyện bằng file mới">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-polish cursor-pointer"
                />
                Thay thế (Replace)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Splitting mechanism settings for TXT */}
      {importedFileName && importedFileName.endsWith('.txt') && (
        <div className="bg-ink border border-parchment-2 p-2.5 rounded-[2px] space-y-1 text-xs">
          <span className="font-bold text-text-muted block">Cơ chế tự động phân chia chương văn bản:</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-main">
              <input
                type="radio"
                checked={importSplitMethod === 'regex'}
                onChange={() => handleToggleImportSplitMethod('regex')}
                className="accent-polish cursor-pointer"
              />
              Tìm theo tên chương (&quot;Chương x&quot;)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-main">
              <input
                type="radio"
                checked={importSplitMethod === 'chunk'}
                onChange={() => handleToggleImportSplitMethod('chunk')}
                className="accent-polish cursor-pointer"
              />
              Chia đều mỗi 8,000 ký tự
            </label>
          </div>
        </div>
      )}

      {/* Parsing status */}
      {isParsingImportFile ? (
        <div className="flex items-center gap-1.5 text-xs text-text-muted pt-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-polish" />
          <span>Đang bóc tách giải nén và phân tích cấu trúc...</span>
        </div>
      ) : parsedChaptersLength > 0 ? (
        <div className="bg-polish/10 text-text-main text-xs p-2.5 rounded-[2px] border border-polish/30 flex items-start gap-1.5 animate-fadeIn">
          <Check className="w-4 h-4 text-polish shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-polish">Giải tích tệp hoàn tất!</span>
            <span>Phát hiện thành công <strong>{parsedChaptersLength} chương</strong>. Sẽ được {importMode === 'replace' ? 'thay thế hoàn toàn cho' : 'nhập thêm vào sau'} danh sách chương hiện tại của truyện.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});
