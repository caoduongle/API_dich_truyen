import React, { useState, useEffect } from 'react';
import { StoryProject, GlossaryItem, GlossaryType, Chapter } from '../types';
import { CHINESE_EXAMPLES } from '../data/examples';
import { 
  Sparkles, Languages, ChevronRight, Copy, Check, Save, Play, 
  RefreshCw, AlertCircle, HelpCircle, BookOpen, FileText, Plus, Info, Edit3 
} from 'lucide-react';

interface TranslatorWorkspaceProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
}

export default function TranslatorWorkspace({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
}: TranslatorWorkspaceProps) {
  const [sourceText, setSourceText] = useState('');
  const [rawTranslation, setRawTranslation] = useState('');
  const [polishedTranslation, setPolishedTranslation] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');

  // Loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedPolished, setCopiedPolished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoDiscoveredTerms, setAutoDiscoveredTerms] = useState<GlossaryItem[]>([]);
  const [isApplyingGlossaryToSource, setIsApplyingGlossaryToSource] = useState(false);
  const [applyGlossarySourceCount, setApplyGlossarySourceCount] = useState<number | null>(null);

  // Suggested Glossary items state (from analysis)
  const [suggestions, setSuggestions] = useState<Omit<GlossaryItem, 'id'>[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});

  // Active viewing stage tab
  const [activeStage, setActiveStage] = useState<'raw' | 'polished'>('raw');

  // Triggering alerts
  useEffect(() => {
    // Clear outputs if active project changes to prevent mixing chapters
    setSourceText('');
    setRawTranslation('');
    setPolishedTranslation('');
    setSuggestions([]);
    setSelectedSuggestions({});
    setErrorMessage(null);
    setAutoDiscoveredTerms([]);
    setChapterTitle(`Chương ${activeProject.chapters.length + 1}: `);
  }, [activeProject.id]);

  // Load a preset example helper
  const handleLoadExample = (index: number) => {
    const ex = CHINESE_EXAMPLES[index];
    setSourceText(ex.sourceText);
    // Suggest updating project settings dynamically to suit the example
    const updated = {
      ...activeProject,
      genre: ex.genre,
      tone: ex.tone,
    };
    onUpdateProject(updated);
    setErrorMessage(null);
  };

  // 1. Magical Analyze Glossary function
  const handleAnalyzeGlossary = async () => {
    if (!sourceText.trim()) {
      setErrorMessage("Vui lòng điền nội dung chữ Trung Quốc để phân tích.");
      return;
    }
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuggestions([]);
    setSelectedSuggestions({});

    try {
      const response = await fetch('/api/analyze-glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          apiKeys,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gặp lỗi khi phân tích chữ Trung.");
      }

      const data = await response.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        // Autocheck all suggested items by default
        const checks: Record<number, boolean> = {};
        data.suggestions.forEach((_: any, idx: number) => {
          checks[idx] = true;
        });
        setSelectedSuggestions(checks);
      } else {
        throw new Error("Không tìm thấy thuật ngữ nào.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi máy chủ khi kết xuất thuật ngữ.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save selected suggestions into project glossary
  const handleImportSuggestions = () => {
    const itemsToAdd: GlossaryItem[] = [];
    suggestions.forEach((s, idx) => {
      if (selectedSuggestions[idx]) {
        // Prevent adding duplicate identical Chinese entries
        const isDuplicate = activeProject.glossary.some(
          (item) => item.chinese === s.chinese
        );
        if (!isDuplicate) {
          itemsToAdd.push({
            ...s,
            id: 'glossary_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString() // <-- THÊM DÒNG NÀY
          });
        }
      }
    });

    if (itemsToAdd.length === 0) {
      alert("Không có từ khóa mới hoặc chưa chọn từ khóa nào để lưu.");
      return;
    }

    const updated = {
      ...activeProject,
      glossary: [...activeProject.glossary, ...itemsToAdd],
    };
    onUpdateProject(updated);
    setSuggestions([]); // Clear analysis after import
    setSelectedSuggestions({});
    alert(`Đã thêm thành công ${itemsToAdd.length} nhân vật/thuật ngữ vào Từ điển của dự án!`);
  };

  // 2. Dịch thô Giai đoạn 1 (Raw Translation)
  const handleTranslateRaw = async () => {
    if (!sourceText.trim()) {
      setErrorMessage("Chưa nhập tiếng Trung gốc.");
      return;
    }
    setIsTranslating(true);
    setErrorMessage(null);
    setAutoDiscoveredTerms([]);
    setActiveStage('raw');

    try {
      const response = await fetch('/api/translate-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          genre: activeProject.genre,
          tone: activeProject.tone,
          glossary: activeProject.glossary,
          apiKeys,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gặp lỗi trong quá trình dịch thô.");
      }

      const data = await response.json();
      setRawTranslation(data.rawTranslation || "");

      // Auto-detect and add new terms to project's glossary
      if (data.discoveredEntities && Array.isArray(data.discoveredEntities) && data.discoveredEntities.length > 0) {
        const newlyDiscovered: GlossaryItem[] = [];
        data.discoveredEntities.forEach((ent: any) => {
          const exists = activeProject.glossary.some(
            (gItem) => gItem.chinese.trim() === ent.chinese.trim()
          );
          if (!exists) {
            newlyDiscovered.push({
              id: 'glo_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              chinese: ent.chinese.trim(),
              pinyin: ent.pinyin.trim(),
              vietnamese: ent.vietnamese.trim(),
              type: ent.type,
              note: ent.note.trim(),
              sourceChapter: chapterTitle || "Mặt trận dịch đơn chương",
              sourceParagraph: sourceText.split('\n').find(p =>
                  p.includes(ent.chinese.trim()) || p.replace(/\s+/g, '').includes(ent.chinese.replace(/\s+/g, '').trim())
              )?.trim() || "",
              origin: 'scanned',
              createdAt: new Date().toISOString()
            });
          }
        });

        if (newlyDiscovered.length > 0) {
          const updatedGlossary = [...activeProject.glossary, ...newlyDiscovered];
          onUpdateProject({
            ...activeProject,
            glossary: updatedGlossary,
          });
          setAutoDiscoveredTerms(newlyDiscovered);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi máy chủ khi dịch thô.");
    } finally {
      setIsTranslating(false);
    }
  };

  // 3. Chuốt văn phong thuần Việt Giai đoạn 2 (Polish Translation)
  const handlePolishTranslation = async () => {
    if (!rawTranslation.trim()) {
      setErrorMessage("Vui lòng thực hiện dịch thô lần 1 trước khi chuốt văn phong.");
      return;
    }
    setIsPolishing(true);
    setErrorMessage(null);
    setActiveStage('polished');

    try {
      const response = await fetch('/api/polish-translation', {
        // Wait, what's our server's endpoint for polish?
        // In server.ts, we defined: app.post("/api/polish-translation", ...)
        // Let's call /api/polish-translation instead of /api/polished-translation!
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText: sourceText,
          rawTranslation: rawTranslation,
          genre: activeProject.genre,
          tone: activeProject.tone,
          glossary: activeProject.glossary,
          additionalInstructions: additionalInstructions,
          apiKeys,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Lỗi chuốt văn.");
      }

      const data = await response.json();
      setPolishedTranslation(data.polishedTranslation || "");

      // Xử lý nạp các từ vựng mới được phát hiện trong lượt rà soát bổ sung của bước biên tập
      if (data.newlyDiscoveredDuringPolish && Array.isArray(data.newlyDiscoveredDuringPolish) && data.newlyDiscoveredDuringPolish.length > 0) {
        const newlyDiscovered: GlossaryItem[] = [];
        const updatedGlossary = [...activeProject.glossary];

        data.newlyDiscoveredDuringPolish.forEach((ent: any) => {
          const exists = updatedGlossary.some(
            (gItem) => gItem.chinese.trim() === ent.chinese.trim()
          );
          if (!exists) {
            const itemPayload: GlossaryItem = {
              id: 'glo_auto_polish_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              chinese: ent.chinese.trim(),
              pinyin: ent.pinyin.trim(),
              vietnamese: ent.vietnamese.trim(),
              type: ent.type,
              note: ent.note.trim(),
              origin: 'scanned',
              createdAt: new Date().toISOString()
            };
            newlyDiscovered.push(itemPayload);
            updatedGlossary.push(itemPayload);
          }
        });

        if (newlyDiscovered.length > 0) {
          setAutoDiscoveredTerms((prev) => [...prev, ...newlyDiscovered]);
          onUpdateProject({
            ...activeProject,
            glossary: updatedGlossary
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi kết nối máy chủ biên tập.");
    } finally {
      setIsPolishing(false);
    }
  };

  // Save current translated chapter to historical archives
  const handleSaveChapter = () => {
    if (!sourceText.trim()) {
      alert("Không có nội dung để lưu.");
      return;
    }
    const finalTitle = chapterTitle.trim() || `Chương ${activeProject.chapters.length + 1}: Chưa đặt tên`;
    
    // Build paragraphs array from sourceText for parallel view
    const paragraphs = sourceText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    const translatedLines = polishedTranslation
      ? polishedTranslation.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0)
      : rawTranslation.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

    const newChapter: Chapter = {
      id: 'chap_' + Date.now(),
      title: finalTitle,
      sourceText,
      rawTranslation,
      polishedTranslation,
      paragraphs,
      translatedLines,
      status: polishedTranslation.trim() ? 'completed' : rawTranslation.trim() ? 'in_progress' : 'not_started',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = {
      ...activeProject,
      chapters: [newChapter, ...activeProject.chapters],
    };

    onUpdateProject(updated);
    alert(`Đã lưu trữ thành công chương: "${finalTitle}" vào bộ nhớ lưu trữ lịch sử dịch.`);
  };

  const handleApplyGlossaryToSource = () => {
    if (!sourceText.trim()) {
      alert('Chưa có văn bản tiếng Trung gốc để áp dụng!');
      return;
    }
    if (activeProject.glossary.length === 0) {
      alert('Từ điển dự án đang trống!');
      return;
    }

    setIsApplyingGlossaryToSource(true);
    setApplyGlossarySourceCount(null);

    setTimeout(() => {
      // Sắp xếp từ dài trước để tránh thay nhầm substring
      const sortedGlossary = [...activeProject.glossary].sort(
        (a, b) => b.chinese.length - a.chinese.length
      );

      let result = sourceText;
      let replacedCount = 0;

      sortedGlossary.forEach((item) => {
        if (!item.chinese || !item.vietnamese) return;
        const escaped = item.chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        const before = result;
        result = result.replace(regex, item.vietnamese);
        if (result !== before) replacedCount++;
      });

      setSourceText(result);
      setApplyGlossarySourceCount(replacedCount);
      setIsApplyingGlossaryToSource(false);
    }, 300);
  };

  const handleCopyText = (text: string, type: 'raw' | 'polished') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } else {
      setCopiedPolished(true);
      setTimeout(() => setCopiedPolished(false), 2000);
    }
  };

  const toggleCheck = (idx: number) => {
    setSelectedSuggestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div id="translator-workspace" className="space-y-4">
      {/* Active Project Card info */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div id="project-workspace-info" className="space-y-1">
          <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/35 uppercase tracking-wider">
            Dự án: {activeProject.title}
          </span>
          <h2 className="text-base font-bold tracking-tight mt-1">
            Không Gian Dịch Thuật Công Nghệ Cao
          </h2>
          <p className="text-slate-400 text-xs">
            Tận dụng Gemini để lưu truyền mượt mà ngữ điệu truyện chữ Trung sang thuần Việt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 p-2.5 rounded-lg max-w-md">
          <div className="text-xs">
            <span className="text-slate-400 block font-medium">Thể loại:</span>
            <span className="font-bold text-indigo-300">{activeProject.genre}</span>
          </div>
          <div className="h-6 w-[1px] bg-white/10"></div>
          <div className="text-xs">
            <span className="text-slate-400 block font-medium">Từ điển quy định:</span>
            <span className="font-bold text-indigo-300">{activeProject.glossary.length} từ khóa</span>
          </div>
          <div className="h-6 w-[1px] bg-white/10"></div>
          <div className="text-xs">
            <span className="text-slate-400 block font-medium">Tông giọng chủ đạo:</span>
            <span className="font-bold text-indigo-300 line-clamp-1">{activeProject.tone}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Lưu ý hệ thống:</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Grid workspace input vs processes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left column - Source space */}
        <div className="space-y-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="flex items-center justify-center w-4 h-4 rounded bg-slate-900 text-white text-[10px] font-bold">1</span>
              Nội Dung Tiếng Trung Gốc
            </h3>
            
            {/* Presets selectors */}
            <div className="hidden sm:flex items-center gap-1 text-[11px]">
              <span className="text-slate-400 font-medium">Bản mẫu:</span>
              {CHINESE_EXAMPLES.map((ex, idx) => (
                <button
                  id={`btn-load-sample-${idx}`}
                  key={idx}
                  onClick={() => handleLoadExample(idx)}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition-colors pointer cursor-pointer font-semibold"
                  title={ex.description}
                >
                  Mẫu {idx + 1}
                </button>
              ))}
            </div>
          </div>

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
              onChange={(e) => setSourceText(e.target.value)}
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

          {/* Quick instructions mobile view placeholder */
          <div className="sm:hidden flex items-center gap-1 text-[11px] text-slate-500 overflow-x-auto pb-1">
            <span className="shrink-0 font-medium">Quick load:</span>
            {CHINESE_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadExample(idx)}
                className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] shrink-0 pointer font-semibold"
              >
                Mẫu {idx + 1}
              </button>
            ))}
          </div>

          {/* Core Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">

            <button
              type="button"
              disabled={!sourceText || activeProject.glossary.length === 0 || isApplyingGlossaryToSource}
              onClick={handleApplyGlossaryToSource}
              className="w-full flex items-center justify-center gap-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs"
              title={activeProject.glossary.length === 0 ? 'Từ điển dự án đang trống' : 'Thay thế các từ tiếng Trung trong văn bản gốc bằng bản dịch từ từ điển'}
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
                  {activeProject.glossary.length > 0 && (
                    <span className="ml-1 bg-amber-200 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {activeProject.glossary.length} từ
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              id="btn-analyze-names"
              disabled={isAnalyzing || !sourceText}
              onClick={handleAnalyzeGlossary}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 text-white font-semibold hover:bg-slate-800 px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs"
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
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs text-xs"
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
                <div className="space-y-2 animate-fade-in">
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

                  <button
                    type="button"
                    disabled={!rawTranslation || activeProject.glossary.length === 0 || isApplyingGlossary}
                    onClick={handleApplyGlossaryToRaw}
                    className="w-full flex items-center justify-center gap-1.5 border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold px-3 py-2 rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    title={activeProject.glossary.length === 0 ? 'Từ điển dự án đang trống' : 'Thay thế các từ tiếng Trung trong bản dịch thô bằng bản dịch từ từ điển'}
                  >
                    {isApplyingGlossary ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        Đang áp dụng từ điển...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        Áp dụng từ điển vào raw
                        {activeProject.glossary.length > 0 && (
                          <span className="ml-1 bg-indigo-200 text-indigo-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                            {activeProject.glossary.length} từ
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {applyGlossaryCount !== null && !isApplyingGlossary && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>
                        Đã thay thế thành công <strong>{applyGlossaryCount}</strong> thuật ngữ từ từ điển vào bản dịch thô.
                      </span>
                    </div>
                  )}

                  {rawTranslation && (
                    <div className="space-y-2">
                      <div className="bg-indigo-50/50 text-indigo-900 rounded-lg p-2.5 border border-indigo-100 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-indigo-950">Dịch thô giai đoạn 1 hoàn chỉnh!</p>
                          <p>Nhấn tab <strong>Biên tập (2)</strong> và bấm chuốt văn phong để nâng cấp mượt mà.</p>
                        </div>
                      </div>

                      {autoDiscoveredTerms.length > 0 && (
                        <div className="bg-emerald-50/60 border border-emerald-205 text-emerald-950 p-2.5 rounded-lg space-y-1.5 animate-slide-up">
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
                <div className="space-y-2 animate-fade-in">
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

      {/* Suggested entities container drawer-like/panel */}
      {suggestions.length > 0 && (
        <div id="entities-analysis-drawer" className="bg-slate-900 border border-slate-800 text-white rounded-xl p-4 space-y-3 shadow-md animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 fill-current text-indigo-400" />
                Kết Quả Gợi Ý Từ Điển Âm Hán Việt & Nhân Vật
              </h4>
              <p className="text-[11px] text-slate-400">
                AI đã tự động phát hiện được {suggestions.length} danh từ riêng quan trọng. Hãy lọc và thêm vào bộ Quy định.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const checkAll: Record<number, boolean> = {};
                  suggestions.forEach((_, idx) => { checkAll[idx] = true; });
                  setSelectedSuggestions(checkAll);
                }}
                className="text-[10px] font-bold text-slate-300 hover:text-white pointer cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-slate-300"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setSelectedSuggestions({})}
                className="text-[10px] font-bold text-slate-300 hover:text-white pointer cursor-pointer uppercase tracking-wider border-b border-transparent hover:border-slate-300"
              >
                Bỏ chọn
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleCheck(idx)}
                className={`p-2 rounded border transition-all cursor-pointer flex items-start gap-2 ${
                  selectedSuggestions[idx]
                    ? 'bg-slate-850 border-indigo-500 text-white shadow-xs'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!selectedSuggestions[idx]}
                  onChange={() => {}} // handled by div click
                  className="mt-0.5 rounded accent-indigo-600 shrink-0 cursor-pointer pointer-events-none"
                />
                <div className="text-[11px] space-y-0.5">
                  <div className="flex items-center gap-1">
                    <strong className="font-mono text-white tracking-wide">{item.chinese}</strong>
                    <span className="text-slate-500 text-[9px]">({item.pinyin})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Dịch: </span>
                    <strong className="text-indigo-300">{item.vietnamese}</strong>
                  </div>
                  <div className="text-[9px] text-slate-500 line-clamp-1 italic">
                    {item.note || `Thể loại: ${item.type}`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              id="btn-import-suggestions"
              onClick={handleImportSuggestions}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors pointer"
            >
              Lưu các từ đã chọn vào Từ Điển Dự Án
            </button>
          </div>
        </div>
      )}

      {/* Matching Glossary items helper highlights */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          Từ điển đang kích hoạt có trong Dự án ({activeProject.glossary.length} từ)
        </h3>
        {activeProject.glossary.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            Bạn chưa khai báo từ điển nào cho chương truyện này. Thử nhấp nút &quot;Phân tích gợi ý nhân vật&quot; bên trên để tạo từ điển tự động!
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {activeProject.glossary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs shadow-xs text-slate-600 font-sans"
                title={`${item.chinese} -> ${item.vietnamese} (${item.note})`}
              >
                <code className="font-mono bg-slate-100 px-1 rounded text-red-600 font-bold text-[11px]">{item.chinese}</code>
                <ChevronRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="font-bold text-indigo-950 bg-indigo-50/40 border border-indigo-100 px-1 py-0.2 rounded text-[11px]">{item.vietnamese}</span>
                {item.type === 'character' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
