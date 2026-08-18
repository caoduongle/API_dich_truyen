import React, { useState, useEffect } from 'react';
import { GlossaryType, GlossaryItem } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { Button } from '../ui/Button';

interface AddGlossaryFormProps {
  glossary: GlossaryItem[];
  onSave: (item: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string }, force?: boolean) => void;
  onCancel: () => void;
  onSelectExistingItem: (item: GlossaryItem) => void;
}

export const AddGlossaryForm = React.memo(function AddGlossaryForm({
  glossary,
  onSave,
  onCancel,
  onSelectExistingItem,
}: AddGlossaryFormProps) {
  const { showToast } = useNotifications();
  const [chinese, setChinese] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [vietnamese, setVietnamese] = useState('');
  const [type, setType] = useState<GlossaryType>('character');
  const [note, setNote] = useState('');
  const [warningItem, setWarningItem] = useState<GlossaryItem | null>(null);

  useEffect(() => {
    const trimmed = chinese.trim();
    if (!trimmed) {
      setWarningItem(null);
      return;
    }

    const timer = setTimeout(() => {
      const found = glossary.find((gItem) => {
        // 1. Check if canonical equivalent
        const isEquiv = isHanEquivalent(gItem.chinese, trimmed) || 
                        (gItem.variants && gItem.variants.some(v => isHanEquivalent(v, trimmed)));
        
        if (!isEquiv) return false;

        // 2. Check if they have different display string
        const isSameDisplay = (gItem.chinese.trim() === trimmed) ||
                              (gItem.variants && gItem.variants.some(v => v.trim() === trimmed));
        
        return !isSameDisplay;
      });

      setWarningItem(found || null);
    }, 400);

    return () => clearTimeout(timer);
  }, [chinese, glossary]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chinese.trim() || !vietnamese.trim()) {
      showToast({ message: "Vui lòng nhập từ gốc tiếng Trung và bản dịch tiếng Việt.", type: 'warning' });
      return;
    }
    if (warningItem) {
      showToast({ message: "Thuật ngữ trùng lặp phát hiện. Vui lòng chọn 'Vẫn tạo mới' hoặc 'Dùng entry đó'.", type: 'warning' });
      return;
    }
    onSave({ chinese, pinyin, vietnamese, type, note });
  };

  const handleUseExisting = () => {
    if (warningItem) {
      onSelectExistingItem(warningItem);
    }
  };

  const handleForceCreate = () => {
    if (!chinese.trim() || !vietnamese.trim()) {
      showToast({ message: "Vui lòng nhập từ gốc tiếng Trung và bản dịch tiếng Việt.", type: 'warning' });
      return;
    }
    onSave({ chinese, pinyin, vietnamese, type, note }, true);
  };

  return (
    <form
      id="form-add-glossary"
      onSubmit={handleSubmit}
      className="bg-parchment border border-parchment-2 p-4 rounded-md space-y-3 shadow-xs animate-in slide-in-from-top-2 duration-200"
    >
      <h3 className="text-xs font-bold text-text-main uppercase tracking-wider font-display">
        Thêm từ khóa mới bằng tay
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">
            Gốc tiếng Trung *
          </label>
          <input
            id="input-chinese-new"
            type="text"
            placeholder="Ví dụ: 萧炎"
            value={chinese}
            onChange={(e) => setChinese(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main font-serif focus:outline-none focus:border-polish"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">
            Phiên âm Hán Việt
          </label>
          <input
            id="input-pinyin-new"
            type="text"
            placeholder="Ví dụ: Tiêu Viêm"
            value={pinyin}
            onChange={(e) => setPinyin(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">
            Bản dịch tiếng Việt *
          </label>
          <input
            id="input-vietnamese-new"
            type="text"
            placeholder="Ví dụ: Tiêu Viêm"
            value={vietnamese}
            onChange={(e) => setVietnamese(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">
            Phân loại
          </label>
          <select
            id="select-type-new"
            value={type}
            onChange={(e) => setType(e.target.value as GlossaryType)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish cursor-pointer"
          >
            <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
            <option value="location" className="bg-parchment text-text-main">Địa danh</option>
            <option value="term" className="bg-parchment text-text-main">Bí kíp / Vật phẩm</option>
            <option value="phrase" className="bg-parchment text-text-main">Thành ngữ / Cụm từ</option>
            <option value="other" className="bg-parchment text-text-main">Thuật ngữ khác</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">
          Ghi chú ngữ cảnh (Hướng dẫn AI xưng hô, đại từ đúng đắn)
        </label>
        <input
          id="input-note-new"
          type="text"
          placeholder="Ví dụ: Nam chính, sư phụ, nhân vật nữ kêu bằng nàng, có xưng hô bá đạo..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish"
        />
      </div>

      {warningItem && (
        <div
          id="duplicate-warning"
          className="bg-amber-950/20 border border-amber-800/40 p-2.5 rounded-[2px] text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in"
        >
          <span>
            Có thể đã tồn tại dưới dạng <strong className="font-serif text-amber-400">[{warningItem.chinese}]</strong> — bạn có chắc muốn tạo entry mới?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              id="btn-use-existing"
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseExisting}
              className="text-amber-300 border-amber-800/40 hover:bg-amber-950/40"
            >
              Dùng entry đó thay vì tạo mới
            </Button>
            <Button
              id="btn-force-create"
              type="button"
              variant="primary"
              size="sm"
              onClick={handleForceCreate}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Vẫn tạo mới
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          id="btn-cancel-add"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          id="btn-save-add"
          type="submit"
          variant="primary"
          size="sm"
        >
          Lưu từ điển
        </Button>
      </div>
    </form>
  );
});

export default AddGlossaryForm;
