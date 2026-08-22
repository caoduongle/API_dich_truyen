import React, { useState } from 'react';
import { 
  RefreshCw, Play, Sparkles, BookOpen, FileText, Copy, Check, Save, 
  ChevronRight, Edit3, Eraser
} from 'lucide-react';
import { ChapterMetadata, GlossaryItem, StoryProject } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { cleanChineseText } from '../../utils/textCleaner';
import { QaCritiquePanel } from './QaCritiquePanel';
import { QuickAddTermModal } from './QuickAddTermModal';
import { ChapterSelectorToolbar } from './ChapterSelectorToolbar';
import { useHotkeys } from '../../hooks/useHotkeys';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Kbd } from '../ui/Kbd';
import { CollaboratorPresenceBar } from './CollaboratorPresenceBar';
import { CRDTSyncStatus, UserPresence } from '../../types/crdt';

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
  crdtStatus?: CRDTSyncStatus;
  collaborators?: UserPresence[];
  onFieldFocus?: (field: 'raw' | 'polished' | 'idle') => void;
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
  qaIssues,
  isCheckingQa,
  crdtStatus,
  collaborators,
  onFieldFocus,
}: BilingualEditorProps) {
  const { showToast } = useNotifications();
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedContext, setSelectedContext] = useState('');

  // Hotkey bindings
  useHotkeys('ctrl+s', () => {
    if (sourceText && (rawTranslation || polishedTranslation)) {
      handleSaveChapter();
    }
  });

  useHotkeys('ctrl+enter', () => {
    if (activeStage === 'raw' && !isTranslating && sourceText) {
      handleTranslateRaw();
    } else if (activeStage === 'polished' && !isPolishing && rawTranslation) {
      handlePolishTranslation();
    }
  });

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    if (start !== end) {
      const selected = target.value.substring(start, end).trim();
      if (selected.length > 0 && selected.length <= 15) {
        setSelectedTerm(selected);
        const lineStart = target.value.lastIndexOf('\n', start) + 1;
        const lineEnd = target.value.indexOf('\n', end);
        const contextLine = target.value.substring(
          lineStart, 
          lineEnd === -1 ? target.value.length : lineEnd
        ).trim();
        setSelectedContext(contextLine);
      }
    }
  };

  const handleCleanText = () => {
    if (!sourceText) return;
    const cleaned = cleanChineseText(sourceText);
    setSourceText(cleaned);
    if (!isGlossaryApplied) {
      setOriginalSourceText(cleaned);
    }
    showToast({ message: "Đã lọc sạch văn bản rác, khoảng trắng dư thừa!", type: 'success' });
  };

  // Mismatch calculation
  const sourceParaCount = sourceText.split('\n').filter(p => p.trim() !== '').length;
  const currentTranslationText = activeStage === 'polished' ? (polishedTranslation || rawTranslation) : rawTranslation;
  const translationParaCount = currentTranslationText.split('\n').filter(p => p.trim() !== '').length;
  const isMismatch = warningParagraphMismatch && sourceParaCount > 0 && translationParaCount > 0 && sourceParaCount !== translationParaCount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left column - Chinese Source Text Section */}
      <div className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs flex flex-col justify-between animate-fadeIn">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-parchment-2 pb-3">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5 font-display">
              <span className="flex items-center justify-center w-5 h-5 rounded-[2px] bg-ink text-polish text-[10px] font-bold border border-parchment-2">1</span>
              <span>Nguyên Tác Chữ Hán</span>
            </h3>

            <ChapterSelectorToolbar
              untranslatedChapters={untranslatedChapters}
              onLoadChapterById={handleLoadChapterById}
              onLoadExample={handleLoadExample}
              sourceText={sourceText}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-text-muted">Tiêu đề chương / Tiêu đề truyện dịch</label>
            <input
              id="input-chapter-title"
              type="text"
              placeholder="Ví dụ: Chương 1: Diễn biến kịch tính dồn dập..."
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main font-semibold focus:outline-none focus:border-draft transition-all"
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
              className="w-full text-sm bg-ink border border-parchment-2 rounded-[3px] p-4 text-text-main font-serif leading-relaxed focus:outline-none focus:border-draft transition-all resize-y"
            />
            {sourceText && (
              <span className="absolute bottom-3 right-3 text-[9px] text-text-muted bg-parchment px-2 py-0.5 rounded-[2px] border border-parchment-2 font-mono">
                {sourceText.length.toLocaleString()} ký tự
              </span>
            )}
          </div>

          {/* Quick Add Glossary Term Widget */}
          <QuickAddTermModal
            selectedTerm={selectedTerm}
            selectedContext={selectedContext}
            onClose={() => {
              setSelectedTerm('');
              setSelectedContext('');
            }}
            activeProject={activeProject}
            onUpdateProject={onUpdateProject}
            apiKeys={apiKeys}
            selectedModel={selectedModel}
          />

          {applyGlossarySourceCount !== null && !isApplyingGlossaryToSource && (
            <div className="bg-draft/20 border border-draft/40 text-text-main rounded-[2px] px-4 py-2.5 text-xs flex items-center gap-2.5 animate-fadeIn">
              <BookOpen className="w-4 h-4 text-draft shrink-0" />
              <span>
                Đã thay thế thành công <strong>{applyGlossarySourceCount}</strong> thuật ngữ từ từ điển vào văn bản gốc.
              </span>
            </div>
          )}

          {/* Core Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {isGlossaryApplied && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSourceText(originalSourceText);
                  setIsGlossaryApplied(false);
                }}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="w-full sm:flex-1"
                title="Khôi phục văn bản tiếng Trung gốc ban đầu"
              >
                Khôi phục gốc
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!sourceText || glossaryLength === 0 || isApplyingGlossaryToSource}
              onClick={handleApplyGlossaryToSource}
              icon={isApplyingGlossaryToSource ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <BookOpen className="w-3.5 h-3.5 text-amber-400" />}
              className="w-full sm:flex-1 text-amber-300 border-amber-800/40 bg-amber-950/20 hover:bg-amber-950/40"
              title={glossaryLength === 0 ? 'Từ điển dự án đang trống' : 'Thay thế các từ tiếng Trung trong văn bản gốc bằng bản dịch từ từ điển'}
            >
              {isApplyingGlossaryToSource ? 'Đang áp dụng...' : 'Áp dụng từ điển'}
              {!isApplyingGlossaryToSource && glossaryLength > 0 && (
                <Badge tone="warning" className="ml-1">
                  {glossaryLength}
                </Badge>
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!sourceText}
              onClick={handleCleanText}
              icon={<Eraser className="w-3.5 h-3.5 text-text-muted" />}
              className="w-full sm:flex-1"
              title="Loại bỏ quảng cáo, dòng trống trùng lặp, khoảng trắng rác tiếng Trung"
            >
              Dọn rác
            </Button>

            <Button
              id="btn-analyze-names"
              type="button"
              variant="secondary"
              size="sm"
              disabled={isAnalyzing || !sourceText}
              onClick={handleAnalyzeGlossary}
              icon={isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-text-muted" /> : <Sparkles className="w-3.5 h-3.5 text-text-muted" />}
              className="w-full sm:flex-1"
              title="Phân tích đoạn văn để đề xuất từ vựng, tên nhân vật thích hợp"
            >
              {isAnalyzing ? 'Đang tìm...' : 'Tìm nhân vật'}
            </Button>

            <Button
              id="btn-translate-draft1"
              type="button"
              variant="primary"
              size="sm"
              disabled={isTranslating || !sourceText}
              onClick={handleTranslateRaw}
              icon={isTranslating ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <Play className="w-3.5 h-3.5 text-white fill-current" />}
              className="w-full sm:flex-1 bg-draft hover:bg-[#4E5E75]"
              aria-label="Dịch thô chương hiện tại (Ctrl+Enter)"
            >
              <span>Dịch thô (GĐ 1)</span>
              <Kbd className="hidden lg:inline-block text-[9px] bg-black/20 text-white/90">Ctrl+↵</Kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Right column - Dual Action Translation Panels */}
      <div className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs flex flex-col justify-between animate-fadeIn">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between border-b border-parchment-2 pb-3 gap-2">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5 font-display">
              <span className="flex items-center justify-center w-5 h-5 rounded-[2px] bg-polish text-white text-[10px] font-bold">2</span>
              <span>Kết Quả Biên Soạn Bản Thảo</span>
            </h3>

            <div className="flex items-center gap-2">
              {/* Thanh hiện diện cộng tác Real-Time CRDT */}
              <CollaboratorPresenceBar
                status={crdtStatus || 'offline'}
                collaborators={collaborators || []}
                isShared={activeProject.isShared || false}
              />
              
              {/* Stages toggles */}
              <div className="flex bg-ink p-0.5 rounded-[2px] border border-parchment-2">
                <button
                  id="tab-toggle-raw"
                  onClick={() => setActiveStage('raw')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-[2px] transition-all cursor-pointer ${
                    activeStage === 'raw'
                      ? 'bg-draft text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Dịch thô (1)
                </button>
                <button
                  id="tab-toggle-polished"
                  onClick={() => setActiveStage('polished')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-[2px] transition-all cursor-pointer ${
                    activeStage === 'polished'
                      ? 'bg-polish text-white shadow-xs glow-polish'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Biên tập (2)
                </button>
              </div>
            </div>
          </div>

          {/* Display panel */}
          <div className="space-y-3">
            <QaCritiquePanel
              isMismatch={isMismatch}
              sourceParaCount={sourceParaCount}
              translationParaCount={translationParaCount}
              isCheckingQa={isCheckingQa}
              enableAiQaCritique={enableAiQaCritique}
              qaIssues={qaIssues}
            />

            {activeStage === 'raw' ? (
              // RAW TRANSLATION WORKING SPACE
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-text-muted bg-ink p-2 rounded-[2px] border border-parchment-2">
                  <span className="font-semibold text-text-muted flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-draft" />
                    Bản dịch thô GĐ 1 (Hỗ trợ sửa đổi trực tiếp)
                  </span>
                  <button
                    onClick={() => handleCopyText(rawTranslation, 'raw')}
                    className="flex items-center gap-1 text-text-muted hover:text-text-main transition-colors shrink-0 cursor-pointer bg-parchment hover:bg-parchment-2 px-2.5 py-0.5 rounded-[2px] border border-parchment-2 text-[10px]"
                  >
                    {copiedRaw ? <Check className="w-3 h-3 text-polish" /> : <Copy className="w-3 h-3" />}
                    {copiedRaw ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <textarea
                  id="textarea-raw-translation"
                  rows={11}
                  placeholder="Bản dịch thô sẽ hiển thị tại đây sau khi chạy Giai đoạn 1..."
                  value={rawTranslation}
                  onChange={(e) => setRawTranslation(e.target.value)}
                  onFocus={() => onFieldFocus?.('raw')}
                  onBlur={() => onFieldFocus?.('idle')}
                  className="w-full text-sm bg-ink border border-parchment-2 rounded-[3px] p-4 text-text-main font-sans leading-relaxed focus:outline-none focus:border-draft transition-all resize-y"
                />

                {rawTranslation && (
                  <div className="space-y-2">
                    <div className="bg-draft/15 text-text-main rounded-[2px] p-3 border border-draft/30 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-draft shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-text-main">Dịch thô giai đoạn 1 hoàn thành!</p>
                        <p className="text-text-muted">Vui lòng chuyển qua tab <strong>Biên tập (2)</strong> để bắt đầu chuốt văn phong chu sa.</p>
                      </div>
                    </div>

                    {autoDiscoveredTerms.length > 0 && (
                      <div className="bg-ink border border-parchment-2 text-text-main p-3.5 rounded-[2px] space-y-1.5 animate-slideUp">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-polish">
                          <Sparkles className="w-3.5 h-3.5 text-polish animate-pulse" />
                          <span>Tự Động Ghi Nhận Thuật Ngữ Mới ({autoDiscoveredTerms.length})</span>
                        </div>
                        <p className="text-[10px] text-text-muted leading-relaxed">
                          AI đã tự động trích xuất các cụm từ mới chưa có trong từ điển gốc để nạp trực tiếp vào dự án:
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pt-1 pr-1">
                          {autoDiscoveredTerms.map((term, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-parchment border border-parchment-2 rounded-[2px] text-xs text-text-main"
                            >
                              <span className="font-medium text-amber-400">{term.chinese}</span>
                              <span className="text-text-muted">→</span>
                              <span className="font-semibold text-polish">{term.vietnamese}</span>
                              {term.type && (
                                <span className="text-[9px] bg-ink px-1 rounded-[2px] text-text-muted border border-parchment-2">
                                  {term.type}
                                </span>
                              )}
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
                <div className="flex items-center justify-between text-[11px] text-text-muted bg-ink p-2 rounded-[2px] border border-parchment-2">
                  <span className="font-semibold text-text-main flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-polish animate-pulse" />
                    Biên tập GĐ 2 (Văn phong thuần Việt chu sa)
                  </span>
                  <button
                    onClick={() => handleCopyText(polishedTranslation, 'polished')}
                    className="flex items-center gap-1 text-text-muted hover:text-text-main transition-colors shrink-0 cursor-pointer bg-parchment hover:bg-parchment-2 px-2.5 py-0.5 rounded-[2px] border border-parchment-2 text-[10px]"
                  >
                    {copiedPolished ? <Check className="w-3 h-3 text-polish" /> : <Copy className="w-3 h-3" />}
                    {copiedPolished ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>

                <textarea
                  id="textarea-polished-translation"
                  rows={11}
                  placeholder="Bản dịch sau khi chuốt văn phong thuần Việt sẽ hiển thị tại đây..."
                  value={polishedTranslation}
                  onChange={(e) => setPolishedTranslation(e.target.value)}
                  onFocus={() => onFieldFocus?.('polished')}
                  onBlur={() => onFieldFocus?.('idle')}
                  className="w-full text-sm bg-ink border border-parchment-2 rounded-[3px] p-4 text-text-main font-sans leading-relaxed focus:outline-none focus:border-polish transition-all resize-y"
                />

                {/* Additional Instructions for Polish */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-text-muted" />
                    Yêu cầu biên tập đặc biệt (Ví dụ: &quot;Xưng hô huynh - muội&quot;)
                  </label>
                  <input
                    id="input-polish-instructions"
                    type="text"
                    placeholder="Không bắt buộc - ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish transition-all"
                  />
                </div>

                {/* Toggle Scan for Missing Terms */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-polish animate-pulse" />
                    Tự động quét tìm từ khóa mới khi biên dịch
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExtractionEnabled(!isExtractionEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionEnabled ? 'bg-polish' : 'bg-parchment-2'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-parchment-2">
          <Button
            id="btn-polish"
            variant="primary"
            size="md"
            disabled={isPolishing || !rawTranslation}
            onClick={handlePolishTranslation}
            icon={isPolishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white fill-current" />}
            className="flex-1 glow-polish"
            aria-label="Chuốt văn phong thuần Việt (Ctrl+Enter)"
            title="Phục vụ chuốt văn phong thuần Việt trôi chảy (Dựa trên dịch thô)"
          >
            <span>Chuốt văn thuần Việt</span>
            <Kbd className="hidden lg:inline-block text-[9px] bg-black/20 text-white/90">Ctrl+↵</Kbd>
          </Button>

          <Button
            id="btn-save"
            variant="secondary"
            size="md"
            disabled={!sourceText || (!rawTranslation && !polishedTranslation)}
            onClick={handleSaveChapter}
            icon={<Save className="w-3.5 h-3.5 text-text-muted" />}
            className="flex-none font-bold"
            aria-label="Lưu chương dịch vào lịch sử (Ctrl+S)"
            title="Lưu trữ chương đã biên dịch hoàn thiện này vào lịch sử truyện (Ctrl+S)"
          >
            <span>Lưu chương dịch</span>
            <Kbd className="hidden lg:inline-block text-[9px]">Ctrl+S</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
});

export default BilingualEditor;
