import React, { useState, useEffect, useRef, useDeferredValue, useMemo, useCallback } from 'react';
import { StoryProject, GlossaryItem, GlossaryType, Chapter, PendingGlossaryItem } from '../types';
import { parseTxtContent, parseEpubFile } from '../utils/fileParser';
import { Edit3, AlertCircle } from 'lucide-react';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { apiFetch } from '../utils/apiClient';
import { translateRawDirect, polishTranslationDirect } from '../services/directTranslationEngine';
import { GLOSSARY_LIMITS } from '@shared/constants';

// Sub-components
import { ProjectMetadataModal } from './translator-workspace/ProjectMetadataModal';
import { ImportChaptersModal } from './translator-workspace/ImportChaptersModal';
import { BilingualEditor } from './translator-workspace/BilingualEditor';
import { GlossarySidebar } from './translator-workspace/GlossarySidebar';
import { SuggestionsDrawer } from './translator-workspace/SuggestionsDrawer';

import { CHINESE_EXAMPLES } from '../data/examples';

interface TranslatorWorkspaceProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  loadedChapter?: Chapter | null;
  onClearLoadedChapter?: () => void;
  warningParagraphMismatch: boolean;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
}

export default function TranslatorWorkspace({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  loadedChapter,
  onClearLoadedChapter,
  warningParagraphMismatch,
  enableAiQaCritique,
  enableSegmentTranslation,
}: TranslatorWorkspaceProps) {
  const { showToast, showConfirm } = useNotifications();
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [originalSourceText, setOriginalSourceText] = useState('');
  const [isGlossaryApplied, setIsGlossaryApplied] = useState(false);
  const [isExtractionEnabled, setIsExtractionEnabled] = useState(true);
  const [rawTranslation, setRawTranslation] = useState('');
  const [polishedTranslation, setPolishedTranslation] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [qaIssues, setQaIssues] = useState<any[]>([]);
  const [isCheckingQa, setIsCheckingQa] = useState<boolean>(false);

  // Local states for optimized glossary helper filtering
  const [glossarySearch, setGlossarySearch] = useState('');
  const [onlyShowMatching, setOnlyShowMatching] = useState(false);
  const deferredSourceText = useDeferredValue(sourceText);

  // States for Editing Project Metadata Modal
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editTone, setEditTone] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // States for importing chapters from a new file inside workspace
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importedFileName, setImportedFileName] = useState('');
  const [parsedImportChapters, setParsedImportChapters] = useState<{ title: string; sourceText: string }[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importSplitMethod, setImportSplitMethod] = useState<'regex' | 'chunk'>('regex');
  const [isParsingImportFile, setIsParsingImportFile] = useState(false);

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

  // Triggering alerts/sync on project id change
  useEffect(() => {
    setSourceText('');
    setOriginalSourceText('');
    setIsGlossaryApplied(false);
    setRawTranslation('');
    setPolishedTranslation('');
    setSuggestions([]);
    setSelectedSuggestions({});
    setErrorMessage(null);
    setAutoDiscoveredTerms([]);
    setQaIssues([]);
    setChapterTitle(`Chương ${activeProject.chapters.length + 1}: `);

    setEditTitle(activeProject.title);
    setEditAuthor(activeProject.author || '');
    setEditGenre(activeProject.genre);
    setEditTone(activeProject.tone);
    setEditDescription(activeProject.description || '');

    setImportedFileName('');
    setParsedImportChapters([]);
    setImportMode('append');
    setImportSplitMethod('regex');
    setIsParsingImportFile(false);
    if (importFileRef.current) importFileRef.current.value = '';
  }, [activeProject.id]);

  // Load a chapter from history when loadedChapter changes
  useEffect(() => {
    if (loadedChapter) {
      setCurrentChapterId(loadedChapter.id);
      setChapterTitle(loadedChapter.title);
      setSourceText(loadedChapter.sourceText);
      setOriginalSourceText(loadedChapter.sourceText);
      setIsGlossaryApplied(false);
      setRawTranslation(loadedChapter.rawTranslation || '');
      setPolishedTranslation(loadedChapter.polishedTranslation || '');
      setSuggestions([]);
      setSelectedSuggestions({});
      setErrorMessage(null);
      setAutoDiscoveredTerms([]);
      setQaIssues([]);
      onClearLoadedChapter?.();
    }
  }, [loadedChapter]);

  const handleOpenEditModal = useCallback(() => {
    setEditTitle(activeProject.title);
    setEditAuthor(activeProject.author || '');
    setEditGenre(activeProject.genre);
    setEditTone(activeProject.tone);
    setEditDescription(activeProject.description || '');

    setImportedFileName('');
    setParsedImportChapters([]);
    setImportMode('append');
    setImportSplitMethod('regex');
    setIsParsingImportFile(false);
    if (importFileRef.current) importFileRef.current.value = '';

    setIsEditingMetadata(true);
  }, [activeProject]);

  const handleImportRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setParsedImportChapters([]);
    setIsParsingImportFile(true);

    try {
      if (file.name.endsWith('.txt')) {
        const fullText = await file.text();
        const chaps = parseTxtContent(fullText, importSplitMethod);
        setParsedImportChapters(chaps);
      } else if (file.name.endsWith('.epub')) {
        const chaps = await parseEpubFile(file);
        setParsedImportChapters(chaps);
      } else {
        showToast({ message: "Chỉ hỗ trợ định dạng tệp .txt hoặc .epub.", type: 'warning' });
        setImportedFileName('');
      }
    } catch (err: any) {
      console.error(err);
      showToast({ message: "Lỗi khi đọc file raw gốc: " + err.message, type: 'error' });
      setImportedFileName('');
    } finally {
      setIsParsingImportFile(false);
    }
  };

  const handleToggleImportSplitMethod = async (method: 'regex' | 'chunk') => {
    setImportSplitMethod(method);
    if (importFileRef.current?.files?.[0] && importFileRef.current.files[0].name.endsWith('.txt')) {
      setIsParsingImportFile(true);
      try {
        const fullText = await importFileRef.current.files[0].text();
        const chaps = parseTxtContent(fullText, method);
        setParsedImportChapters(chaps);
      } catch (err: any) {
        showToast({ message: err.message, type: 'error' });
      } finally {
        setIsParsingImportFile(false);
      }
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      showToast({ message: "Vui lòng điền tên tiểu thuyết.", type: 'warning' });
      return;
    }

    let updatedChapters = [...activeProject.chapters];
    if (parsedImportChapters.length > 0) {
      const newChapters: Chapter[] = parsedImportChapters.map((pc, idx) => ({
        id: 'chap_file_import_' + Date.now() + '_' + idx,
        title: pc.title,
        sourceText: pc.sourceText,
        rawTranslation: '',
        polishedTranslation: '',
        paragraphs: [],
        translatedLines: [],
        status: 'not_started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      if (importMode === 'replace') {
        const confirmed = await showConfirm({
          title: 'Thay thế chương cũ',
          message: "Hành động này sẽ XÓA TOÀN BỘ lịch sử và bản dịch của các chương cũ trong dự án này để thay thế bằng file mới. Bạn có chắc chắn không?",
          confirmText: 'Xác nhận thay thế',
          cancelText: 'Hủy',
          type: 'danger'
        });
        if (confirmed) {
          updatedChapters = newChapters;
        } else {
          return;
        }
      } else {
        updatedChapters = [...activeProject.chapters, ...newChapters];
      }
    }

    const updated = {
      ...activeProject,
      title: editTitle.trim(),
      author: editAuthor.trim() || "Khuyết Danh",
      genre: editGenre,
      tone: editTone,
      description: editDescription.trim(),
      chapters: updatedChapters
    };
    onUpdateProject(updated);
    setIsEditingMetadata(false);

    setImportedFileName('');
    setParsedImportChapters([]);
    if (importFileRef.current) importFileRef.current.value = '';

    if (parsedImportChapters.length > 0) {
      showToast({ message: `Đã cập nhật dự án và ${importMode === 'replace' ? 'thay thế' : 'nhập thêm'} thành công ${parsedImportChapters.length} chương mới!`, type: 'success' });
    } else {
      showToast({ message: "Đã cập nhật thông tin dự án thành công!", type: 'success' });
    }
  };

  const handleLoadExample = useCallback((index: number) => {
    const ex = CHINESE_EXAMPLES[index];
    setSourceText(ex.sourceText);
    setOriginalSourceText(ex.sourceText);
    setIsGlossaryApplied(false);
    const updated = {
      ...activeProject,
      genre: ex.genre,
      tone: ex.tone,
    };
    onUpdateProject(updated);
    setErrorMessage(null);
  }, [activeProject, onUpdateProject]);

  const handleAnalyzeGlossary = async () => {
    const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
    if (!hasValidKeys) {
      setErrorMessage("Chưa cấu hình API Key cá nhân. Vui lòng thêm ít nhất một Gemini API Key trong phần Cấu hình AI để phân tích.");
      return;
    }
    if (!sourceText.trim()) {
      setErrorMessage("Vui lòng điền nội dung chữ Trung Quốc để phân tích.");
      return;
    }
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuggestions([]);
    setSelectedSuggestions({});

    try {
      const response = await apiFetch('/api/analyze-glossary', {
        method: 'POST',
        body: JSON.stringify({
          text: sourceText,
          apiKeys,
          model: selectedModel,
          sourceChapterId: currentChapterId || undefined
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gặp lỗi khi phân tích chữ Trung.");
      }

      const data = await response.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        const checks: Record<number, boolean> = {};
        data.suggestions.forEach((_: any, idx: number) => {
          checks[idx] = true;
        });
        setSelectedSuggestions(checks);
        // Cảnh báo khi văn bản đầu vào bị cắt ngắn (chỉ phân tích một phần)
        if (data.truncated) {
          showToast({
            message: `Lưu ý: Chỉ ${data.analyzedLength.toLocaleString()} / ${data.originalLength.toLocaleString()} ký tự đầu được phân tích (giới hạn tiết kiệm token).`,
            type: 'warning'
          });
        }
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

  const handleImportSuggestions = useCallback(() => {
    const itemsToAdd: GlossaryItem[] = [];
    const pendingToAdd: PendingGlossaryItem[] = [];
    suggestions.forEach((s, idx) => {
      if (selectedSuggestions[idx]) {
        const isDuplicate = activeProject.glossary.some(
          (item) => isHanEquivalent(item.chinese, s.chinese)
        );
        if (!isDuplicate) {
          const itemPayload = {
            ...s,
            id: 'glossary_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
            createdAt: new Date().toISOString(),
            sourceChapterId: currentChapterId || undefined
          };
          if (s.needsReview) {
            pendingToAdd.push({
              id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              chinese: s.chinese.trim(),
              pinyin: s.pinyin?.trim() || '',
              vietnamese: s.vietnamese.trim(),
              type: s.type || 'other',
              note: s.note?.trim() || '',
              reason: 'AI trích xuất nghi ngờ hallucinate',
              originalValue: 'Không tìm thấy cụm từ này trong văn bản gốc.',
              importedAt: new Date().toISOString(),
              needsReview: true,
              sourceChapterId: currentChapterId || undefined
            });
          } else {
            itemsToAdd.push(itemPayload);
          }
        }
      }
    });

    if (itemsToAdd.length === 0 && pendingToAdd.length === 0) {
      showToast({ message: "Không có từ khóa mới hoặc chưa chọn từ khóa nào để lưu.", type: 'warning' });
      return;
    }

    const updated = {
      ...activeProject,
      glossary: [...activeProject.glossary, ...itemsToAdd],
      pendingGlossary: [...(activeProject.pendingGlossary || []), ...pendingToAdd]
    };
    onUpdateProject(updated);
    setSuggestions([]);
    setSelectedSuggestions({});

    let msg = `Đã thêm thành công ${itemsToAdd.length} thuật ngữ vào Từ điển.`;
    if (pendingToAdd.length > 0) {
      msg += ` Có ${pendingToAdd.length} từ nghi ngờ AI nhận diện sai đã được chuyển vào hàng chờ kiểm duyệt.`;
    }
    showToast({ message: msg, type: 'success' });
  }, [suggestions, selectedSuggestions, activeProject, onUpdateProject, showToast, currentChapterId]);

  const handleTranslateRaw = async () => {
    const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
    if (!hasValidKeys) {
      setErrorMessage("Chưa cấu hình API Key cá nhân. Vui lòng thêm ít nhất một Gemini API Key trong phần Cấu hình AI để thực hiện dịch thuật.");
      return;
    }
    if (!sourceText.trim()) {
      setErrorMessage("Chưa nhập tiếng Trung gốc.");
      return;
    }
    setIsTranslating(true);
    setErrorMessage(null);
    setAutoDiscoveredTerms([]);
    setActiveStage('raw');

    try {
      const data = await translateRawDirect({
        text: sourceText,
        genre: activeProject.genre,
        tone: activeProject.tone,
        description: activeProject.description,
        glossary: isGlossaryApplied ? [] : activeProject.glossary,
        apiKeys,
        model: selectedModel,
        enableSegmentTranslation
      });

      setRawTranslation(data.rawTranslation || "");

      if (data.discoveredEntities && Array.isArray(data.discoveredEntities) && data.discoveredEntities.length > 0) {
        const newlyDiscovered: GlossaryItem[] = [];
        const pendingDiscovered: PendingGlossaryItem[] = [];
        data.discoveredEntities.forEach((ent: any) => {
          const exists = activeProject.glossary.some(
            (gItem) => isHanEquivalent(gItem.chinese, ent.chinese)
          );
          if (!exists) {
            const itemPayload: GlossaryItem = {
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
              sourceChapterId: currentChapterId || undefined,
              origin: 'scanned',
              createdAt: new Date().toISOString(),
              needsReview: ent.needsReview
            };

            if (ent.needsReview) {
              pendingDiscovered.push({
                id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                chinese: ent.chinese.trim(),
                pinyin: ent.pinyin.trim(),
                vietnamese: ent.vietnamese.trim(),
                type: ent.type,
                note: ent.note.trim(),
                reason: 'AI trích xuất nghi ngờ hallucinate',
                originalValue: 'Không tìm thấy cụm từ này trong văn bản gốc của chương.',
                importedAt: new Date().toISOString(),
                needsReview: true,
                sourceChapterId: currentChapterId || undefined
              });
            } else {
              newlyDiscovered.push(itemPayload);
            }
          }
        });

        if (newlyDiscovered.length > 0 || pendingDiscovered.length > 0) {
          const updatedGlossary = [...activeProject.glossary, ...newlyDiscovered];
          const updatedPending = [...(activeProject.pendingGlossary || []), ...pendingDiscovered];
          onUpdateProject({
            ...activeProject,
            glossary: updatedGlossary,
            pendingGlossary: updatedPending,
          });
          if (newlyDiscovered.length > 0) {
            setAutoDiscoveredTerms(newlyDiscovered);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi khi dịch thô.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePolishTranslation = async () => {
    const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
    if (!hasValidKeys) {
      setErrorMessage("Chưa cấu hình API Key cá nhân. Vui lòng thêm ít nhất một Gemini API Key trong phần Cấu hình AI để thực hiện chuốt văn.");
      return;
    }
    if (!rawTranslation.trim()) {
      setErrorMessage("Vui lòng thực hiện dịch thô lần 1 trước khi chuốt văn phong.");
      return;
    }
    setIsPolishing(true);
    setErrorMessage(null);
    setActiveStage('polished');

    try {
      const data = await polishTranslationDirect({
        sourceText: sourceText,
        rawTranslation: rawTranslation,
        genre: activeProject.genre,
        tone: activeProject.tone,
        description: activeProject.description,
        glossary: isGlossaryApplied ? [] : activeProject.glossary,
        additionalInstructions: additionalInstructions,
        apiKeys,
        model: selectedModel,
        isExtractionEnabled,
        enableSegmentTranslation
      });

      const polishedResult = data.polishedTranslation || "";
      setPolishedTranslation(polishedResult);

      if (data.discoveredEntities && Array.isArray(data.discoveredEntities) && data.discoveredEntities.length > 0) {
        const newlyDiscovered: GlossaryItem[] = [];
        const updatedGlossary = [...activeProject.glossary];

        data.discoveredEntities.forEach((ent: any) => {
          const exists = updatedGlossary.some(
            (gItem) => isHanEquivalent(gItem.chinese, ent.chinese)
          );
          if (!exists) {
            const itemPayload: GlossaryItem = {
              id: 'glo_auto_polish_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              chinese: ent.chinese.trim(),
              pinyin: ent.pinyin.trim(),
              vietnamese: ent.vietnamese.trim(),
              type: ent.type,
              note: ent.note.trim(),
              sourceChapterId: currentChapterId || undefined,
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

      // Gọi QA Critique nếu được bật
      if (enableAiQaCritique) {
        setIsCheckingQa(true);
        setQaIssues([]);
        try {
          const qaResponse = await apiFetch('/api/qa-critique', {
            method: 'POST',
            body: JSON.stringify({
              sourceText: sourceText,
              translatedText: polishedResult,
              apiKeys,
              model: selectedModel,
              startKeyIndex: data.successKeyIndex ?? 0
            })
          });
          if (qaResponse.ok) {
            const qaData = await qaResponse.json();
            setQaIssues(qaData.issues || []);
            if (!qaData.isValid && qaData.issues?.length > 0) {
              showToast({ message: `Phát hiện ${qaData.issues.length} vấn đề cần lưu ý khi kiểm duyệt chất lượng dịch.`, type: 'warning' });
            } else {
              showToast({ message: "Kiểm duyệt AI hoàn tất: Bản dịch đạt chuẩn, không phát hiện lỗi bỏ sót/thêm thắt/lặp lại.", type: 'success' });
            }
          }
        } catch (qaErr) {
          console.error("Lỗi gọi API QA Critique:", qaErr);
        } finally {
          setIsCheckingQa(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi kết nối máy chủ biên tập.");
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSaveChapter = () => {
    if (!sourceText.trim()) {
      showToast({ message: "Không có nội dung để lưu.", type: 'warning' });
      return;
    }
    const finalTitle = chapterTitle.trim() || `Chương ${activeProject.chapters.length + 1}: Chưa đặt tên`;
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
    showToast({ message: `Đã lưu trữ thành công chương: "${finalTitle}" vào bộ nhớ lưu trữ lịch sử dịch.`, type: 'success' });
  };

  const handleApplyGlossaryToSource = () => {
    if (!sourceText.trim()) {
      showToast({ message: 'Chưa có văn bản tiếng Trung gốc để áp dụng!', type: 'warning' });
      return;
    }
    if (activeProject.glossary.length === 0) {
      showToast({ message: 'Từ điển dự án đang trống!', type: 'warning' });
      return;
    }

    let baseText = sourceText;
    if (isGlossaryApplied) {
      baseText = originalSourceText;
    } else {
      setOriginalSourceText(sourceText);
    }

    setIsApplyingGlossaryToSource(true);
    setApplyGlossarySourceCount(null);

    setTimeout(() => {
      const sortedGlossary = [...activeProject.glossary].sort(
        (a, b) => b.chinese.length - a.chinese.length
      );

      const glossaryMap = new Map<string, string>();
      const terms: string[] = [];

      sortedGlossary.forEach((item) => {
        if (item.chinese && item.vietnamese) {
          const cleanChinese = item.chinese.trim();
          glossaryMap.set(cleanChinese, item.vietnamese.trim());
          terms.push(cleanChinese);
        }
      });

      let result = baseText;
      let replacedCount = 0;

      if (terms.length > 0) {
        const escapedTerms = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = new RegExp(escapedTerms.join('|'), 'g');
        const matchedTerms = new Set<string>();

        result = baseText.replace(pattern, (match) => {
          matchedTerms.add(match);
          return glossaryMap.get(match) || match;
        });

        replacedCount = matchedTerms.size;
      }

      setSourceText(result);
      setApplyGlossarySourceCount(replacedCount);
      setIsApplyingGlossaryToSource(false);
      setIsGlossaryApplied(true);
    }, 300);
  };

  const handleCopyText = useCallback((text: string, type: 'raw' | 'polished') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } else {
      setCopiedPolished(true);
      setTimeout(() => setCopiedPolished(false), 2000);
    }
  }, []);

  const toggleCheck = useCallback((idx: number) => {
    setSelectedSuggestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, []);
  const handleLoadChapterById = useCallback(async (id: string) => {
    const selectedChapMeta = activeProject.chapters.find(c => c.id === id);
    if (selectedChapMeta) {
      const selectedChap = await getChapterFromDB(id);
      if (selectedChap) {
        setCurrentChapterId(id);
        setChapterTitle(selectedChap.title);
        setSourceText(selectedChap.sourceText);
        setOriginalSourceText(selectedChap.sourceText);
        setIsGlossaryApplied(false);
        setRawTranslation(selectedChap.rawTranslation || '');
        setPolishedTranslation(selectedChap.polishedTranslation || '');
        setSuggestions([]);
        setSelectedSuggestions({});
        setErrorMessage(null);
        setAutoDiscoveredTerms([]);
      }
    }
  }, [activeProject]);

  const visibleGlossary = useMemo(() => {
    let list = activeProject.glossary;
    if (onlyShowMatching && deferredSourceText.trim()) {
      list = list.filter(item =>
        item.chinese && deferredSourceText.includes(item.chinese)
      );
    }
    if (glossarySearch.trim()) {
      const q = glossarySearch.toLowerCase();
      list = list.filter(item =>
        item.chinese.toLowerCase().includes(q) ||
        item.vietnamese.toLowerCase().includes(q) ||
        (item.pinyin && item.pinyin.toLowerCase().includes(q))
      );
    }
    return list.slice(0, GLOSSARY_LIMITS.WORKSPACE_GLOSSARY_VISIBLE_LIMIT);
  }, [activeProject.glossary, onlyShowMatching, deferredSourceText, glossarySearch]);

  const untranslatedChapters = useMemo(() => {
    return activeProject.chapters.filter(c =>
      c.status !== 'completed'
    );
  }, [activeProject.chapters]);
  return (
    <div id="translator-workspace" className="space-y-4">
      {/* Active Project Card info */}
      <div className="bg-parchment text-text-main rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-parchment-2 shadow-xs">
        <div
          id="project-workspace-info"
          onClick={handleOpenEditModal}
          className="space-y-1 cursor-pointer group/header hover:bg-ink/30 p-2 rounded-[2px] transition-colors duration-200 flex-1"
          title="Nhấp để chỉnh sửa thông tin truyện"
        >
          <div className="flex items-center gap-2">
            <span className="bg-polish/15 text-polish text-[10px] font-bold px-2 py-0.5 rounded-[2px] border border-polish/30 uppercase tracking-wider">
              Dự án: {activeProject.title}
            </span>
            <Edit3 className="w-3 h-3 text-polish opacity-0 group-hover/header:opacity-100 transition-opacity" />
          </div>
          <h2 className="text-base font-display font-bold tracking-tight mt-1 text-text-main">
            Bàn Biên Soạn Bản Thảo Song Ngữ
          </h2>
          <p className="text-text-muted text-xs">
            Hệ thống dịch thuật song ngữ, đối soát từ điển chuẩn xác và chuốt mịn văn phong chu sa.
          </p>
        </div>

        <div
          onClick={handleOpenEditModal}
          className="flex flex-wrap items-center gap-4 bg-ink/50 border border-parchment-2 p-2.5 rounded-[2px] max-w-md cursor-pointer hover:bg-ink/80 transition-all group/meta"
          title="Nhấp để chỉnh sửa thông tin truyện"
        >
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Thể loại</span>
            <span className="font-bold text-text-main">{activeProject.genre}</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Từ điển</span>
            <span className="font-bold text-polish">{activeProject.glossary.length} từ</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Tông giọng</span>
            <span className="font-bold text-text-main line-clamp-1">{activeProject.tone}</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="flex items-center justify-center text-polish group-hover/meta:scale-110 transition-transform">
            <Edit3 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-polish/10 border border-polish/40 text-polish p-3.5 rounded-[2px] flex items-start gap-2.5 text-xs animate-slideUp">
          <AlertCircle className="w-4 h-4 text-polish mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-polish">Lưu ý hệ thống:</p>
            <p className="text-text-main mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Visual Workspace Editor */}
      <BilingualEditor
        sourceText={sourceText}
        setSourceText={setSourceText}
        originalSourceText={originalSourceText}
        setOriginalSourceText={setOriginalSourceText}
        isGlossaryApplied={isGlossaryApplied}
        setIsGlossaryApplied={setIsGlossaryApplied}
        isExtractionEnabled={isExtractionEnabled}
        setIsExtractionEnabled={setIsExtractionEnabled}
        rawTranslation={rawTranslation}
        setRawTranslation={setRawTranslation}
        polishedTranslation={polishedTranslation}
        setPolishedTranslation={setPolishedTranslation}
        additionalInstructions={additionalInstructions}
        setAdditionalInstructions={setAdditionalInstructions}
        chapterTitle={chapterTitle}
        setChapterTitle={setChapterTitle}
        untranslatedChapters={untranslatedChapters}
        handleLoadChapterById={handleLoadChapterById}
        handleLoadExample={handleLoadExample}
        handleAnalyzeGlossary={handleAnalyzeGlossary}
        isAnalyzing={isAnalyzing}
        handleTranslateRaw={handleTranslateRaw}
        isTranslating={isTranslating}
        handlePolishTranslation={handlePolishTranslation}
        isPolishing={isPolishing}
        handleSaveChapter={handleSaveChapter}
        handleApplyGlossaryToSource={handleApplyGlossaryToSource}
        copiedRaw={copiedRaw}
        copiedPolished={copiedPolished}
        handleCopyText={handleCopyText}
        activeStage={activeStage}
        setActiveStage={setActiveStage}
        autoDiscoveredTerms={autoDiscoveredTerms}
        isApplyingGlossaryToSource={isApplyingGlossaryToSource}
        applyGlossarySourceCount={applyGlossarySourceCount}
        glossaryLength={activeProject.glossary.length}
        activeProject={activeProject}
        onUpdateProject={onUpdateProject}
        apiKeys={apiKeys}
        selectedModel={selectedModel}
        warningParagraphMismatch={warningParagraphMismatch}
        enableAiQaCritique={enableAiQaCritique}
        enableSegmentTranslation={enableSegmentTranslation}
        qaIssues={qaIssues}
        isCheckingQa={isCheckingQa}
      />

      <SuggestionsDrawer
        suggestions={suggestions}
        selectedSuggestions={selectedSuggestions}
        toggleCheck={toggleCheck}
        handleImportSuggestions={handleImportSuggestions}
        setSelectedSuggestions={setSelectedSuggestions}
      />

      <GlossarySidebar
        glossaryLength={activeProject.glossary.length}
        visibleGlossary={visibleGlossary}
        onlyShowMatching={onlyShowMatching}
        setOnlyShowMatching={setOnlyShowMatching}
        glossarySearch={glossarySearch}
        setGlossarySearch={setGlossarySearch}
      />

      {/* Editing metadata modal */}
      <ProjectMetadataModal
        isOpen={isEditingMetadata}
        onClose={() => setIsEditingMetadata(false)}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editAuthor={editAuthor}
        setEditAuthor={setEditAuthor}
        editGenre={editGenre}
        setEditGenre={setEditGenre}
        editTone={editTone}
        setEditTone={setEditTone}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        handleSaveMetadata={handleSaveMetadata}
        importSection={
          <ImportChaptersModal
            importedFileName={importedFileName}
            importFileRef={importFileRef}
            handleImportRawFileChange={handleImportRawFileChange}
            importMode={importMode}
            setImportMode={setImportMode}
            importSplitMethod={importSplitMethod}
            handleToggleImportSplitMethod={handleToggleImportSplitMethod}
            isParsingImportFile={isParsingImportFile}
            parsedChaptersLength={parsedImportChapters.length}
          />
        }
      />
    </div>
  );
}
