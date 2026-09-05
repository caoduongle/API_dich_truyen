import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { GlossaryItem, GlossaryType, PendingGlossaryItem, ChapterMetadata, StoryProject } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { triggerDownload } from '../../utils/download';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { analyzeGuidelinesDirect } from '../../services/directGlossaryEngine';
import { useGlossaryDuplicates } from '../../hooks/useGlossaryDuplicates';
import { useGlossaryContextSearch } from '../../hooks/useGlossaryContextSearch';

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
  const [pageSize, setPageSize] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page number back to 1 on filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, selectedType, selectedOrigin, searchDate, pageSize]);

  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [mdFileName, setMdFileName] = useState('');
  const [isAnalyzingMd, setIsAnalyzingMd] = useState(false);
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

  const handleAddFormSave = useCallback((fields: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string }, force?: boolean) => {
    onAddGlossaryItem({
      chinese:    fields.chinese.trim(),
      pinyin:     fields.pinyin.trim() || fields.vietnamese.trim(),
      vietnamese: fields.vietnamese.trim(),
      type:       fields.type,
      note:       fields.note.trim(),
      origin:     'manual',
      createdAt:  new Date().toISOString()
    }, force);
    setIsAdding(false);
  }, [onAddGlossaryItem]);

  const handleMdImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMdFileName(file.name);
    setIsAnalyzingMd(true);

    try {
      const mdText = await file.text();
      const data = await analyzeGuidelinesDirect({ text: mdText, apiKeys: apiKeys, model: selectedModel });
      if (data.truncated) {
        showToast({
          message: `Lưu ý: Chỉ ${data.analyzedLength!.toLocaleString()} / ${data.originalLength!.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích để tối ưu hiệu suất.`,
          type: 'warning'
        });
      }
      const extractedList: Omit<GlossaryItem, 'id'>[] = data.extractedGlossary || [];
      if (extractedList.length === 0) {
        showToast({ message: "Không tìm thấy thuật ngữ nào có thể trích xuất từ tệp chỉ dẫn này.", type: 'warning' });
        return;
      }

      const cleanItemsToAdd: Omit<GlossaryItem, 'id'>[] = [];
      const duplicateReviewList: Array<GlossaryItem & { reason: string }> = [];
      const fileCh = new Map<string, Omit<GlossaryItem, 'id'>>();
      const fileVi = new Map<string, Omit<GlossaryItem, 'id'>>();

      extractedList.forEach((item, idx) => {
        if (!item.chinese || !item.vietnamese) return;

        const cleanChKey = item.chinese.replace(/\s+/g, '').trim().toLowerCase();
        const cleanViKey = item.vietnamese.trim().toLowerCase();

        let hasConflict = false;
        let reason = '';

        const systemCnMatch = glossary.find(g => isHanEquivalent(g.chinese, item.chinese));
        const systemViMatch = glossary.find(g => g.vietnamese.trim().toLowerCase() === cleanViKey);
        const fileChMatch = Array.from(fileCh.values()).find(fItem => isHanEquivalent(fItem.chinese, item.chinese));

        if (systemCnMatch) {
          hasConflict = true;
          reason = `Trùng từ điển: Chữ gốc '${item.chinese}' đã có bản dịch là '${systemCnMatch.vietnamese}'.`;
        } else if (systemViMatch) {
          hasConflict = true;
          reason = `Trùng định nghĩa: Nghĩa Việt '${item.vietnamese}' đã được gán cho từ gốc '${systemViMatch.chinese}'.`;
        } else if (fileChMatch) {
          hasConflict = true;
          reason = `Lặp nội bộ tệp: Chữ Trung '${item.chinese}' xuất hiện nhiều lần trong file .MD.`;
        } else if (fileVi.has(cleanViKey)) {
          hasConflict = true;
          reason = `Trùng nội bộ tệp: Nghĩa tiếng Việt '${item.vietnamese}' bị gán trùng lặp trong file .MD.`;
        }

        if (hasConflict) {
          duplicateReviewList.push({
            id: 'glo_md_review_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
            chinese: item.chinese.trim(),
            pinyin: item.pinyin?.trim() || item.vietnamese.trim(),
            vietnamese: item.vietnamese.trim(),
            type: item.type || 'character',
            note: item.note?.trim() || '',
            reason: reason,
            createdAt: new Date().toISOString()
          });
        } else {
          fileCh.set(cleanChKey, item);
          fileVi.set(cleanViKey, item);
          cleanItemsToAdd.push({ ...item, origin: 'guideline', createdAt: new Date().toISOString() });
        }
      });

      let directsSavedCount = cleanItemsToAdd.length;
      if (onAddGlossaryItems && cleanItemsToAdd.length > 0) {
        onAddGlossaryItems(cleanItemsToAdd);
      } else {
        cleanItemsToAdd.forEach((item) => onAddGlossaryItem(item));
      }

      if (duplicateReviewList.length > 0) {
        setReviewQueue(prev => [...prev, ...duplicateReviewList]);
        showToast({
          message: `Phân tích xong! Thêm thành công ${directsSavedCount} từ. Phát hiện ${duplicateReviewList.length} từ trùng lặp đã chuyển vào mục 'Rà soát trùng lặp'.`,
          type: 'info'
        });
      } else {
        showToast({ message: `Thành công mỹ mãn! Đã tải toàn bộ ${directsSavedCount} từ mượt mà từ tệp .MD vào từ điển.`, type: 'success' });
      }

      setIsImporting(false);
      setMdFileName('');

    } catch (err: any) {
      console.error(err);
      showToast({ message: "Đã xảy ra lỗi khi phân tích: " + err.message, type: 'error' });
    } finally {
      setIsAnalyzingMd(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

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

  const exportGlossaryToMd = useCallback(() => {
    if (glossary.length === 0) {
      showToast({ message: 'Từ điển đang trống, không có gì để xuất!', type: 'warning' });
      return;
    }

    const typeOrder: GlossaryType[] = ['character', 'location', 'term', 'phrase', 'other'];
    const typeLabel: Record<GlossaryType, string> = {
      character: 'Nhân vật', location: 'Địa danh', term: 'Bí kíp / Vật phẩm',
      phrase: 'Thành ngữ / Cụm từ', other: 'Thuật ngữ khác',
    };
    const grouped: Record<string, GlossaryItem[]> = {};
    typeOrder.forEach((t) => { grouped[t] = []; });
    glossary.forEach((item) => {
      if (grouped[item.type]) grouped[item.type].push(item);
      else grouped['other'].push(item);
    });
    const now = new Date().toLocaleString('vi-VN');
    const lines: string[] = [];

    lines.push(`# Từ Điển Dự Án`);
    lines.push('');
    lines.push(`> Xuất tự động lúc: **${now}** `);
    lines.push(`> Tổng số thuật ngữ: **${glossary.length}**`);
    lines.push('');
    lines.push('---');
    lines.push('');
    typeOrder.forEach((type) => {
      const items = grouped[type];
      if (items.length === 0) return;

      lines.push(`## ${typeLabel[type]} (${items.length})`);
      lines.push('');
      lines.push('| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú |');
      lines.push('|-------------|----------|------------|---------|');

      items.forEach((item) => {
        const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        lines.push(`| ${esc(item.chinese)} | ${esc(item.pinyin)} | ${esc(item.vietnamese)} | ${esc(item.note)} |`);
      });
      lines.push('');
    });

    const mdContent = lines.join('\n');
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `tu-dien-du-an-${Date.now()}.md`);
    URL.revokeObjectURL(url);
  }, [glossary, showToast]);

  const startEdit = useCallback((item: GlossaryItem) => {
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => { setEditingId(null); }, []);

  const saveEdit = useCallback((id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => {
    const currentItem = glossary.find(g => g.id === id);
    const updated: GlossaryItem = {
      id, chinese, pinyin, vietnamese, type, note,
      origin: currentItem?.origin,
      createdAt: currentItem?.createdAt
    };
    onUpdateGlossaryItem(id, updated);
    setEditingId(null);
    setSelectedItem(prev => (prev?.id === id ? updated : prev));
  }, [glossary, onUpdateGlossaryItem]);

  const filteredGlossary = useMemo(() => {
    return glossary.filter((item) => {
      const matchesSearch =
          item.chinese.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          item.pinyin.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          item.vietnamese.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          item.note.toLowerCase().includes(deferredSearchTerm.toLowerCase());
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
  }, [glossary, deferredSearchTerm, selectedType, selectedOrigin, searchDate]);

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
    isImporting,
    setIsImporting,
    mdFileName,
    isAnalyzingMd,
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
    handleMdImportFileChange,
    handleAcceptReviewItem,
    handleDiscardReviewItem,
    handleUpdateReviewItem,
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
  };
}
