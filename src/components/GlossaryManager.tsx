import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { Search, Filter, Calendar } from 'lucide-react';
import { GlossaryItem, GlossaryType, PendingGlossaryItem, ChapterMetadata, StoryProject } from '../types';
import { useNotifications } from './NotificationSystem';
import { triggerDownload } from '../utils/download';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { apiFetch } from '../utils/apiClient';
import { useGlossaryDuplicates, computeDuplicateGroups, computeMergeHanGroups } from '../hooks/useGlossaryDuplicates';
import { useGlossaryContextSearch } from '../hooks/useGlossaryContextSearch';

// Re-export duplicate helper functions for backward compatibility
export { computeDuplicateGroups, computeMergeHanGroups };

// Sub-components
import { GlossaryHeader } from './glossary-manager/GlossaryHeader';
import { AddGlossaryForm } from './glossary-manager/AddGlossaryForm';
import { ImportGuidelinesModal } from './glossary-manager/ImportGuidelinesModal';
import { ReviewQueuePanel } from './glossary-manager/ReviewQueuePanel';
import { DuplicatePanel } from './glossary-manager/DuplicatePanel';
import { GlossaryTable } from './glossary-manager/GlossaryTable';
import { GlossaryDetailSidebar } from './glossary-manager/GlossaryDetailSidebar';
import { MergeHanPanel } from './glossary-manager/MergeHanPanel';
import { Badge } from './ui/Badge';

interface GlossaryManagerProps {
  projectId: string;
  glossary: GlossaryItem[];
  pendingGlossary: PendingGlossaryItem[];
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

function GlossaryManager({
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
}: GlossaryManagerProps) {
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
      const response = await apiFetch('/api/analyze-guidelines', {
        method: 'POST',
        body: JSON.stringify({ text: mdText, apiKeys: apiKeys, model: selectedModel })
      });
      if (!response.ok) throw new Error("Lỗi phản hồi phân tích cẩm nang từ server.");

      const data = await response.json();
      if (data.truncated) {
        showToast({
          message: `Lưu ý: Chỉ ${data.analyzedLength.toLocaleString()} / ${data.originalLength.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích để tối ưu hiệu suất.`,
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

    lines.push(`# 📖 Từ Điển Dự Án`);
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

  const getOriginBadge = useCallback((origin?: string) => {
    switch (origin) {
      case 'guideline': return <Badge tone="polish">Cẩm nang</Badge>;
      case 'scanned':  return <Badge tone="warning">AI Quét</Badge>;
      default:         return <Badge tone="neutral">Thủ công</Badge>;
    }
  }, []);

  const getBadgeColor = useCallback((type: GlossaryType) => {
    switch (type) {
      case 'character': return 'bg-polish/15 text-polish border-polish/30';
      case 'location':  return 'bg-draft/20 text-draft border-draft/30';
      case 'term':      return 'bg-amber-950/30 text-amber-400 border-amber-900/40';
      case 'phrase':    return 'bg-amber-950/20 text-amber-300 border-amber-800/30';
      default:          return 'bg-ink text-text-muted border-parchment-2';
    }
  }, []);

  const getTypeName = useCallback((type: GlossaryType) => {
    switch (type) {
      case 'character': return 'Nhân vật';
      case 'location':  return 'Địa danh';
      case 'term':      return 'Bí kíp/Vật phẩm';
      case 'phrase':    return 'Thành ngữ';
      default:          return 'Khác';
    }
  }, []);

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
          <>
            {parts.map((part, i) => (
                part.toLowerCase() === word.toLowerCase() ? (
                    <mark key={i} className="bg-amber-500/20 text-amber-300 font-extrabold px-1 rounded shadow-3xs border border-amber-500/35">
                      {part}
                    </mark>
                ) : (
                    part
                )
            ))}
          </>
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

  return (
    <div id="glossary-manager-root" className="space-y-4 animate-fadeIn">
      <GlossaryHeader
        exportGlossaryToMd={exportGlossaryToMd}
        glossaryLength={glossary.length}
        showDuplicatePanel={showDuplicatePanel}
        duplicateGroupsLength={duplicateGroups.length}
        handleOpenDuplicatePanel={handleOpenDuplicatePanel}
        showMergeHanPanel={showMergeHanPanel}
        mergeGroupsLength={mergeHanGroups.length}
        handleOpenMergeHanPanel={handleOpenMergeHanPanel}
        isImporting={isImporting}
        setIsImporting={setIsImporting}
        isAdding={isAdding}
        setIsAdding={setIsAdding}
      />

      <ImportGuidelinesModal
        isImporting={isImporting}
        setIsImporting={setIsImporting}
        mdFileName={mdFileName}
        isAnalyzingMd={isAnalyzingMd}
        mdInputRef={mdInputRef}
        handleMdImportFileChange={handleMdImportFileChange}
      />

      {isAdding && (
        <AddGlossaryForm
          glossary={glossary}
          onSave={handleAddFormSave}
          onCancel={() => setIsAdding(false)}
          onSelectExistingItem={(item) => {
            handleSelectItem(item);
            setIsAdding(false);
          }}
        />
      )}

      <ReviewQueuePanel
        reviewQueue={reviewQueue}
        setReviewQueue={setReviewQueue}
        handleAcceptReviewItem={handleAcceptReviewItem}
        handleDiscardReviewItem={handleDiscardReviewItem}
        handleUpdateReviewItem={handleUpdateReviewItem}
      />

      <DuplicatePanel
        showDuplicatePanel={showDuplicatePanel}
        setShowDuplicatePanel={setShowDuplicatePanel}
        duplicateGroups={duplicateGroups}
        setDuplicateGroups={setDuplicateGroups}
        handleUpdateDupItem={handleUpdateDupItem}
        handleConfirmDupGroup={handleConfirmDupGroup}
        handleIgnoreDupGroup={handleIgnoreDupGroup}
        handleDeleteDupItem={handleDeleteDupItem}
        findLiveContext={findLiveContext}
        getOriginBadge={getOriginBadge}
      />

      <MergeHanPanel
        show={showMergeHanPanel}
        setShow={setShowMergeHanPanel}
        groups={mergeHanGroups}
        setGroups={setMergeHanGroups}
        onConfirmMerge={handleConfirmMergeHan}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selectedItem ? "lg:col-span-7 space-y-3" : "lg:col-span-12 space-y-3"}>
          {/* Thanh tìm kiếm và bộ lọc */}
          <div className="bg-parchment border border-parchment-2 p-3 rounded-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tra cứu chữ Hán, Pinyin, nghĩa Việt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-ink border border-parchment-2 rounded-[2px] pl-8 pr-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-polish placeholder:text-text-muted transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
                >
                  <option value="all" className="bg-parchment text-text-main">Mọi phân loại</option>
                  <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
                  <option value="location" className="bg-parchment text-text-main">Địa danh</option>
                  <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
                  <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
                  <option value="other" className="bg-parchment text-text-main">Khác</option>
                </select>
              </div>

              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
              >
                <option value="all" className="bg-parchment text-text-main">Mọi nguồn gốc</option>
                <option value="manual" className="bg-parchment text-text-main">Thủ công</option>
                <option value="guideline" className="bg-parchment text-text-main">Cẩm nang (.md)</option>
                <option value="scanned" className="bg-parchment text-text-main">AI Quét</option>
              </select>

              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1 focus:outline-none focus:border-polish cursor-pointer"
                  title="Lọc theo ngày thêm từ"
                />
                {searchDate && (
                  <button
                    onClick={() => setSearchDate('')}
                    className="text-text-muted hover:text-text-main text-[10px] underline cursor-pointer"
                  >
                    Xóa ngày
                  </button>
                )}
              </div>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
              >
                <option value={20} className="bg-parchment text-text-main">20 / trang</option>
                <option value={50} className="bg-parchment text-text-main">50 / trang</option>
                <option value={100} className="bg-parchment text-text-main">100 / trang</option>
                <option value="all" className="bg-parchment text-text-main">Tất cả (Cuộn)</option>
              </select>
            </div>
          </div>

          <GlossaryTable
            filteredGlossary={filteredGlossary}
            selectedItem={selectedItem}
            handleSelectItem={handleSelectItem}
            editingId={editingId}
            startEdit={startEdit}
            cancelEdit={cancelEdit}
            saveEdit={saveEdit}
            onDeleteGlossaryItem={onDeleteGlossaryItem}
            getOriginBadge={getOriginBadge}
            getBadgeColor={getBadgeColor}
            getTypeName={getTypeName}
            pageSize={pageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </div>

        {selectedItem && (
          <GlossaryDetailSidebar
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            handleDetailSave={handleDetailSave}
            searchContextMatches={searchContextMatches}
            contextFilterType={contextFilterType}
            setContextFilterType={setContextFilterType}
            filteredMatches={filteredMatches}
            highlightWordInText={highlightWordInText}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(GlossaryManager);
