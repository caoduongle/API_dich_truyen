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
      showToast({ message: `Thuật ngữ "${trimmedChinese}" đã tồn tại trong từ điển rồi!`, type: 'warning' });
      return;
    }

    const newItem: GlossaryItem = {
      id: 'glossary_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
      chinese: trimmedChinese,
      pinyin: quickPinyin.trim(),
      vietnamese: quickVietnamese.trim(),
      type: quickType,
      note: quickNote.trim(),
      createdAt: new Date().toISOString(),
      origin: 'manual',
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
    <div className="bg-[#161f30]/95 border border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-lg shadow-indigo-950/30 animate-fadeIn">
      {!quickAddOpen ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs text-slate-300">
              Bôi đen: <strong className="font-mono text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/30">{selectedTerm}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={handleTriggerQuickAdd}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-md shadow-indigo-950/20 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-white fill-current animate-pulse" />
              Tra cứu &amp; Thêm nhanh
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              Thêm nhanh: <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded text-[11px]">{selectedTerm}</span>
            </h4>
            <button
              type="button"
              onClick={handleCancelQuickAdd}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {quickAddLoading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-[11px] text-slate-400 font-semibold tracking-wider animate-pulse">AI ĐANG PHÂN TÍCH THUẬT NGỮ...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveQuickAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Phiên âm Hán Việt</label>
                  <input
                    type="text"
                    placeholder="Hán Việt..."
                    value={quickPinyin}
                    onChange={(e) => setQuickPinyin(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Bản dịch đề xuất *</label>
                  <input
                    type="text"
                    placeholder="Tiếng Việt..."
                    value={quickVietnamese}
                    onChange={(e) => setQuickVietnamese(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Phân loại</label>
                  <select
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value as GlossaryType)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold"
                  >
                    <option value="character">Nhân vật</option>
                    <option value="location">Địa danh</option>
                    <option value="term">Bí kíp / Vật phẩm</option>
                    <option value="phrase">Thành ngữ / Cụm từ</option>
                    <option value="other">Thuật ngữ khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Ghi chú ngữ cảnh</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đại nhân..."
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleCancelQuickAdd}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-1.5 text-xs font-bold rounded-lg transition shadow-md shadow-indigo-950/20 cursor-pointer"
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
