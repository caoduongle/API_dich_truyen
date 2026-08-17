import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { GlossaryItem, GlossaryType, StoryProject } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { apiFetch } from '../../utils/apiClient';

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
      const response = await apiFetch('/api/quick-translate-term', {
        method: 'POST',
        body: JSON.stringify({
          term: selectedTerm,
          contextText: selectedContext,
          apiKeys,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Lỗi phân dịch thuật ngữ.');
      }

      const data = await response.json();
      if (data.term) {
        setQuickPinyin(data.term.pinyin || '');
        setQuickVietnamese(data.term.vietnamese || '');
        setQuickType(data.term.type || 'character');
        setQuickNote(data.term.note || '');
      } else {
        throw new Error('Không nhận được gợi ý dịch thuật từ AI.');
      }
    } catch (err: any) {
      console.error(err);
      setQuickPinyin('');
      setQuickVietnamese('');
      setQuickType('character');
      setQuickNote('');
      showToast({ message: 'Không thể gọi AI tra cứu: ' + err.message + '. Bạn vẫn có thể điền tay.', type: 'warning' });
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
    <div className="bg-ink border border-parchment-2 rounded-md p-4 space-y-3 shadow-xs animate-fadeIn">
      {!quickAddOpen ? (
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
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-parchment-2 pb-2">
            <h4 className="text-xs font-bold text-polish flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              Thêm nhanh: <span className="font-serif text-text-main bg-parchment px-2 py-0.5 rounded-[2px] text-[11px]">{selectedTerm}</span>
            </h4>
            <button
              type="button"
              onClick={handleCancelQuickAdd}
              className="text-text-muted hover:text-text-main p-1 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {quickAddLoading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-polish animate-spin" />
              <span className="text-[11px] text-text-muted font-bold tracking-wider animate-pulse">AI ĐANG PHÂN TÍCH THUẬT NGỮ...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveQuickAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Phiên âm Hán Việt</label>
                  <input
                    type="text"
                    placeholder="Hán Việt..."
                    value={quickPinyin}
                    onChange={(e) => setQuickPinyin(e.target.value)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Bản dịch đề xuất *</label>
                  <input
                    type="text"
                    placeholder="Tiếng Việt..."
                    value={quickVietnamese}
                    onChange={(e) => setQuickVietnamese(e.target.value)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Phân loại</label>
                  <select
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value as GlossaryType)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
                  >
                    <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
                    <option value="location" className="bg-parchment text-text-main">Địa danh</option>
                    <option value="term" className="bg-parchment text-text-main">Bí kíp / Vật phẩm</option>
                    <option value="phrase" className="bg-parchment text-text-main">Thành ngữ / Cụm từ</option>
                    <option value="other" className="bg-parchment text-text-main">Thuật ngữ khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Ghi chú ngữ cảnh</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đại nhân..."
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-parchment-2">
                <button
                  type="button"
                  onClick={handleCancelQuickAdd}
                  className="px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-polish hover:bg-[#A03522] text-white px-4 py-1.5 text-xs font-bold rounded-[2px] transition shadow-xs cursor-pointer"
                >
                  Lưu vào từ điển
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
