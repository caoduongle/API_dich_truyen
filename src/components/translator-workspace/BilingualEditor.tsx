import React, { useState } from 'react';
import { 
  RefreshCw, Play, Sparkles, BookOpen, FileText, Copy, Check, Save, 
  ChevronRight, Edit3, X, Loader2, Eraser, AlertCircle
} from 'lucide-react';
import { Chapter, ChapterMetadata, GlossaryItem, StoryProject, GlossaryType } from '../../types';
import { CHINESE_EXAMPLES } from '../../data/examples';
import { useNotifications } from '../NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { cleanChineseText } from '../../utils/textCleaner';

export interface BilingualEditorProps {
  sourceText: string;
  setSourceText: (s: string) => void;
  originalSourceText: string;
  setOriginalSourceText: (s: string) => void;
  isGlossaryApplied: boolean;
  setIsGlossaryApplied: (b: boolean) => void;
  isExtractionEnabled: boolean;
  setIsExtractionEnabled: (b: boolean) => void;
  rawTranslation: string;
  setRawTranslation: (s: string) => void;
  polishedTranslation: string;
  setPolishedTranslation: (s: string) => void;
  additionalInstructions: string;
  setAdditionalInstructions: (s: string) => void;
  chapterTitle: string;
  setChapterTitle: (s: string) => void;
  untranslatedChapters: ChapterMetadata[];
  handleLoadChapterById: (id: string) => void;
  handleLoadExample: (index: number) => void;
  handleAnalyzeGlossary: () => void;
  isAnalyzing: boolean;
  handleTranslateRaw: () => void;
  isTranslating: boolean;
  handlePolishTranslation: () => void;
  isPolishing: boolean;
  handleSaveChapter: () => void;
  handleApplyGlossaryToSource: () => void;
  copiedRaw: boolean;
  copiedPolished: boolean;
  handleCopyText: (text: string, type: 'raw' | 'polished') => void;
  activeStage: 'raw' | 'polished';
  setActiveStage: (stage: 'raw' | 'polished') => void;
  autoDiscoveredTerms: GlossaryItem[];
  isApplyingGlossaryToSource: boolean;
  applyGlossarySourceCount: number | null;
  glossaryLength: number;
  activeProject: StoryProject;
  onUpdateProject: (p: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  warningParagraphMismatch: boolean;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
  qaIssues: any[];
  isCheckingQa: boolean;
}

export const BilingualEditor = React.memo(function BilingualEditor({
  sourceText,
  setSourceText,
  originalSourceText,
  setOriginalSourceText,
  isGlossaryApplied,
  setIsGlossaryApplied,
  isExtractionEnabled,
  setIsExtractionEnabled,
  rawTranslation,
  setRawTranslation,
  polishedTranslation,
  setPolishedTranslation,
  additionalInstructions,
  setAdditionalInstructions,
  chapterTitle,
  setChapterTitle,
  untranslatedChapters,
  handleLoadChapterById,
  handleLoadExample,
  handleAnalyzeGlossary,
  isAnalyzing,
  handleTranslateRaw,
  isTranslating,
  handlePolishTranslation,
  isPolishing,
  handleSaveChapter,
  handleApplyGlossaryToSource,
  copiedRaw,
  copiedPolished,
  handleCopyText,
  activeStage,
  setActiveStage,
  autoDiscoveredTerms,
  isApplyingGlossaryToSource,
  applyGlossarySourceCount,
  glossaryLength,
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  warningParagraphMismatch,
  enableAiQaCritique,
  enableSegmentTranslation,
  qaIssues,
  isCheckingQa,
}: BilingualEditorProps) {
  const { showToast } = useNotifications();
  const sourceParaCount = sourceText.split(/\n+/).map(l => l.trim()).filter(Boolean).length;
  const translationText = activeStage === 'polished' ? polishedTranslation : rawTranslation;
  const translationParaCount = translationText.split(/\n+/).map(l => l.trim()).filter(Boolean).length;
  const isMismatch = warningParagraphMismatch && sourceParaCount > 0 && translationParaCount > 0 && sourceParaCount !== translationParaCount;

  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedContext, setSelectedContext] = useState('');

  // Quick Add State
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickPinyin, setQuickPinyin] = useState('');
  const [quickVietnamese, setQuickVietnamese] = useState('');
  const [quickType, setQuickType] = useState<GlossaryType>('character');
  const [quickNote, setQuickNote] = useState('');

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (quickAddOpen) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    if (start !== end) {
      const selection = text.substring(start, end).trim();
      if (selection.length > 0 && selection.length <= 30) {
        setSelectedTerm(selection);

        let paragraphStart = text.lastIndexOf('\n', start);
        if (paragraphStart === -1) paragraphStart = 0;
        else paragraphStart += 1;

        let paragraphEnd = text.indexOf('\n', end);
        if (paragraphEnd === -1) paragraphEnd = text.length;

        const paragraph = text.substring(paragraphStart, paragraphEnd).trim();
        setSelectedContext(paragraph);
        return;
      }
    }
  };

  const handleTriggerQuickAdd = async () => {
    if (!selectedTerm) return;
    setQuickAddOpen(true);
    setQuickAddLoading(true);
    setQuickPinyin('');
    setQuickVietnamese('');
    setQuickType('character');
    setQuickNote('');

    try {
      const response = await fetch('/api/quick-translate-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: selectedTerm,
          contextText: selectedContext,
          apiKeys,
          model: selectedModel
        })
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
      showToast({ message: "Không thể gọi AI tra cứu: " + err.message + ". Bạn vẫn có thể điền tay.", type: 'warning' });
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleCancelQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickAddLoading(false);
    setSelectedTerm('');
    setSelectedContext('');
  };

  const handleSaveQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm.trim() || !quickVietnamese.trim()) {
      showToast({ message: "Vui lòng nhập đầy đủ gốc chữ Hán và dịch nghĩa tiếng Việt.", type: 'warning' });
      return;
    }

    const trimmedChinese = selectedTerm.trim();
    const isDuplicate = activeProject.glossary.some(
      (item) => isHanEquivalent(item.chinese, trimmedChinese) ||
                (item.variants && item.variants.some(v => isHanEquivalent(v, trimmedChinese)))
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
      origin: 'manual'
    };

    const updated = {
      ...activeProject,
      glossary: [...activeProject.glossary, newItem]
    };

    onUpdateProject(updated);
    showToast({ message: `Đã thêm thành công: "${trimmedChinese}" -> "${quickVietnamese}" vào từ điển.`, type: 'success' });

    setQuickAddOpen(false);
    setSelectedTerm('');
    setSelectedContext('');
  };

  const handleCleanText = () => {
    if (!sourceText.trim()) {
      showToast({ message: "Chưa nhập nội dung tiếng Trung để dọn dẹp.", type: 'warning' });
      return;
    }
    const cleaned = cleanChineseText(sourceText);
    if (cleaned === sourceText) {
      showToast({ message: "Văn bản đã sạch sẽ, không phát hiện quảng cáo hay khoảng trắng dư thừa.", type: 'info' });
      return;
    }
    if (!isGlossaryApplied) {
      setOriginalSourceText(sourceText);
      setIsGlossaryApplied(true);
    }
    setSourceText(cleaned);
    showToast({ message: "Đã dọn dẹp và làm sạch văn bản thành công!", type: 'success' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column - Source space */}
      <div className="space-y-4 bg-[#0f1524] border border-slate-800/80 p-5 rounded-2xl shadow-xl animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <h3 className="text-xs font-extrabold text-slate-350 uppercase tracking-wider flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-650 text-white text-[10px] font-bold shadow-md shadow-indigo-900/30">1</span>
            Nội Dung Tiếng Trung Gốc
          </h3>
          
          {/* Dropdown các chương chưa dịch */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-semibold whitespace-nowrap hidden xs:inline">Chương chưa dịch:</span>
            <select
              id="select-untranslated-chapter"
              onChange={(e) => {
                const chapId = e.target.value;
                if (!chapId) return;
                handleLoadChapterById(chapId);
                e.target.value = '';
              }}
              className="bg-[#161f30] hover:bg-[#1a253a] text-slate-205 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[150px] xs:max-w-[200px] truncate cursor-pointer transition-colors"
              defaultValue=""
            >
              <option value="" className="bg-[#0f1524] text-slate-450" disabled>-- Chọn chương --</option>
              {untranslatedChapters.length === 0 ? (
                <option value="" className="bg-[#0f1524] text-slate-450" disabled>Không có chương chưa dịch</option>
              ) : (
                untranslatedChapters.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0f1524] text-slate-200">
                    {c.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Examples section if source text is empty */}
        {!sourceText && (
          <div className="bg-[#161f30] border border-slate-800/80 p-4 rounded-xl space-y-2.5 animate-fadeIn">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Ví dụ nạp thử nghiệm</span>
            <div className="flex flex-wrap gap-2">
              {CHINESE_EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadExample(idx)}
                  className="bg-[#1c283f] border border-slate-700/65 hover:border-indigo-550 hover:bg-[#22314d] rounded-lg px-2.5 py-1 text-xs text-slate-300 font-bold transition cursor-pointer"
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Tiêu đề chương / Tiêu đề truyện dịch</label>
          <input
            id="input-chapter-title"
            type="text"
            placeholder="Ví dụ: Chương 1: Diễn biến kịch tính dồn dập..."
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            className="w-full text-xs bg-[#161f30] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-[#19243a] transition-all"
          />
        </div>

        <div className="relative">
          <textarea
            id="textarea-chinese-source"
            rows={12}
            placeholder="Dán hoặc gõ truyện chữ Trung Quốc (Giản thể/Phồn thể) vào đây..."
            value={sourceText}
            onChange={(e) => {
              const val = e.target.value;
              setSourceText(val);
              if (val.trim() === '') {
                setOriginalSourceText('');
                setIsGlossaryApplied(false);
              } else if (!isGlossaryApplied) {
                setOriginalSourceText(val);
              }
            }}
            onSelect={handleTextareaSelect}
            className="w-full text-sm bg-[#161f30] border border-slate-800 rounded-xl p-4 text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y shadow-inner"
          />
          {sourceText && (
            <span className="absolute bottom-3 right-3 text-[9px] text-slate-400 bg-[#0f1524] px-2 py-0.5 rounded-md border border-slate-800 font-mono shadow-sm">
              {sourceText.length.toLocaleString()} ký tự
            </span>
          )}
        </div>

        {/* Quick Add Glossary Term Widget */}
        {selectedTerm && (
          <div className="bg-[#161f30]/95 border border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-lg shadow-indigo-950/30 animate-fadeIn">
            {!quickAddOpen ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span className="text-xs text-slate-350">
                    Bôi đen: <strong className="font-mono text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/30">{selectedTerm}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerm('');
                      setSelectedContext('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerQuickAdd}
                    className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-850 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-md shadow-indigo-950/20 cursor-pointer"
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
                        className="bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-850 text-white px-4 py-1.5 text-xs font-bold rounded-lg transition shadow-md shadow-indigo-950/20 cursor-pointer"
                      >
                        Lưu vào từ điển
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {applyGlossarySourceCount !== null && !isApplyingGlossaryToSource && (
          <div className="bg-indigo-950/45 border border-indigo-900/50 text-indigo-300 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2.5 animate-fadeIn">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Đã thay thế thành công <strong>{applyGlossarySourceCount}</strong> thuật ngữ từ từ điển vào văn bản gốc.
            </span>
          </div>
        )}

        {/* Core Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {isGlossaryApplied && (
            <button
              type="button"
              onClick={() => {
                setSourceText(originalSourceText);
                setIsGlossaryApplied(false);
              }}
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 border border-slate-750 bg-[#161f30] hover:bg-[#1a253a] text-slate-350 text-slate-300 font-bold px-3 py-2 rounded-lg transition-all cursor-pointer text-xs"
              title="Khôi phục văn bản tiếng Trung gốc ban đầu"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Khôi phục gốc
            </button>
          )}

          <button
            type="button"
            disabled={!sourceText || glossaryLength === 0 || isApplyingGlossaryToSource}
            onClick={handleApplyGlossaryToSource}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 border border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/40 text-amber-300 font-bold px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            title={glossaryLength === 0 ? 'Từ điển dự án đang trống' : 'Thay thế các từ tiếng Trung trong văn bản gốc bằng bản dịch từ từ điển'}
          >
            {isApplyingGlossaryToSource ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                Đang áp dụng từ điển...
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                Áp dụng từ điển
                {glossaryLength > 0 && (
                  <span className="ml-1 bg-amber-900/50 border border-amber-800/40 text-amber-305 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {glossaryLength}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!sourceText}
            onClick={handleCleanText}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 border border-slate-800 bg-[#161f30] hover:bg-[#1a253a] text-slate-300 font-semibold px-3 py-2 rounded-lg transition-all cursor-pointer text-xs"
            title="Loại bỏ quảng cáo, dòng trống trùng lặp, khoảng trắng rác tiếng Trung"
          >
            <Eraser className="w-3.5 h-3.5 text-indigo-400" />
            Dọn rác văn bản
          </button>

          <button
            id="btn-analyze-names"
            disabled={isAnalyzing || !sourceText}
            onClick={handleAnalyzeGlossary}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-200 font-semibold hover:bg-slate-800/80 px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs hover:scale-[1.01]"
            title="Phân tích đoạn văn để đề xuất từ vựng, tên nhân vật thích hợp"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                Đang tìm...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Tìm nhân vật
              </>
            )}
          </button>

          <button
            id="btn-translate-draft1"
            disabled={isTranslating || !sourceText}
            onClick={handleTranslateRaw}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 bg-indigo-650 text-white font-bold hover:bg-indigo-700 px-3 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/20 text-xs hover:scale-[1.01]"
          >
            {isTranslating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Đang dịch...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-white fill-current" />
                Dịch thô (GĐ 1)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right column - Dual Action Translation Panels */}
      <div className="space-y-4 bg-[#0f1524] border border-slate-800/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between animate-fadeIn">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-xs font-extrabold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-650 text-white text-[10px] font-bold shadow-md shadow-indigo-900/30">2</span>
              <span className="text-slate-300">Kết Quả AI Biên Tập</span>
            </h3>
            
            {/* Stages toggles */}
            <div className="flex bg-[#161f30] p-1 rounded-lg border border-slate-800">
              <button
                id="tab-toggle-raw"
                onClick={() => setActiveStage('raw')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  activeStage === 'raw'
                    ? 'bg-indigo-650 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dịch thô (1)
              </button>
              <button
                id="tab-toggle-polished"
                onClick={() => setActiveStage('polished')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  activeStage === 'polished'
                    ? 'bg-indigo-650 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Biên tập (2)
              </button>
            </div>
          </div>

          {/* Display panel */}
          <div className="space-y-3">
            {/* Mismatch Warning Alert (Phương án 1) */}
            {isMismatch && (
              <div className="bg-amber-955/20 border border-amber-900/45 text-amber-300 p-3.5 rounded-xl flex items-start gap-2.5 text-xs animate-slideDown">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-amber-400">Cảnh báo lệch đoạn văn bản:</p>
                  <p className="leading-relaxed text-slate-300">
                    Số lượng đoạn của bản dịch đang không khớp với văn bản gốc (Gốc: <strong>{sourceParaCount}</strong> đoạn, Dịch: <strong>{translationParaCount}</strong> đoạn). 
                    Vui lòng kiểm tra lại để tránh lệch dòng khi hiển thị song ngữ.
                  </p>
                </div>
              </div>
            )}

            {/* AI Critique QA status/results (Phương án 2) */}
            {isCheckingQa && (
              <div className="bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 p-3.5 rounded-xl flex items-center gap-2.5 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                <span>Đang tiến hành kiểm duyệt AI (QA Critique Phase) đối soát bản dịch...</span>
              </div>
            )}

            {enableAiQaCritique && !isCheckingQa && qaIssues.length > 0 && (
              <div className="bg-[#1c0e12]/80 border border-rose-900/45 text-rose-350 p-3.5 rounded-xl space-y-2 text-xs animate-slideDown shadow-lg">
                <div className="flex items-center gap-1.5 font-extrabold text-rose-400">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>AI Phát Hiện Lỗi Kiểm Duyệt QA ({qaIssues.length})</span>
                </div>
                <ul className="space-y-1.5 list-disc pl-4 leading-relaxed text-slate-300">
                  {qaIssues.map((issue, idx) => (
                    <li key={idx}>
                      <strong className="text-rose-450 text-rose-400 font-bold">[{issue.type.toUpperCase()}] ({issue.severity}):</strong> {issue.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeStage === 'raw' ? (
              // RAW TRANSLATION WORKING SPACE
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#161f30] p-2 rounded-lg border border-slate-800">
                  <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Bản dịch thô GĐ 1 (Hỗ trợ sửa đổi trực tiếp)
                  </span>
                  <button
                    onClick={() => handleCopyText(rawTranslation, 'raw')}
                    className="flex items-center gap-1 hover:text-indigo-400 transition-colors shrink-0 cursor-pointer bg-[#222c3f] hover:bg-[#28354c] text-slate-305 text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700 text-[10px]"
                  >
                    {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedRaw ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <textarea
                  id="textarea-raw-translation"
                  rows={11}
                  placeholder="Bản dịch thô sẽ hiển thị tại đây sau khi chạy Giai đoạn 1..."
                  value={rawTranslation}
                  onChange={(e) => setRawTranslation(e.target.value)}
                  className="w-full text-sm bg-[#161f30] border border-slate-800 rounded-xl p-4 text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y shadow-inner"
                />

                {rawTranslation && (
                  <div className="space-y-2">
                    <div className="bg-indigo-950/20 text-indigo-300 rounded-xl p-3 border border-indigo-900/40 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-white">Dịch thô giai đoạn 1 hoàn thành!</p>
                        <p className="text-slate-400">Vui lòng chuyển qua tab <strong>Biên tập (2)</strong> để bắt đầu chuốt văn phong.</p>
                      </div>
                    </div>

                    {autoDiscoveredTerms.length > 0 && (
                      <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-200 p-3.5 rounded-xl space-y-1.5 animate-slideUp">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                          <span>Tự Động Thêm Từ Mới ({autoDiscoveredTerms.length})</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          AI đã tự động trích xuất các cụm từ mới chưa có trong từ điển gốc để nạp trực tiếp vào dự án:
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pt-1 pr-1">
                          {autoDiscoveredTerms.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 bg-[#162520]/50 border border-emerald-900/50 rounded-lg px-2 py-0.5 text-[11px] shadow-sm font-semibold text-emerald-350 text-emerald-300"
                              title={`${item.chinese} (${item.pinyin}) -> Ghi chú: ${item.note}`}
                            >
                              <code className="text-rose-400 font-bold font-mono text-[10px]">{item.chinese}</code>
                              <ChevronRight className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span className="text-slate-105 text-slate-100 font-bold">{item.vietnamese}</span>
                              <span className="text-[8px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.2 rounded shrink-0 font-normal border border-emerald-800/40">
                                {item.type === 'character' ? 'Nhân vật' : item.type === 'location' ? 'Địa danh' : item.type === 'term' ? 'Chiêu thức' : 'Khác'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // POLISHED TRANSLATION WORKING SPACE
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#161f30] p-2 rounded-lg border border-slate-800">
                  <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-455 text-indigo-400 animate-pulse" />
                    Biên tập GĐ 2 (Văn phong thuần Việt)
                  </span>
                  <button
                    onClick={() => handleCopyText(polishedTranslation, 'polished')}
                    className="flex items-center gap-1 hover:text-indigo-400 transition-colors shrink-0 cursor-pointer bg-[#222c3f] hover:bg-[#28354c] text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700 text-[10px]"
                  >
                    {copiedPolished ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedPolished ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <textarea
                  id="textarea-polished-translation"
                  rows={11}
                  placeholder="Bản dịch sau khi chuốt văn phong thuần Việt sẽ hiển thị tại đây..."
                  value={polishedTranslation}
                  onChange={(e) => setPolishedTranslation(e.target.value)}
                  className="w-full text-sm bg-[#161f30] border border-slate-800 rounded-xl p-4 text-slate-105 text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y shadow-inner"
                />

                {/* Additional Instructions for Polish */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-slate-405 text-slate-400" />
                    Yêu cầu biên tập đặc biệt (Ví dụ: &quot;Xưng hô huynh - muội&quot;)
                  </label>
                  <input
                    id="input-polish-instructions"
                    type="text"
                    placeholder="Không bắt buộc - ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full text-xs bg-[#161f30] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 focus:bg-[#19243a] transition-all"
                  />
                </div>

                {/* Toggle Scan for Missing Terms */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    Tự động quét tìm từ khóa mới khi biên dịch
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExtractionEnabled(!isExtractionEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionEnabled ? 'bg-indigo-650 bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-800/80">
          <button
            id="btn-polish"
            disabled={isPolishing || !rawTranslation}
            onClick={handlePolishTranslation}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-650 to-indigo-750 text-white font-bold hover:from-indigo-700 hover:to-indigo-850 hover:to-indigo-800 px-3.5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/20 text-xs hover:scale-[1.01]"
            title="Phục vụ chuốt văn phong thuần Việt trôi chảy (Dựa trên dịch thô)"
          >
            {isPolishing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Đang chuốt...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white fill-current animate-pulse animate-fadeIn" />
                Chuốt văn thuần Việt
              </>
            )}
          </button>

          <button
            id="btn-save"
            disabled={!sourceText || (!rawTranslation && !polishedTranslation)}
            onClick={handleSaveChapter}
            className="flex items-center justify-center gap-1.5 bg-[#161f30] hover:bg-[#1a253a] text-slate-300 border border-slate-750 border-slate-700 font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer text-xs"
            title="Lưu trữ chương đã biên dịch hoàn thiện này vào lịch sử truyện"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            Lưu chương dịch
          </button>
        </div>
      </div>
    </div>
  );
});








