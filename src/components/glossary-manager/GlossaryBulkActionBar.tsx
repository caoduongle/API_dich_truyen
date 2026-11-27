import React, { useState } from 'react';
import { CheckSquare, Pin, PinOff, Tag, Trash2, Users, X } from 'lucide-react';
import { CharacterGender, GlossaryType } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { Button } from '../ui/Button';

export interface GlossaryBulkActionBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  selectedCharacterCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onBulkPin: () => void;
  onBulkUnpin: () => void;
  onBulkChangeType: (type: GlossaryType) => void;
  onBulkChangeGender: (gender: CharacterGender) => void;
  onBulkDelete: () => void;
}

export const GlossaryBulkActionBar = React.memo(function GlossaryBulkActionBar({
  selectedCount,
  totalFilteredCount,
  selectedCharacterCount,
  onSelectAllFiltered,
  onClearSelection,
  onBulkPin,
  onBulkUnpin,
  onBulkChangeType,
  onBulkChangeGender,
  onBulkDelete,
}: GlossaryBulkActionBarProps) {
  const { showConfirm } = useNotifications();
  const [bulkType, setBulkType] = useState<GlossaryType>('character');
  const [bulkGender, setBulkGender] = useState<CharacterGender>('male');

  if (selectedCount === 0) {
    return null;
  }

  const handleBulkDeleteClick = async () => {
    const confirmed = await showConfirm({
      title: 'Xóa hàng loạt thuật ngữ',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedCount} thuật ngữ đang chọn khỏi từ điển không?`,
      confirmText: `Xóa ${selectedCount} mục`,
      cancelText: 'Hủy',
      type: 'danger',
    });
    if (confirmed) {
      onBulkDelete();
    }
  };

  return (
    <div
      id="glossary-bulk-action-bar"
      className="bg-parchment border border-polish/40 px-3.5 py-2.5 rounded-md flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-text-main">
          <CheckSquare className="w-3.5 h-3.5 text-polish" />
          Đã chọn <strong className="font-mono text-polish">{selectedCount}</strong> mục
        </span>

        {selectedCount < totalFilteredCount && totalFilteredCount > 0 && (
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="text-[11px] font-medium text-polish hover:underline cursor-pointer"
          >
            Chọn tất cả {totalFilteredCount} mục đang lọc
          </button>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-main cursor-pointer"
        >
          <X className="w-3 h-3" />
          Bỏ chọn
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          id="btn-bulk-pin"
          variant="secondary"
          size="sm"
          icon={<Pin className="w-3 h-3 text-polish" />}
          onClick={onBulkPin}
        >
          Ghim
        </Button>

        <Button
          type="button"
          id="btn-bulk-unpin"
          variant="secondary"
          size="sm"
          icon={<PinOff className="w-3 h-3" />}
          onClick={onBulkUnpin}
        >
          Bỏ ghim
        </Button>

        <div className="inline-flex items-center gap-1 bg-ink border border-parchment-2 rounded-[2px] px-1.5 py-0.5">
          <Tag className="w-3 h-3 text-text-muted" />
          <select
            aria-label="Phân loại hàng loạt"
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value as GlossaryType)}
            className="bg-ink text-text-main text-[11px] py-0.5 focus:outline-none cursor-pointer"
          >
            <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
            <option value="location" className="bg-parchment text-text-main">Địa danh</option>
            <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
            <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
            <option value="other" className="bg-parchment text-text-main">Khác</option>
          </select>
          <Button
            type="button"
            id="btn-bulk-apply-type"
            variant="ghost"
            size="sm"
            onClick={() => onBulkChangeType(bulkType)}
          >
            Đổi loại
          </Button>
        </div>

        <div
          className="inline-flex items-center gap-1 bg-ink border border-parchment-2 rounded-[2px] px-1.5 py-0.5"
          title={
            selectedCharacterCount === 0
              ? 'Chỉ áp dụng cho các mục phân loại Nhân vật'
              : `Gán giới tính cho ${selectedCharacterCount} nhân vật đang chọn`
          }
        >
          <Users className="w-3 h-3 text-text-muted" />
          <select
            aria-label="Giới tính nhân vật hàng loạt"
            value={bulkGender}
            onChange={(e) => setBulkGender(e.target.value as CharacterGender)}
            className="bg-ink text-text-main text-[11px] py-0.5 focus:outline-none cursor-pointer"
          >
            <option value="male" className="bg-parchment text-text-main">Nam</option>
            <option value="female" className="bg-parchment text-text-main">Nữ</option>
            <option value="neutral" className="bg-parchment text-text-main">Trung lập</option>
            <option value="unknown" className="bg-parchment text-text-main">Chưa rõ</option>
          </select>
          <Button
            type="button"
            id="btn-bulk-apply-gender"
            variant="ghost"
            size="sm"
            disabled={selectedCharacterCount === 0}
            onClick={() => onBulkChangeGender(bulkGender)}
          >
            Gán giới tính ({selectedCharacterCount})
          </Button>
        </div>

        <Button
          type="button"
          id="btn-bulk-delete"
          variant="danger"
          size="sm"
          icon={<Trash2 className="w-3 h-3" />}
          onClick={handleBulkDeleteClick}
        >
          Xóa hàng loạt
        </Button>
      </div>
    </div>
  );
});

export default GlossaryBulkActionBar;
