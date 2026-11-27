import { useState } from 'react';
import { Check, AlertTriangle, Sparkles, FileCode2, X } from 'lucide-react';
import { GlossaryItem } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export type GuidelineApplyMode = 'replace' | 'merge' | 'keep';

export interface GuidelineImportSelection {
  genre: 'apply' | 'keep';
  tone: 'apply' | 'keep';
  description: GuidelineApplyMode;
  glossary: GuidelineApplyMode;
}

export interface GuidelineImportPreviewData {
  fileName: string;
  analysisMode: 'ai' | 'local_fallback';
  genre: string;
  tone: string;
  description: string;
  extractedGlossary: Omit<GlossaryItem, 'id'>[];
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
  proseLength?: number;
  warnings: string[];
}

export interface GuidelineImportPreviewProps {
  preview: GuidelineImportPreviewData;
  hasExistingRules: boolean;
  existingGlossaryCount: number;
  onConfirm: (selection: GuidelineImportSelection) => void;
  onCancel: () => void;
}

export function GuidelineImportPreview({
  preview,
  hasExistingRules,
  existingGlossaryCount,
  onConfirm,
  onCancel,
}: GuidelineImportPreviewProps) {
  const [genreAction, setGenreAction] = useState<'apply' | 'keep'>(preview.genre ? 'apply' : 'keep');
  const [toneAction, setToneAction] = useState<'apply' | 'keep'>(preview.tone ? 'apply' : 'keep');
  const [descriptionAction, setDescriptionAction] = useState<GuidelineApplyMode>(
    !preview.description ? 'keep' : hasExistingRules ? 'merge' : 'replace'
  );
  const [glossaryAction, setGlossaryAction] = useState<GuidelineApplyMode>(
    preview.extractedGlossary.length === 0 ? 'keep' : existingGlossaryCount > 0 ? 'merge' : 'replace'
  );
  const [confirmReplaceGlossary, setConfirmReplaceGlossary] = useState(false);

  const needsReplaceGlossaryConfirm =
    glossaryAction === 'replace' && existingGlossaryCount > 0 && preview.extractedGlossary.length > 0;

  return (
    <div className="bg-ink border border-polish/40 rounded-md p-4 space-y-3 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-parchment-2 pb-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
              {preview.analysisMode === 'ai' ? (
                <Sparkles className="w-3.5 h-3.5 text-polish shrink-0" />
              ) : (
                <FileCode2 className="w-3.5 h-3.5 text-polish shrink-0" />
              )}
              Xem trước Cẩm nang nhập từ tệp
            </span>
            <Badge tone={preview.analysisMode === 'ai' ? 'polish' : 'warning'}>
              {preview.analysisMode === 'ai' ? 'Phân tích AI + Parser' : 'Trích xuất cục bộ'}
            </Badge>
          </div>
          <p className="text-[11px] text-text-muted truncate" title={preview.fileName}>
            Tệp: <span className="font-mono text-text-main">{preview.fileName}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Đóng xem trước"
          className="text-text-muted hover:text-text-main hover:bg-parchment-2 p-1 rounded-[2px] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {preview.warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-[2px] p-2.5 space-y-1 text-[11px]">
          {preview.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-parchment border border-parchment-2 rounded-[2px] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-text-muted">Thể loại nhận diện</span>
            {preview.genre && (
              <select
                aria-label="Chế độ áp dụng thể loại"
                value={genreAction}
                onChange={(e) => setGenreAction(e.target.value as 'apply' | 'keep')}
                className="text-[11px] bg-ink border border-parchment-2 rounded-[2px] px-2 py-0.5 text-text-main"
              >
                <option value="apply">Áp dụng thể loại mới</option>
                <option value="keep">Giữ hiện tại</option>
              </select>
            )}
          </div>
          <p className="font-semibold text-text-main">
            {preview.genre || <span className="text-text-muted italic">Không xác định rõ trong tệp</span>}
          </p>
        </div>

        <div className="bg-parchment border border-parchment-2 rounded-[2px] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-text-muted">Tông giọng nhận diện</span>
            {preview.tone && (
              <select
                aria-label="Chế độ áp dụng tông giọng"
                value={toneAction}
                onChange={(e) => setToneAction(e.target.value as 'apply' | 'keep')}
                className="text-[11px] bg-ink border border-parchment-2 rounded-[2px] px-2 py-0.5 text-text-main"
              >
                <option value="apply">Áp dụng tông giọng mới</option>
                <option value="keep">Giữ hiện tại</option>
              </select>
            )}
          </div>
          <p className="font-semibold text-text-main">
            {preview.tone || <span className="text-text-muted italic">Không xác định rõ trong tệp</span>}
          </p>
        </div>
      </div>

      <div className="bg-parchment border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-bold text-text-muted">
            Quy tắc dịch & Cẩm nang ({preview.description.length.toLocaleString()} ký tự)
          </span>
          {preview.description && (
            <select
              aria-label="Chế độ áp dụng quy tắc dịch"
              value={descriptionAction}
              onChange={(e) => setDescriptionAction(e.target.value as GuidelineApplyMode)}
              className="text-[11px] bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main"
            >
              <option value="replace">Thay thế quy tắc hiện tại</option>
              {hasExistingRules && <option value="merge">Chèn bổ sung vào cuối quy tắc hiện tại</option>}
              <option value="keep">Giữ nguyên quy tắc hiện tại</option>
            </select>
          )}
        </div>
        {preview.description ? (
          <pre className="text-[11px] text-text-main whitespace-pre-wrap font-sans max-h-32 overflow-y-auto bg-ink border border-parchment-2 rounded-[2px] p-2 leading-relaxed">
            {preview.description}
          </pre>
        ) : (
          <p className="text-[11px] text-text-muted italic">Không tìm thấy phần quy tắc văn xuôi trong tệp.</p>
        )}
      </div>

      <div className="bg-parchment border border-parchment-2 rounded-[2px] p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-bold text-text-muted">
            Thuật ngữ trích xuất ({preview.extractedGlossary.length} từ)
          </span>
          {preview.extractedGlossary.length > 0 && (
            <select
              aria-label="Chế độ áp dụng từ điển"
              value={glossaryAction}
              onChange={(e) => {
                setGlossaryAction(e.target.value as GuidelineApplyMode);
                setConfirmReplaceGlossary(false);
              }}
              className="text-[11px] bg-ink border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main"
            >
              {existingGlossaryCount > 0 && (
                <option value="merge">Hợp nhất & chống trùng (Khuyên dùng)</option>
              )}
              <option value="replace">
                {existingGlossaryCount > 0 ? 'Thay thế toàn bộ từ điển hiện có' : 'Nạp vào từ điển dự án'}
              </option>
              <option value="keep">Giữ nguyên từ điển hiện có</option>
            </select>
          )}
        </div>

        {preview.extractedGlossary.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {preview.extractedGlossary.slice(0, 8).map((item, idx) => (
              <span
                key={idx}
                className="bg-ink border border-parchment-2 px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold text-text-main"
              >
                <span className="font-serif text-polish">{item.chinese}</span> ➜ {item.vietnamese}
              </span>
            ))}
            {preview.extractedGlossary.length > 8 && (
              <span className="text-[10px] text-text-muted font-bold px-1">
                +{preview.extractedGlossary.length - 8} từ khác...
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted italic">Không có bảng thuật ngữ trong tệp này.</p>
        )}

        {needsReplaceGlossaryConfirm && (
          <label className="flex items-start gap-2 text-[11px] text-amber-200 bg-amber-950/40 border border-amber-800/50 rounded-[2px] p-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmReplaceGlossary}
              onChange={(e) => setConfirmReplaceGlossary(e.target.checked)}
              className="mt-0.5 accent-polish"
            />
            <span>
              Xác nhận thay thế toàn bộ <strong>{existingGlossaryCount}</strong> thuật ngữ hiện có khi bấm Lưu dự án.
            </span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Hủy xem trước
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Check className="w-3.5 h-3.5" />}
          disabled={needsReplaceGlossaryConfirm && !confirmReplaceGlossary}
          onClick={() =>
            onConfirm({
              genre: genreAction,
              tone: toneAction,
              description: descriptionAction,
              glossary: glossaryAction,
            })
          }
        >
          Áp dụng vào biểu mẫu
        </Button>
      </div>
    </div>
  );
}

export default GuidelineImportPreview;
