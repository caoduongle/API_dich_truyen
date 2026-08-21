import React from 'react';
import {
  AlertTriangle,
  FileText,
  Copy,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { ChapterConflictInfo } from '../../types/googleDriveSync';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface ChapterConflictModalProps {
  open: boolean;
  conflict: ChapterConflictInfo | null;
  onResolve: (action: 'keep_local' | 'use_remote' | 'save_as_copy') => void;
  onCancel: () => void;
}

export const ChapterConflictModal: React.FC<ChapterConflictModalProps> = ({
  open,
  conflict,
  onResolve,
  onCancel,
}) => {
  if (!conflict) return null;

  const localText =
    conflict.localChapter.polishedTranslation ||
    conflict.localChapter.rawTranslation ||
    conflict.localChapter.sourceText;

  const remoteText =
    conflict.remoteChapter.polishedTranslation ||
    conflict.remoteChapter.rawTranslation ||
    conflict.remoteChapter.sourceText;

  const localTime = new Date(conflict.localUpdatedAt).toLocaleString('vi-VN');
  const remoteTime = new Date(conflict.remoteUpdatedAt).toLocaleString('vi-VN');

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="2xl"
      title={
        <div className="flex items-center gap-2 text-gold">
          <AlertTriangle className="w-5 h-5" />
          <span>Xung Đột Bản Dịch Chương</span>
        </div>
      }
      description={`Chương: "${conflict.chapterTitle}"`}
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2 text-xs">
          <span className="text-text-muted">Chọn phương án giải quyết để tiếp tục đồng bộ</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onResolve('use_remote')}>
              Dùng bản trên Drive
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onResolve('keep_local')}>
              Giữ bản trên máy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => onResolve('save_as_copy')}
            >
              Lưu thành bản sao
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner cảnh báo */}
        <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-[2px] text-xs text-amber-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4" />
            Cả bạn và cộng tác viên đều đã chỉnh sửa chương này kể từ lần đồng bộ trước.
          </p>
          <p className="text-[11px] text-text-muted">
            Khuyến nghị: Chọn <strong>"Lưu thành bản sao"</strong> để giữ bản dịch của bạn dưới dạng một chương mới mà không làm mất bản dịch trên Google Drive của cộng tác viên.
          </p>
        </div>

        {/* So sánh 2 bản dịch Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Bản cục bộ */}
          <div className="border border-parchment-2 rounded-[2px] p-3 bg-ink/5 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-polish" />
                  Bản dịch trên máy này
                </span>
                <Badge tone="polish">Local</Badge>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock className="w-3 h-3" />
                <span>Sửa lúc: {localTime}</span>
              </div>
              <div className="mt-2 p-2.5 bg-ink/10 rounded-[2px] border border-parchment-2 max-h-48 overflow-y-auto font-serif text-xs text-text-main whitespace-pre-wrap leading-relaxed">
                {localText ? localText.slice(0, 500) + (localText.length > 500 ? '...' : '') : '(Chưa có nội dung dịch)'}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onResolve('keep_local')}
              className="w-full justify-center mt-2"
            >
              Giữ bản trên máy
            </Button>
          </div>

          {/* Bản trên Drive */}
          <div className="border border-parchment-2 rounded-[2px] p-3 bg-ink/5 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-gold" />
                  Bản dịch trên Google Drive
                </span>
                <Badge tone="neutral">Remote</Badge>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock className="w-3 h-3" />
                <span>Cập nhật: {remoteTime}</span>
              </div>
              <div className="mt-2 p-2.5 bg-ink/10 rounded-[2px] border border-parchment-2 max-h-48 overflow-y-auto font-serif text-xs text-text-main whitespace-pre-wrap leading-relaxed">
                {remoteText ? remoteText.slice(0, 500) + (remoteText.length > 500 ? '...' : '') : '(Chưa có nội dung dịch)'}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onResolve('use_remote')}
              className="w-full justify-center mt-2"
            >
              Dùng bản trên Drive
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
