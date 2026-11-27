import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { CharacterGender, CharacterProfile, GlossaryItem, GlossaryType, PendingGlossaryItem, ChapterMetadata, StoryProject } from '../types';
import { computeGlossaryHealth, GlossaryHealthFilter, normalizeCharacterProfile } from '../lib/glossaryMatch';
import { useNotifications } from '../context/NotificationContext';
import { triggerDownload } from '../utils/download';
import { analyzeGuidelinesDirect } from '../services/directGlossaryEngine';
import {
  analyzeGlossaryImportConflicts,
  DuplicateResolutionStrategy,
  GlossaryExportOptions,
  GlossaryImportMode,
  GlossaryImportPreview,
  MAX_GLOSSARY_IMPORT_FILE_BYTES,
  parseStructuredGlossaryFile,
  prepareFileDeduplicatedItems,
  serializeGlossary,
} from '../services/glossaryIO';
import { useGlossaryDuplicates } from './useGlossaryDuplicates';
import { useGlossaryContextSearch } from './useGlossaryContextSearch';

export interface UseGlossaryStateProps {
  projectId: string;
  glossary: GlossaryItem[];
  pendingGlossary?: PendingGlossaryItem[];
  chapters?: ChapterMetadata[];
  apiKeys?: string[];
  selectedModel?: string;
  onAddGlossaryItem: (item: Omit<GlossaryItem, 'id'>, force?: boolean) => void;
  onAddGlossaryItems?: (items: Omit<GlossaryItem, 'id'>[]) => void;
  onUpdateGlossaryItem: (id: string, item: GlossaryItem) => void;
  onDeleteGlossaryItem: (id: string) => void;
  onMergeGlossaryItems?: (primaryId: string, mergedPayload: Partial<GlossaryItem>, idsToDelete: string[]) => void;
  onAddToPending?: (item: PendingGlossaryItem) => void;
  onConfirmPending?: (pendingId: string, override?: Partial<GlossaryItem>) => void;
  onDiscardPending?: (pendingId: string) => void;
  activeProject?: StoryProject;
  onUpdateProject?: (updated: StoryProject) => void;
}

export function useGlossaryState({
  projectId,
  glossary,
  pendingGlossary = [],
  chapters = [],
  apiKeys = [],
  selectedModel = 'gemini-2.5-flash',
  onAddGlossaryItem,
  onAddGlossaryItems,
  onUpdateGlossaryItem,
  onDeleteGlossaryItem,
  onMergeGlossaryItems,
  onConfirmPending,
  onDiscardPending,
  activeProject,
  onUpdateProject,
}: UseGlossaryStateProps) {
  const { showToast } = useNotifications();

  // Custom Hooks
  const {
    fullChapters,
    searchContextMatches,
    setSearchContextMatches,
    contextFilterType,
    setContextFilterType,
    findLiveContext,
    scanOccurrences,
  } = useGlossaryContextSearch(projectId, chapters, glossary);

  const {
    showDuplicatePanel,
    setShowDuplicatePanel,
    duplicateGroups,
    setDuplicateGroups,
    showMergeHanPanel,
    setShowMergeHanPanel,
    mergeHanGroups,
    setMergeHanGroups,
    handleOpenDuplicatePanel,
    handleOpenMergeHanPanel,
    handleConfirmMergeHan,
    handleUpdateDupItem,
    handleConfirmDupGroup,
    handleIgnoreDupGroup,
    handleDeleteDupItem,
  } = useGlossaryDuplicates({
    projectId,
    glossary,
    activeProject,
    onUpdateProject,
    onUpdateGlossaryItem,
    onDeleteGlossaryItem,
    onMergeGlossaryItems,
  });

  // Migrate legacy ignored dups if needed
  useEffect(() => {
    if (!activeProject || !onUpdateProject) return;

    if (activeProject.ignoredDuplicatePairs === undefined) {
      const ignoreKey = `ignored_dups_${projectId}`;
      const localData = localStorage.getItem(ignoreKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            onUpdateProject({
              ...activeProject,
              ignoredDuplicatePairs: parsed
            });
          }
        } catch (e) {
          console.error('Error migrating ignored duplicate pairs:', e);
        }
        localStorage.removeItem(ignoreKey);
      } else {
        onUpdateProject({
          ...activeProject,
          ignoredDuplicatePairs: []
        });
      }
    }
  }, [projectId, activeProject, onUpdateProject]);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [searchDate, setSearchDate] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<GlossaryHealthFilter>('all');
  const [pageSize, setPageSize] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const healthReport = useMemo(() => computeGlossaryHealth(glossary), [glossary]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Tự động dọn danh sách chọn nếu có mục đã bị xóa hoặc từ điển thay đổi
  useEffect(() => {
    const validIds = new Set(glossary.map((g) => g.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [glossary]);

  // Reset page number back to 1 on filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, selectedType, selectedOrigin, searchDate, healthFilter, pageSize]);

  const [isAdding, setIsAdding] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [mdFileName, setMdFileName] = useState('');
  const [isAnalyzingMd, setIsAnalyzingMd] = useState(false);
  const [importPreview, setImportPreview] = useState<GlossaryImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GlossaryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const [reviewQueue, setReviewQueue] = useState<Array<GlossaryItem & { reason: string }>>([]);

  // Load pending glossary items that need review into the reviewQueue state
  useEffect(() => {
    if (pendingGlossary && pendingGlossary.length > 0) {
      const needsReviewItems = pendingGlossary
        .filter(item => item.needsReview === true)
        .map(item => ({
          id: item.id,
          chinese: item.chinese,
          pinyin: item.pinyin,
          vietnamese: item.vietnamese,
          type: item.type,
          note: item.note,
          reason: item.reason || 'AI trích xuất nghi ngờ hallucinate',
          needsReview: true,
          createdAt: item.importedAt
        }));

      setReviewQueue(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newItems = needsReviewItems.filter(item => !existingIds.has(item.id));
        if (newItems.length > 0) {
          return [...prev, ...newItems];
        }
        return prev;
      });
    }
  }, [pendingGlossary]);

  const handleSelectItem = useCallback((item: GlossaryItem) => {
    setSelectedItem(item);
  }, []);

  const handleDetailSave = useCallback((updated: GlossaryItem) => {
    onUpdateGlossaryItem(updated.id, updated);
    setSelectedItem(updated);
  }, [onUpdateGlossaryItem]);

  useEffect(() => {
    if (!selectedItem) {
      setSearchContextMatches([]);
      return;
    }
    const latestItem = glossary.find(g => g.id === selectedItem.id);
    if (latestItem) {
      scanOccurrences(latestItem);
    } else {
      setSelectedItem(null);
    }
  }, [selectedItem, fullChapters, glossary, scanOccurrences, setSearchContextMatches]);

  const handleAddFormSave = useCallback((fields: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string; isPinned?: boolean; characterProfile?: CharacterProfile }, force?: boolean) => {
    const normalizedProfile = fields.type === 'character' ? normalizeCharacterProfile(fields.characterProfile) : undefined;
    onAddGlossaryItem({
      chinese:    fields.chinese.trim(),
      pinyin:     fields.pinyin.trim() || fields.vietnamese.trim(),
      vietnamese: fields.vietnamese.trim(),
      type:       fields.type,
      note:       fields.note.trim(),
      ...(fields.isPinned ? { isPinned: true } : {}),
      ...(normalizedProfile ? { characterProfile: normalizedProfile } : {}),
      origin:     'manual',
      createdAt:  new Date().toISOString()
    }, force);
    setIsAdding(false);
  }, [onAddGlossaryItem]);

  const resetImportPreview = useCallback(() => {
    setImportPreview(null);
    setImportError(null);
    setMdFileName('');
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    if (!file || isAnalyzingMd) return;

    setImportError(null);
    setImportPreview(null);

    if (file.size === 0) {
      const msg = 'Tệp đang rỗng, không có dữ liệu để nhập.';
      setImportError(msg);
      showToast({ message: msg, type: 'warning' });
      return;
    }

    if (file.size > MAX_GLOSSARY_IMPORT_FILE_BYTES) {
      const msg = 'Tệp vượt quá giới hạn 10 MB. Vui lòng chia nhỏ tệp trước khi nhập.';
      setImportError(msg);
      showToast({ message: msg, type: 'error' });
      return;
    }

    setMdFileName(file.name);
    setIsAnalyzingMd(true);

    try {
      const text = await file.text();
      if (!text.trim()) {
        const msg = 'Nội dung tệp rỗng, không có thuật ngữ nào để nhập.';
        setImportError(msg);
        showToast({ message: msg, type: 'warning' });
        return;
      }

      const structured = parseStructuredGlossaryFile(text, file.name);
      if (structured) {
        if (structured.items.length === 0) {
          const msg = 'Không tìm thấy thuật ngữ hợp lệ nào trong bảng dữ liệu của tệp.';
          setImportError(msg);
          showToast({ message: msg, type: 'warning' });
          return;
        }
        const { cleanItems, conflicts } = analyzeGlossaryImportConflicts(structured.items, glossary);
        setImportPreview({
          fileName: file.name,
          mode: 'direct',
          sourceFormat: structured.sourceFormat,
          cleanItems,
          conflicts,
          allValidItems: prepareFileDeduplicatedItems(structured.items),
          skippedRows: structured.skippedRows,
          warnings: structured.warnings,
          rawTextForAiFallback: structured.sourceFormat === 'md' || structured.sourceFormat === 'txt' ? text : undefined,
        });
        return;
      }

      // Unstructured prose (.md / .txt) -> AI extraction
      const data = await analyzeGuidelinesDirect({ text, apiKeys, model: selectedModel });
      const warnings: string[] = [];
      if (data.truncated) {
        warnings.push(
          `Chỉ ${data.analyzedLength!.toLocaleString()} / ${data.originalLength!.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích bằng AI.`
        );
      }

      const extractedList: Omit<GlossaryItem, 'id'>[] = (data.extractedGlossary || []).map((item) => ({
        ...item,
        origin: 'guideline' as const,
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      if (extractedList.length === 0) {
        const msg = 'Không tìm thấy thuật ngữ nào có thể trích xuất từ tệp chỉ dẫn này.';
        setImportError(msg);
        showToast({ message: msg, type: 'warning' });
        return;
      }

      const { cleanItems, conflicts } = analyzeGlossaryImportConflicts(extractedList, glossary);
      setImportPreview({
        fileName: file.name,
        mode: 'ai',
        sourceFormat: file.name.toLowerCase().endsWith('.txt') ? 'txt' : 'md',
        cleanItems,
        conflicts,
        allValidItems: prepareFileDeduplicatedItems(extractedList),
        skippedRows: 0,
        warnings,
      });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message ? `Đã xảy ra lỗi khi đọc tệp: ${err.message}` : 'Đã xảy ra lỗi khi đọc tệp cẩm nang.';
      setImportError(msg);
      showToast({ message: msg, type: 'error' });
    } finally {
      setIsAnalyzingMd(false);
    }
  }, [isAnalyzingMd, glossary, apiKeys, selectedModel, showToast]);

  const retryImportWithAi = useCallback(async () => {
    if (!importPreview?.rawTextForAiFallback || isAnalyzingMd) return;
    setIsAnalyzingMd(true);
    setImportError(null);

    try {
      const data = await analyzeGuidelinesDirect({
        text: importPreview.rawTextForAiFallback,
        apiKeys,
        model: selectedModel,
      });
      const warnings: string[] = [];
      if (data.truncated) {
        warnings.push(
          `Chỉ ${data.analyzedLength!.toLocaleString()} / ${data.originalLength!.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích bằng AI.`
        );
      }
      const extractedList: Omit<GlossaryItem, 'id'>[] = (data.extractedGlossary || []).map((item) => ({
        ...item,
        origin: 'guideline' as const,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
      if (extractedList.length === 0) {
        showToast({ message: 'AI không trích xuất được thêm thuật ngữ nào từ tệp này.', type: 'warning' });
        return;
      }
      const { cleanItems, conflicts } = analyzeGlossaryImportConflicts(extractedList, glossary);
      setImportPreview({
        fileName: importPreview.fileName,
        mode: 'ai',
        sourceFormat: importPreview.sourceFormat,
        cleanItems,
        conflicts,
        allValidItems: prepareFileDeduplicatedItems(extractedList),
        skippedRows: 0,
        warnings,
      });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message ? `Lỗi phân tích AI: ${err.message}` : 'Lỗi phân tích AI.';
      setImportError(msg);
      showToast({ message: msg, type: 'error' });
    } finally {
      setIsAnalyzingMd(false);
    }
  }, [importPreview, isAnalyzingMd, apiKeys, selectedModel, glossary, showToast]);

  const confirmImport = useCallback((
    strategy: DuplicateResolutionStrategy,
    importMode: GlossaryImportMode = 'append'
  ) => {
    if (!importPreview) return;

    if (importMode === 'replace_all') {
      const replacementSource =
        importPreview.allValidItems && importPreview.allValidItems.length > 0
          ? importPreview.allValidItems
          : prepareFileDeduplicatedItems([
              ...importPreview.cleanItems,
              ...importPreview.conflicts.map((c) => c.item),
            ]);

      if (replacementSource.length === 0) {
        showToast({
          message: 'Tệp nhập không có thuật ngữ hợp lệ nào. Từ điển hiện tại được giữ nguyên.',
          type: 'warning',
        });
        return;
      }

      const nowBase = Date.now();
      const nextGlossary: GlossaryItem[] = replacementSource.map((item, idx) => ({
        ...item,
        id: `glo_replace_${nowBase}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        origin: item.origin || 'guideline',
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      if (activeProject && onUpdateProject) {
        // Thay thế chỉ danh sách từ điển chính; giữ nguyên pendingGlossary và reviewQueue
        onUpdateProject({ ...activeProject, glossary: nextGlossary });
      } else {
        glossary.forEach((g) => onDeleteGlossaryItem(g.id));
        if (onAddGlossaryItems) {
          onAddGlossaryItems(replacementSource);
        } else {
          replacementSource.forEach((item) => onAddGlossaryItem(item));
        }
      }

      setSelectedIds([]);
      setSelectedItem(null);
      showToast({
        message: `Đã thay thế toàn bộ từ điển bằng ${nextGlossary.length} thuật ngữ mới (hàng chờ kiểm duyệt được giữ nguyên).`,
        type: 'success',
      });
      setIsImporting(false);
      resetImportPreview();
      return;
    }

    const { cleanItems, conflicts } = importPreview;
    let addedCount = 0;
    let overwrittenCount = 0;
    let reviewCount = 0;
    let skippedConflictCount = 0;

    if (cleanItems.length > 0) {
      if (onAddGlossaryItems) {
        onAddGlossaryItems(cleanItems);
      } else {
        cleanItems.forEach((item) => onAddGlossaryItem(item));
      }
      addedCount = cleanItems.length;
    }

    if (conflicts.length > 0) {
      if (strategy === 'review') {
        const reviewItems = conflicts.map((c) => c.item);
        setReviewQueue((prev) => [...prev, ...reviewItems]);
        reviewCount = reviewItems.length;
      } else if (strategy === 'overwrite') {
        const updatesById = new Map<string, GlossaryItem>();
        conflicts.forEach((c) => {
          if (c.conflictKind === 'system_chinese' && c.existingId && c.existingItem) {
            updatesById.set(c.existingId, {
              ...c.existingItem,
              pinyin: c.item.pinyin,
              vietnamese: c.item.vietnamese,
              type: c.item.type,
              note: c.item.note,
              ...(c.item.variants && c.item.variants.length > 0 ? { variants: c.item.variants } : {}),
              ...(c.item.characterProfile ? { characterProfile: c.item.characterProfile } : {}),
              createdAt: c.item.createdAt || c.existingItem.createdAt,
            });
          } else {
            skippedConflictCount++;
          }
        });

        overwrittenCount = updatesById.size;
        if (overwrittenCount > 0) {
          if (activeProject && onUpdateProject) {
            const nextGlossary = activeProject.glossary.map((g) => updatesById.get(g.id) ?? g);
            onUpdateProject({ ...activeProject, glossary: nextGlossary });
          } else {
            updatesById.forEach((updated, id) => onUpdateGlossaryItem(id, updated));
          }
        }
      } else {
        skippedConflictCount = conflicts.length;
      }
    }

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`thêm mới ${addedCount} từ`);
    if (overwrittenCount > 0) parts.push(`cập nhật ${overwrittenCount} từ trùng`);
    if (reviewCount > 0) parts.push(`chuyển ${reviewCount} từ vào mục 'Rà soát trùng lặp'`);
    if (skippedConflictCount > 0) parts.push(`bỏ qua ${skippedConflictCount} từ trùng/lặp`);

    showToast({
      message: parts.length > 0
        ? `Hoàn tất nhập từ điển: ${parts.join(', ')}.`
        : 'Không có thuật ngữ nào được thay đổi.',
      type: reviewCount > 0 ? 'info' : 'success',
    });

    setIsImporting(false);
    resetImportPreview();
  }, [importPreview, glossary, onAddGlossaryItems, onAddGlossaryItem, onDeleteGlossaryItem, activeProject, onUpdateProject, onUpdateGlossaryItem, showToast, resetImportPreview]);

  const handleMdImportFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImportFile(file);
    if (e.target) {
      e.target.value = '';
    }
  }, [handleImportFile]);

  const handleAcceptReviewItem = useCallback((reviewId: string) => {
    const item = reviewQueue.find(r => r.id === reviewId);
    if (!item) return;
    if (!item.chinese.trim() || !item.vietnamese.trim()) {
      showToast({ message: "Vui lòng không để trống từ gốc hoặc nghĩa tiếng Việt.", type: 'warning' });
      return;
    }

    const isFromPending = pendingGlossary.some(p => p.id === reviewId);
    if (isFromPending) {
      if (onConfirmPending) {
        onConfirmPending(reviewId, {
          chinese: item.chinese.trim(),
          pinyin: item.pinyin.trim() || item.vietnamese.trim(),
          vietnamese: item.vietnamese.trim(),
          type: item.type,
          note: item.note.trim()
        });
      }
    } else {
      onAddGlossaryItem({
        chinese: item.chinese.trim(),
        pinyin: item.pinyin.trim() || item.vietnamese.trim(),
        vietnamese: item.vietnamese.trim(),
        type: item.type,
        note: item.note.trim(),
        origin: 'guideline',
        createdAt: item.createdAt || new Date().toISOString()
      });
    }
    setReviewQueue(prev => prev.filter(r => r.id !== reviewId));
  }, [reviewQueue, onAddGlossaryItem, pendingGlossary, onConfirmPending, showToast]);

  const handleDiscardReviewItem = useCallback((reviewId: string) => {
    const isFromPending = pendingGlossary.some(p => p.id === reviewId);
    if (isFromPending) {
      if (onDiscardPending) {
        onDiscardPending(reviewId);
      }
    }
    setReviewQueue(prev => prev.filter(r => r.id !== reviewId));
  }, [pendingGlossary, onDiscardPending]);

  const handleUpdateReviewItem = useCallback((reviewId: string, updatedFields: Partial<GlossaryItem>) => {
    setReviewQueue(prev => prev.map(r => {
      if (r.id === reviewId) {
        return { ...r, ...updatedFields };
      }
      return r;
    }));
  }, []);

  const startEdit = useCallback((item: GlossaryItem) => {
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => { setEditingId(null); }, []);

  const saveEdit = useCallback((id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => {
    const currentItem = glossary.find(g => g.id === id);
    const updated: GlossaryItem = {
      ...(currentItem || {}),
      id,
      chinese,
      pinyin,
      vietnamese,
      type,
      note,
      origin: currentItem?.origin,
      createdAt: currentItem?.createdAt,
    };
    onUpdateGlossaryItem(id, updated);
    setEditingId(null);
    setSelectedItem(prev => (prev?.id === id ? updated : prev));
  }, [glossary, onUpdateGlossaryItem]);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedOrigin('all');
    setSearchDate('');
    setHealthFilter('all');
  }, []);

  const healthFilterIdSet = useMemo(() => {
    if (healthFilter === 'conflicts') return new Set(healthReport.conflictItemIds);
    if (healthFilter === 'missing_profile') return new Set(healthReport.missingProfileCharIds);
    if (healthFilter === 'incomplete') return new Set(healthReport.incompleteViIds);
    return null;
  }, [healthFilter, healthReport]);

  const filteredGlossary = useMemo(() => {
    const query = deferredSearchTerm.toLowerCase();
    return glossary.filter((item) => {
      if (healthFilterIdSet && !healthFilterIdSet.has(item.id)) {
        return false;
      }
      const matchesSearch =
        !query ||
        item.chinese.toLowerCase().includes(query) ||
        item.pinyin.toLowerCase().includes(query) ||
        item.vietnamese.toLowerCase().includes(query) ||
        item.note.toLowerCase().includes(query) ||
        (Array.isArray(item.variants) && item.variants.some((v) => v.toLowerCase().includes(query)));
      const matchesType = selectedType === 'all' ? true : item.type === selectedType;
      const matchesOrigin = selectedOrigin === 'all' ? true : (item.origin === selectedOrigin);
      let matchesDate = true;
      if (searchDate) {
        if (item.createdAt) {
          const localDate = new Date(item.createdAt);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const day = String(localDate.getDate()).padStart(2, '0');
          const localDateStr = `${year}-${month}-${day}`;
          matchesDate = localDateStr === searchDate;
        } else {
          matchesDate = false;
        }
      }
      return matchesSearch && matchesType && matchesOrigin && matchesDate;
    });
  }, [glossary, healthFilterIdSet, deferredSearchTerm, selectedType, selectedOrigin, searchDate]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const toggleSelectPage = useCallback((pageItems: GlossaryItem[]) => {
    if (!pageItems || pageItems.length === 0) return;
    const pageIds = pageItems.map((item) => item.id);
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelectedOnPage = pageIds.every((id) => prevSet.has(id));
      if (allSelectedOnPage) {
        const pageSet = new Set(pageIds);
        return prev.filter((id) => !pageSet.has(id));
      }
      const next = [...prev];
      pageIds.forEach((id) => {
        if (!prevSet.has(id)) next.push(id);
      });
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(filteredGlossary.map((g) => g.id));
  }, [filteredGlossary]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const bulkDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const targetIds = new Set(selectedIds);
    if (activeProject && onUpdateProject) {
      onUpdateProject({
        ...activeProject,
        glossary: glossary.filter((g) => !targetIds.has(g.id)),
      });
    } else {
      targetIds.forEach((id) => onDeleteGlossaryItem(id));
    }
    setSelectedIds([]);
    setSelectedItem((prev) => (prev && targetIds.has(prev.id) ? null : prev));
    showToast({ message: `Đã xóa ${targetIds.size} thuật ngữ đã chọn.`, type: 'success' });
  }, [selectedIds, activeProject, onUpdateProject, glossary, onDeleteGlossaryItem, showToast]);

  const applyBulkItemUpdate = useCallback(
    (
      updater: (item: GlossaryItem) => GlossaryItem | null,
      successMessage: (updatedCount: number) => string,
      emptyMessage?: string
    ) => {
      if (selectedIds.length === 0) return;
      const targetIds = new Set(selectedIds);
      const updatedMap = new Map<string, GlossaryItem>();

      const nextGlossary = glossary.map((item) => {
        if (!targetIds.has(item.id)) return item;
        const nextItem = updater(item);
        if (!nextItem) return item;
        updatedMap.set(item.id, nextItem);
        return nextItem;
      });

      if (updatedMap.size === 0) {
        if (emptyMessage) showToast({ message: emptyMessage, type: 'warning' });
        return;
      }

      if (activeProject && onUpdateProject) {
        onUpdateProject({ ...activeProject, glossary: nextGlossary });
      } else {
        updatedMap.forEach((updatedItem, id) => onUpdateGlossaryItem(id, updatedItem));
      }

      setSelectedItem((prev) => (prev && updatedMap.has(prev.id) ? updatedMap.get(prev.id)! : prev));
      showToast({ message: successMessage(updatedMap.size), type: 'success' });
    },
    [selectedIds, glossary, activeProject, onUpdateProject, onUpdateGlossaryItem, showToast]
  );

  const bulkSetPinnedSelected = useCallback(
    (isPinned: boolean) => {
      applyBulkItemUpdate(
        (item) => {
          const next = { ...item };
          if (isPinned) {
            next.isPinned = true;
          } else {
            delete next.isPinned;
          }
          return next;
        },
        (count) => (isPinned ? `Đã ghim ${count} thuật ngữ đã chọn.` : `Đã bỏ ghim ${count} thuật ngữ đã chọn.`)
      );
    },
    [applyBulkItemUpdate]
  );

  const bulkSetTypeSelected = useCallback(
    (nextType: GlossaryType) => {
      applyBulkItemUpdate(
        (item) => ({ ...item, type: nextType }),
        (count) => `Đã cập nhật phân loại cho ${count} thuật ngữ.`
      );
    },
    [applyBulkItemUpdate]
  );

  const bulkSetGenderSelected = useCallback(
    (gender: CharacterGender) => {
      applyBulkItemUpdate(
        (item) => {
          if (item.type !== 'character') return null;
          const nextProfile = normalizeCharacterProfile({
            ...(item.characterProfile || {}),
            gender,
          });
          const next = { ...item };
          if (nextProfile) {
            next.characterProfile = nextProfile;
          } else {
            delete next.characterProfile;
          }
          return next;
        },
        (count) => `Đã gán giới tính cho ${count} nhân vật trong vùng chọn.`,
        'Không có mục Nhân vật nào trong vùng chọn để gán giới tính.'
      );
    },
    [applyBulkItemUpdate]
  );

  const exportGlossary = useCallback((options: GlossaryExportOptions) => {
    const scope = options.scope || 'all';
    const targetItems = scope === 'filtered' ? filteredGlossary : glossary;
    if (targetItems.length === 0) {
      showToast({
        message: scope === 'filtered'
          ? 'Danh sách đang lọc không có thuật ngữ nào để xuất!'
          : 'Từ điển đang trống, không có gì để xuất!',
        type: 'warning',
      });
      return;
    }

    const { content, mimeType, filename } = serializeGlossary(targetItems, {
      ...options,
      projectName: options.projectName ?? activeProject?.title,
    });
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    URL.revokeObjectURL(url);
    showToast({
      message: `Đã xuất ${targetItems.length} thuật ngữ ra tệp ${filename}.`,
      type: 'success',
    });
  }, [glossary, filteredGlossary, activeProject?.title, showToast]);

  const exportGlossaryToMd = useCallback(() => {
    exportGlossary({ format: 'md', scope: 'all', projectName: activeProject?.title });
  }, [exportGlossary, activeProject?.title]);

  const highlightWordInText = useCallback((text: string, word: string) => {
    if (!word || !text) return text;
    try {
      const parts = text.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '$&')})`, 'gi'));
      return (
        React.createElement(React.Fragment, null, parts.map((part, i) => (
          part.toLowerCase() === word.toLowerCase() ? (
            React.createElement('mark', {
              key: i,
              className: "bg-amber-500/20 text-amber-300 font-extrabold px-1 rounded shadow-3xs border border-amber-500/35"
            }, part)
          ) : (
            part
          )
        )))
      );
    } catch (e) {
      return text;
    }
  }, []);

  const filteredMatches = useMemo(() => {
    return searchContextMatches.filter(match => {
      if (contextFilterType === 'source') return match.textType === 'source';
      if (contextFilterType === 'translation') return match.textType === 'raw' || match.textType === 'polished';
      return true;
    });
  }, [searchContextMatches, contextFilterType]);

  return {
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    selectedOrigin,
    setSelectedOrigin,
    searchDate,
    setSearchDate,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    isAdding,
    setIsAdding,
    isExportModalOpen,
    setIsExportModalOpen,
    isImporting,
    setIsImporting,
    mdFileName,
    isAnalyzingMd,
    importPreview,
    importError,
    selectedItem,
    setSelectedItem,
    editingId,
    mdInputRef,
    reviewQueue,
    setReviewQueue,
    showDuplicatePanel,
    setShowDuplicatePanel,
    duplicateGroups,
    setDuplicateGroups,
    showMergeHanPanel,
    setShowMergeHanPanel,
    mergeHanGroups,
    setMergeHanGroups,
    handleOpenDuplicatePanel,
    handleOpenMergeHanPanel,
    handleConfirmMergeHan,
    handleUpdateDupItem,
    handleConfirmDupGroup,
    handleIgnoreDupGroup,
    handleDeleteDupItem,
    handleSelectItem,
    handleDetailSave,
    handleAddFormSave,
    handleImportFile,
    handleMdImportFileChange,
    confirmImport,
    retryImportWithAi,
    resetImportPreview,
    handleAcceptReviewItem,
    handleDiscardReviewItem,
    handleUpdateReviewItem,
    exportGlossary,
    exportGlossaryToMd,
    startEdit,
    cancelEdit,
    saveEdit,
    filteredGlossary,
    filteredMatches,
    highlightWordInText,
    searchContextMatches,
    contextFilterType,
    setContextFilterType,
    findLiveContext,
    healthReport,
    healthFilter,
    setHealthFilter,
    clearAllFilters,
    selectedIds,
    selectedIdSet,
    toggleSelectItem,
    toggleSelectPage,
    selectAllFiltered,
    clearSelection,
    bulkDeleteSelected,
    bulkSetPinnedSelected,
    bulkSetTypeSelected,
    bulkSetGenderSelected,
  };
}
