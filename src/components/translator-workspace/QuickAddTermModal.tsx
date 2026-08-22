import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { GlossaryItem, GlossaryType, StoryProject } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { quickTranslateTermDirect } from '../../services/directGeminiClient';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface QuickAddTermModalProps {
  selectedTerm: string;
  selectedContext: string;
  onClose: () => void;
  activeProject: StoryProject;
  onUpdateProject: (p: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
}

export function QuickAddTermModal({
  selectedTerm,
  selectedContext,
  onClose,
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
}: QuickAddTermModalProps) {
  const { showToast } = useNotifications();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickPinyin, setQuickPinyin] = useState('');
  const [quickVietnamese, setQuickVietnamese] = useState('');
  const [quickType, setQuickType] = useState<GlossaryType>('character');
  const [quickNote, setQuickNote] = useState('');

  const handleTriggerQuickAdd = async () => {
    if (!selectedTerm) return;
    setQuickAddOpen(true);
    setQuickAddLoading(true);
    setQuickPinyin('');
    setQuickVietnamese('');
    setQuickType('character');
    setQuickNote('');

    try {
      const termData = await quickTranslateTermDirect({
        term: selectedTerm,
        contextText: selectedContext,
        apiKeys,
        model: selectedModel,
      });

      setQuickPinyin(termData.pinyin || '');
      setQuickVietnamese(termData.vietnamese || '');
      setQuickType(termData.type || 'character');
      setQuickNote(termData.note || '');
    } catch (err: any) {
      setQuickPinyin('');
      setQuickVietnamese('');
      setQuickType('character');
      setQuickNote('');
      showToast({ message: 'Không thể gọi AI tra cứu: ' + (err.message || 'Lỗi kết nối') + '. Bạn vẫn có thể điền tay.', type: 'warning' });
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleCancelQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickAddLoading(false);
    onClose();
  };

  const handleSaveQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm.trim() || !quickVietnamese.trim()) {
      showToast({ message: 'Vui lòng nhập đầy đủ gốc chữ Hán và dịch nghĩa tiếng Việt.', type: 'warning' });
      return;
    }

    const trimmedChinese = selectedTerm.trim();
    const isDuplicate = activeProject.glossary.some(
      (item) => isHanEquivalent(item.chinese, trimmedChinese) ||
                (item.variants && item.variants.some((v) => isHanEquivalent(v, trimmedChinese)))
    );

    if (isDuplicate) {
      showToast({ message: `Từ khóa "${trimmedChinese}" đã tồn tại trong từ điển.`, type: 'warning' });
      return;
    }

    const newItem: GlossaryItem = {
      id: 'term_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      chinese: trimmedChinese,
      pinyin: quickPinyin.trim() || quickVietnamese.trim(),
      vietnamese: quickVietnamese.trim(),
      type: quickType,
      note: quickNote.trim(),
      origin: 'manual',
      createdAt: new Date().toISOString(),
    };

    const updated = {
      ...activeProject,
      glossary: [...activeProject.glossary, newItem],
    };

    onUpdateProject(updated);
    showToast({ message: `Đã thêm thành công: "${trimmedChinese}" -> "${quickVietnamese}" vào từ điển.`, type: 'success' });

    setQuickAddOpen(false);
    onClose();
  };

  if (!selectedTerm) return null;

  return (
    <>
      <div className="bg-ink border border-parchment-2 rounded-md p-3.5 space-y-3 shadow-xs animate-fadeIn">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-polish opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-polish"></span>
            </span>
            <span className="text-xs text-text-main">
              Bôi đen: <strong className="font-serif text-polish bg-parchment px-1.5 py-0.5 rounded-[2px] border border-parchment-2">{selectedTerm}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-text-muted hover:text-text-main px-2 py-1 rounded-[2px] transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={handleTriggerQuickAdd}
              className="flex items-center gap-1.5 bg-polish hover:bg-[#A03522] text-white font-bold px-3 py-1.5 rounded-[2px] text-xs transition shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-white fill-current animate-pulse" />
              Tra cứu &amp; Thêm nhanh
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={quickAddOpen}
        onClose={handleCancelQuickAdd}
        title={
          <span className="flex items-center gap-2">
            <span>Thêm nhanh thuật ngữ:</span>
            <span className="font-serif text-text-main bg-ink border border-parchment-2 px-2 py-0.5 rounded-[2px] text-xs font-normal">
              {selectedTerm}
            </span>
          </span>
        }
        description="Điền hoặc xác nhận gợi ý dịch nghĩa từ AI để lưu trực tiếp vào từ điển của truyện."
        icon={<Sparkles className="w-4 h-4" />}
        size="2xl"
      >
        {quickAddLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2.5">
            <Loader2 className="w-6 h-6 text-polish animate-spin" />
            <span className="text-xs text-text-muted font-bold tracking-wider animate-pulse">AI ĐANG PHÂN TÍCH THUẬT NGỮ...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveQuickAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Phiên âm Hán Việt</label>
                <input
                  type="text"
                  placeholder="Hán Việt..."
                  value={quickPinyin}
                  onChange={(e) => setQuickPinyin(e.target.value)}
                  className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Bản dịch đề xuất *</label>
                <input
                  type="text"
                  placeholder="Tiếng Việt..."
                  value={quickVietnamese}
                  onChange={(e) => setQuickVietnamese(e.target.value)}
                  className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Phân loại</label>
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as GlossaryType)}
                  className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
                >
                  <option value="character" className="bg-ink text-text-main">Nhân vật</option>
                  <option value="location" className="bg-ink text-text-main">Địa danh</option>
                  <option value="term" className="bg-ink text-text-main">Bí kíp / Vật phẩm</option>
                  <option value="phrase" className="bg-ink text-text-main">Thành ngữ / Cụm từ</option>
                  <option value="other" className="bg-ink text-text-main">Thuật ngữ khác</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Ghi chú ngữ cảnh</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đại nhân..."
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-parchment-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleCancelQuickAdd}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
              >
                Lưu vào từ điển
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default QuickAddTermModal;
