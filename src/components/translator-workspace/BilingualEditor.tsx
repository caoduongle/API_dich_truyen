import React from 'react';
import { 
  RefreshCw, Play, Sparkles, BookOpen, FileText, Copy, Check, Save, 
  ChevronRight, Edit3 
} from 'lucide-react';
import { Chapter, GlossaryItem } from '../../types';
import { CHINESE_EXAMPLES } from '../../data/examples';

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
  untranslatedChapters: Chapter[];
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
}: BilingualEditorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column - Source space */}
      <div className="space-y-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="flex items-center justify-center w-4 h-4 rounded bg-slate-900 text-white text-[10px] font-bold">1</span>
            Nội Dung Tiếng Trung Gốc
          </h3>
          
          {/* Dropdown các chương chưa dịch */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium whitespace-nowrap hidden xs:inline">Nạp chương chưa dịch:</span>
            <select
              id="select-untranslated-chapter"
              onChange={(e) => {
                const chapId = e.target.value;
                if (!chapId) return;
                handleLoadChapterById(chapId);
                e.target.value = '';
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-305 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[150px] xs:max-w-[200px] truncate cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>-- Chọn chương --</option>
              {untranslatedChapters.length === 0 ? (
                <option value="" disabled>Không có chương chưa dịch</option>
              ) : (
                untranslatedChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Examples section if source text is empty */}
        {!sourceText && (
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5 animate-fadeIn">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ví dụ nạp thử nghiệm:</span>
            <div className="flex flex-wrap gap-2">
              {CHINESE_EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadExample(idx)}
                  className="bg-white border border-slate-200 hover:border-indigo-400 rounded px-2 py-1 text-xs text-slate-650 font-bold transition cursor-pointer"
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tiêu đề chương / Tiêu đề truyện dịch:</label>
          <input
            id="input-chapter-title"
            type="text"
            placeholder="Ví dụ: Chương 1: Diễn biến kịch tính dồn dập..."
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white"
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
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-all resize-y"
          />
          {sourceText && (
            <span className="absolute bottom-2 right-2 text-[10px] text-slate-400 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
              {sourceText.length} kí tự
            </span>
          )}
        </div>

        {applyGlossarySourceCount !== null && !isApplyingGlossaryToSource && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
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
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 border border-slate-350 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded transition-all cursor-pointer text-xs"
              title="Khôi phục văn bản tiếng Trung gốc ban đầu"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Khôi phục gốc
            </button>
          )}

          <button
            type="button"
            disabled={!sourceText || glossaryLength === 0 || isApplyingGlossaryToSource}
            onClick={handleApplyGlossaryToSource}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            title={glossaryLength === 0 ? 'Từ điển dự án đang trống' : 'Thay thế các từ tiếng Trung trong văn bản gốc bằng bản dịch từ từ điển'}
          >
            {isApplyingGlossaryToSource ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                Đang áp dụng từ điển...
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                Áp dụng từ điển vào raw
                {glossaryLength > 0 && (
                  <span className="ml-1 bg-amber-200 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {glossaryLength} từ
                  </span>
                )}
              </>
            )}
          </button>

          <button
            id="btn-analyze-names"
            disabled={isAnalyzing || !sourceText}
            onClick={handleAnalyzeGlossary}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 text-white font-semibold hover:bg-slate-800 px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            title="Phân tích đoạn văn để đề xuất từ vựng, tên nhân vật thích hợp"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                Đang tìm kiếm nhân vật...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Phân tích gợi ý nhân vật
              </>
            )}
          </button>

          <button
            id="btn-translate-draft1"
            disabled={isTranslating || !sourceText}
            onClick={handleTranslateRaw}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs text-xs"
          >
            {isTranslating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Đang dịch thô lần 1...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-white fill-current" />
                Dịch thô (Giai đoạn 1)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right column - Dual Action Translation Panels */}
      <div className="space-y-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-150 pb-2">
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
              <span className="flex items-center justify-center w-4 h-4 rounded bg-indigo-650 text-white text-[10px] font-bold">2</span>
              <span className="text-slate-900">Kết Quả AI Biên Tập</span>
            </h3>
            
            {/* Stages toggles */}
            <div className="flex bg-slate-100 p-0.5 rounded">
              <button
                id="tab-toggle-raw"
                onClick={() => setActiveStage('raw')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all pointer cursor-pointer ${
                  activeStage === 'raw'
                    ? 'bg-white text-slate-900 border border-slate-200/50 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dịch thô (1)
              </button>
              <button
                id="tab-toggle-polished"
                onClick={() => setActiveStage('polished')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all pointer cursor-pointer ${
                  activeStage === 'polished'
                    ? 'bg-white text-slate-900 border border-slate-200/50 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Biên tập (2)
              </button>
            </div>
          </div>

          {/* Display panel */}
          <div className="space-y-3">
            {activeStage === 'raw' ? (
              // RAW TRANSLATION WORKING SPACE
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 p-1.5 rounded border border-slate-200">
                  <span className="font-semibold text-slate-500 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    Bản dịch thô GĐ1 (Sửa trực tiếp được)
                  </span>
                  <button
                    onClick={() => handleCopyText(rawTranslation, 'raw')}
                    className="flex items-center gap-1 hover:text-indigo-700 transition-colors shrink-0 pointer cursor-pointer bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-200"
                  >
                    {copiedRaw ? <Check className="w-3 h-3 text-indigo-600" /> : <Copy className="w-3 h-3" />}
                    {copiedRaw ? 'Đã chép' : 'Sao chép thô'}
                  </button>
                </div>

                <textarea
                  id="textarea-raw-translation"
                  rows={11}
                  placeholder="Bản dịch thô sẽ hiển thị tại đây sau khi hệ thống chạy xong giai đoạn 1. Bạn hoàn toàn có thể tự sửa đổi câu từ ở đây để làm tiền đề chuốt văn phong."
                  value={rawTranslation}
                  onChange={(e) => setRawTranslation(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 transition-all resize-y"
                />

                {rawTranslation && (
                  <div className="space-y-2">
                    <div className="bg-indigo-55 bg-indigo-50/50 text-indigo-900 rounded-lg p-2.5 border border-indigo-100 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-indigo-955 text-indigo-950">Dịch thô giai đoạn 1 hoàn chỉnh!</p>
                        <p>Nhấn tab <strong>Biên tập (2)</strong> và bấm chuốt văn phong để nâng cấp mượt mà.</p>
                      </div>
                    </div>

                    {autoDiscoveredTerms.length > 0 && (
                      <div className="bg-emerald-50/60 border border-emerald-205 text-emerald-955 text-emerald-950 p-2.5 rounded-lg space-y-1.5 animate-slideUp">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-800">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Tự Động Bổ Sung Từ Điển Mới ({autoDiscoveredTerms.length})</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 leading-tight">
                          AI đã tự động trích xuất các tên riêng nhân vật, địa danh bí ẩn hoặc chiêu thức vừa xuất hiện chưa có trong bộ gốc, nạp thẳng vào từ điển dự án:
                        </p>
                        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pt-1 pr-1">
                          {autoDiscoveredTerms.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-[11px] shadow-3xs font-semibold text-emerald-950"
                              title={`${item.chinese} (${item.pinyin}) -> Ghi chú: ${item.note}`}
                            >
                              <code className="text-red-650 font-bold font-mono text-[10px]">{item.chinese}</code>
                              <ChevronRight className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span className="text-emerald-900 font-bold">{item.vietnamese}</span>
                              <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded ml-0.5 shrink-0 font-normal">
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
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 p-1.5 rounded border border-slate-200">
                  <span className="font-semibold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Bản biên tập GĐ2 (Thuần vần điệu bản ngữ)
                  </span>
                  <button
                    onClick={() => handleCopyText(polishedTranslation, 'polished')}
                    className="flex items-center gap-1 hover:text-indigo-700 transition-colors shrink-0 pointer cursor-pointer bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-200"
                  >
                    {copiedPolished ? <Check className="w-3 h-3 text-indigo-600" /> : <Copy className="w-3 h-3" />}
                    {copiedPolished ? 'Đã chép' : 'Sao chép bản chuốt'}
                  </button>
                </div>

                <textarea
                  id="textarea-polished-translation"
                  rows={11}
                  placeholder="Bản dịch sau khi được chuốt mịn và tinh chỉnh ngữ nghĩa tinh tế, đạt văn phong thuần Việt sẽ xuất hiện tại đây..."
                  value={polishedTranslation}
                  onChange={(e) => setPolishedTranslation(e.target.value)}
                  className="w-full text-sm bg-indigo-50/5 border border-indigo-150 rounded-lg p-3 text-indigo-950 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 transition-all resize-y"
                />

                {/* Additional Instructions for Polish */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-slate-400" />
                    Yêu cầu biên tập đặc biệt (Ví dụ: &quot;Chuyển xưng hô nam chính thành đại ca&quot;...):
                  </label>
                  <input
                    id="input-polish-instructions"
                    type="text"
                    placeholder="Không bắt buộc - ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Toggle Scan for Missing Terms */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Tự động quét tìm thuật ngữ mới bị bỏ sót khi chuốt
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExtractionEnabled(!isExtractionEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-150">
          <button
            id="btn-polish"
            disabled={isPolishing || !rawTranslation}
            onClick={handlePolishTranslation}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold hover:from-indigo-700 hover:to-indigo-800 px-3.5 py-2 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs text-xs"
            title="Phục vụ chuốt văn phong thuần Việt trôi chảy (Dựa trên dịch thô)"
          >
            {isPolishing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Đang chuốt thuần Việt...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white fill-current animate-pulse" />
                Chuốt văn phong thuần Việt
              </>
            )}
          </button>

          <button
            id="btn-save"
            disabled={!sourceText || (!rawTranslation && !polishedTranslation)}
            onClick={handleSaveChapter}
            className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold px-3 py-2 rounded transition-colors cursor-pointer text-xs"
            title="Lưu trữ chương đã biên dịch hoàn thiện này vào lịch sử truyện"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            Lưu Chương Dịch
          </button>
        </div>
      </div>
    </div>
  );
});
