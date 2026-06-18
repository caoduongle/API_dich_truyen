import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue, startTransition } from 'react';
import { GlossaryItem, GlossaryType, PendingGlossaryItem, Chapter } from '../types';
import { Search, Calendar, Info } from 'lucide-react';

// Sub-components
import { GlossaryHeader } from './glossary-manager/GlossaryHeader';
import { AddGlossaryForm } from './glossary-manager/AddGlossaryForm';
import { ImportGuidelinesModal } from './glossary-manager/ImportGuidelinesModal';
import { ReviewQueuePanel } from './glossary-manager/ReviewQueuePanel';
import { DuplicatePanel, DuplicateGroupEdit } from './glossary-manager/DuplicatePanel';
import { GlossaryTable } from './glossary-manager/GlossaryTable';
import { GlossaryDetailSidebar } from './glossary-manager/GlossaryDetailSidebar';

interface GlossaryManagerProps {
  projectId: string;
  glossary: GlossaryItem[];
  pendingGlossary?: PendingGlossaryItem[];
  chapters?: Chapter[];
  apiKeys?: string[];
  selectedModel?: string;
  onAddGlossaryItem: (item: Omit<GlossaryItem, 'id'>) => void;
  onAddGlossaryItems?: (items: Omit<GlossaryItem, 'id'>[]) => void;
  onUpdateGlossaryItem: (id: string, item: GlossaryItem) => void;
  onDeleteGlossaryItem: (id: string) => void;
  onAddToPending?: (item: PendingGlossaryItem) => void;
  onConfirmPending?: (pendingId: string, override?: Partial<GlossaryItem>) => void;
  onDiscardPending?: (pendingId: string) => void;
}

function computeDuplicateGroups(glossary: GlossaryItem[], projectId: string = ''): DuplicateGroupEdit[] {
  const n = glossary.length;
  if (n < 2) return [];

  const ignoreKey = `ignored_dups_${projectId}`;
  const ignoredPairs = new Set<string>(JSON.parse(localStorage.getItem(ignoreKey) || '[]'));

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  const cleanCh = glossary.map(item => item.chinese.replace(/\s+/g, '').trim().toLowerCase());
  const cleanVi = glossary.map(item => item.vietnamese.replace(/\s+/g, '').trim().toLowerCase());

  function buildBuckets(keys: string[]): Map<string, number[]> {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = keys[i];
      if (!key) continue;
      const arr = buckets.get(key);
      if (arr) arr.push(i); else buckets.set(key, [i]);
    }
    return buckets;
  }

  const chBuckets = buildBuckets(cleanCh);
  const viBuckets = buildBuckets(cleanVi);

  function unionBuckets(buckets: Map<string, number[]>) {
    buckets.forEach((indices) => {
      if (indices.length < 2) return;
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const i = indices[a], j = indices[b];
          const idI = glossary[i].id, idJ = glossary[j].id;
          if (ignoredPairs.has(`${idI}-${idJ}`) || ignoredPairs.has(`${idJ}-${idI}`)) continue;
          union(i, j);
        }
      }
    });
  }

  unionBuckets(chBuckets);
  unionBuckets(viBuckets);

  const inChDup = new Set<number>();
  chBuckets.forEach((indices) => { if (indices.length > 1) indices.forEach(i => inChDup.add(i)); });
  const inViDup = new Set<number>();
  viBuckets.forEach((indices) => { if (indices.length > 1) indices.forEach(i => inViDup.add(i)); });

  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(i);
  }

  const result: DuplicateGroupEdit[] = [];
  groupMap.forEach((indices, root) => {
    if (indices.length < 2) return;
    const items = indices.map(idx => ({ ...glossary[idx] }));
    const hasSameCh = indices.some(i => inChDup.has(i));
    const hasSameVi = indices.some(i => inViDup.has(i));
    const reason = hasSameCh && hasSameVi ? 'Trùng cả tiếng Trung lẫn tiếng Việt' : hasSameCh ? 'Trùng tiếng Trung gốc' : 'Trùng bản dịch tiếng Việt';
    result.push({ groupId: `dup_${root}_${Date.now()}`, reason, items });
  });
  return result;
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
  onConfirmPending,
  onDiscardPending,
}: GlossaryManagerProps) {
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

  const [reviewQueue, setReviewQueue] = useState<Array<GlossaryItem & { reason: string }>>([]);
  const [selectedItem, setSelectedItem] = useState<GlossaryItem | null>(null);

  const [searchContextMatches, setSearchContextMatches] = useState<Array<{
    chapterId: string;
    chapterTitle: string;
    textType: 'source' | 'raw' | 'polished';
    paragraphText: string;
    paragraphIndex: number;
  }>>([]);
  const [contextFilterType, setContextFilterType] = useState<'all' | 'source' | 'translation'>('all');
  const mdInputRef = useRef<HTMLInputElement>(null);

  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroupEdit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const duplicateGroupsRef = useRef(duplicateGroups);
  useEffect(() => { duplicateGroupsRef.current = duplicateGroups; }, [duplicateGroups]);

  const handleOpenDuplicatePanel = () => {
    const projId = projectId || 'default_project';
    setShowDuplicatePanel(true);
    setDuplicateGroups([]);
    startTransition(() => {
      const groups = computeDuplicateGroups(glossary, projId);
      setDuplicateGroups(groups);
      if (groups.length === 0) {
        alert('Tuyệt vời! Không tìm thấy từ ngữ nào bị trùng lặp trong từ điển của bạn.');
        setShowDuplicatePanel(false);
      }
    });
  };

  const handleUpdateDupItem = useCallback((groupId: string, itemId: string, field: keyof GlossaryItem, value: string) => {
    setDuplicateGroups(prev => prev.map(group => {
      if (group.groupId !== groupId) return group;
      return {
        ...group,
        items: group.items.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      };
    }));
  }, []);

  const findLiveContext = useCallback((chineseTerm: string): Array<{
    chapterTitle: string;
    sourceLine: string;
    translationLine: string;
  }> => {
    const clean = chineseTerm.replace(/\s+/g, '').trim();
    const results: Array<{ chapterTitle: string; sourceLine: string; translationLine: string }> = [];

    for (const chap of chapters) {
      const srcLines = chap.sourceText.split('\n');
      const transLines = (chap.polishedTranslation || chap.rawTranslation || '').split('\n');

      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i].trim();
        if (!line) continue;
        if (line.includes(chineseTerm.trim()) || line.replace(/\s+/g, '').includes(clean)) {
          results.push({
            chapterTitle: chap.title,
            sourceLine: line,
            translationLine: transLines[i]?.trim() || ''
          });
          break;
        }
      }
    }
    return results;
  }, [chapters]);

  const handleConfirmDupGroup = useCallback((groupId: string) => {
    const group = duplicateGroupsRef.current.find(g => g.groupId === groupId);
    if (!group) return;

    group.items.forEach(editedItem => {
      const original = glossary.find(g => g.id === editedItem.id);
      if (!original) return;
      const hasChanged =
        original.chinese !== editedItem.chinese ||
        original.pinyin !== editedItem.pinyin ||
        original.vietnamese !== editedItem.vietnamese ||
        original.type !== editedItem.type ||
        original.note !== editedItem.note;
      if (hasChanged) {
        onUpdateGlossaryItem(editedItem.id, editedItem);
      }
    });

    setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, [glossary, onUpdateGlossaryItem]);

  const handleIgnoreDupGroup = useCallback((groupId: string) => {
    const group = duplicateGroupsRef.current.find(g => g.groupId === groupId);
    if (!group) return;

    const projId = projectId || 'default_project';
    const ignoreKey = `ignored_dups_${projId}`;
    const ignoredPairs = JSON.parse(localStorage.getItem(ignoreKey) || '[]');

    for (let i = 0; i < group.items.length; i++) {
      for (let j = i + 1; j < group.items.length; j++) {
        ignoredPairs.push(`${group.items[i].id}-${group.items[j].id}`);
      }
    }

    localStorage.setItem(ignoreKey, JSON.stringify(ignoredPairs));
    setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, [projectId]);

  const handleDeleteDupItem = useCallback((groupId: string, itemId: string) => {
    if (!confirm('Bạn có chắc muốn xóa từ điển này khỏi hệ thống?')) return;
    onDeleteGlossaryItem(itemId);
    setDuplicateGroups(prev => prev.map(group => {
      if (group.groupId !== groupId) return group;
      const remaining = group.items.filter(i => i.id !== itemId);
      return { ...group, items: remaining };
    }).filter(group => group.items.length > 1));
  }, [onDeleteGlossaryItem]);

  const scanOccurrences = (item: GlossaryItem) => {
    if (!chapters || chapters.length === 0) {
      setSearchContextMatches([]);
      return;
    }

    const matches: Array<{
      chapterId: string;
      chapterTitle: string;
      textType: 'source' | 'raw' | 'polished';
      paragraphText: string;
      paragraphIndex: number;
    }> = [];

    const zhTerm = item.chinese.trim();
    const viTerm = item.vietnamese.trim();

    chapters.forEach((chap) => {
      if (zhTerm && chap.sourceText) {
        const paragraphs = chap.sourceText.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.includes(zhTerm)) {
            matches.push({ chapterId: chap.id, chapterTitle: chap.title, textType: 'source', paragraphText: pText.trim(), paragraphIndex: idx + 1 });
          }
        });
      }

      if (viTerm && chap.rawTranslation) {
        const paragraphs = chap.rawTranslation.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.toLowerCase().includes(viTerm.toLowerCase())) {
            matches.push({ chapterId: chap.id, chapterTitle: chap.title, textType: 'raw', paragraphText: pText.trim(), paragraphIndex: idx + 1 });
          }
        });
      }

      if (viTerm && chap.polishedTranslation) {
        const paragraphs = chap.polishedTranslation.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.toLowerCase().includes(viTerm.toLowerCase())) {
            matches.push({ chapterId: chap.id, chapterTitle: chap.title, textType: 'polished', paragraphText: pText.trim(), paragraphIndex: idx + 1 });
          }
        });
      }
    });

    setSearchContextMatches(matches);
  };

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
  }, [selectedItem, chapters, glossary]);

  const handleAddFormSave = useCallback((fields: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string }) => {
    onAddGlossaryItem({
      chinese:    fields.chinese.trim(),
      pinyin:     fields.pinyin.trim() || fields.vietnamese.trim(),
      vietnamese: fields.vietnamese.trim(),
      type:       fields.type,
      note:       fields.note.trim(),
      origin:     'manual',
      createdAt:  new Date().toISOString()
    });
    setIsAdding(false);
  }, [onAddGlossaryItem]);

  const handleMdImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMdFileName(file.name);
    setIsAnalyzingMd(true);

    try {
      const mdText = await file.text();
      const response = await fetch('/api/analyze-guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mdText, apiKeys: apiKeys, model: selectedModel })
      });
      if (!response.ok) throw new Error("Lỗi phản hồi phân tích cẩm nang từ server.");

      const data = await response.json();
      const extractedList: Omit<GlossaryItem, 'id'>[] = data.extractedGlossary || [];
      if (extractedList.length === 0) {
        alert("Không tìm thấy thuật ngữ nào có thể trích xuất từ tệp chỉ dẫn này.");
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

        const systemCnMatch = glossary.find(g => g.chinese.replace(/\s+/g, '').trim().toLowerCase() === cleanChKey);
        const systemViMatch = glossary.find(g => g.vietnamese.trim().toLowerCase() === cleanViKey);

        if (systemCnMatch) {
          hasConflict = true;
          reason = `Trùng từ điển: Chữ gốc '${item.chinese}' đã có bản dịch là '${systemCnMatch.vietnamese}'.`;
        } else if (systemViMatch) {
          hasConflict = true;
          reason = `Trùng định nghĩa: Nghĩa Việt '${item.vietnamese}' đã được gán cho từ gốc '${systemViMatch.chinese}'.`;
        } else if (fileCh.has(cleanChKey)) {
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
        alert(`Phân tích xong! \n- Thêm trực tiếp thành công ${directsSavedCount} từ không có trùng lặp. \n- Phát hiện ${duplicateReviewList.length} từ bị trùng/lặp đã được chuyển vào mục 'Rà soát trùng lặp' riêng biệt để bạn tùy tiện quyết định.`);
      } else {
        alert(`Thành công mỹ mãn! Đã tải toàn bộ ${directsSavedCount} từ mượt mà từ tệp .MD vào từ điển.`);
      }

      setIsImporting(false);
      setMdFileName('');

    } catch (err: any) {
      console.error(err);
      alert("Đã xảy ra lỗi khi phân tích: " + err.message);
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
      alert("Vui lòng không để trống từ gốc hoặc nghĩa tiếng Việt.");
      return;
    }

    onAddGlossaryItem({
      chinese: item.chinese.trim(),
      pinyin: item.pinyin.trim() || item.vietnamese.trim(),
      vietnamese: item.vietnamese.trim(),
      type: item.type,
      note: item.note.trim(),
      origin: 'guideline',
      createdAt: item.createdAt || new Date().toISOString()
    });
    setReviewQueue(prev => prev.filter(r => r.id !== reviewId));
  }, [reviewQueue, onAddGlossaryItem]);

  const handleDiscardReviewItem = useCallback((reviewId: string) => {
    setReviewQueue(prev => prev.filter(r => r.id !== reviewId));
  }, []);

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
      alert('Từ điển đang trống, không có gì để xuất!');
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tu-dien-du-an-${Date.now()}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [glossary]);

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
      case 'guideline': return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">Cẩm nang</span>;
      case 'scanned':  return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">AI Quét</span>;
      default:         return <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">Thủ công</span>;
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

  const getBadgeColor = useCallback((type: GlossaryType) => {
    switch (type) {
      case 'character': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'location':  return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'term':      return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'phrase':    return 'bg-purple-50 text-purple-700 border-purple-200';
      default:          return 'bg-slate-50 text-slate-700 border-slate-200';
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

  const highlightWordInText = useCallback((text: string, word: string) => {
    if (!word || !text) return text;
    try {
      const parts = text.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '$&')})`, 'gi'));
      return (
          <>
            {parts.map((part, i) => (
                part.toLowerCase() === word.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 text-slate-900 font-extrabold px-1 rounded shadow-3xs border border-yellow-350">
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
          onSave={handleAddFormSave}
          onCancel={() => setIsAdding(false)}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className={`space-y-4 transition-all duration-300 ${selectedItem ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {/* Filter and Search Bar */}
          <div className="flex flex-col xl:flex-row gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-2xs">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                id="input-search-glossary"
                type="text"
                placeholder="Tìm kiếm từ tiếng Trung, Hán Việt hoặc bản dịch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500 text-slate-850"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-between xl:justify-end shrink-0">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-3xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="text-xs bg-transparent text-slate-700 focus:outline-none cursor-pointer font-sans h-5"
                  title="Tìm kiếm từ vựng chính xác theo ngày thêm vào hệ thống"
                />
                {searchDate && (
                  <button
                    type="button"
                    onClick={() => setSearchDate('')}
                    className="text-slate-400 hover:text-rose-600 font-bold text-xs pl-1"
                    title="Xóa bộ lọc ngày"
                  >
                    &times;
                  </button>
                )}
              </div>

              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="bg-white border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700 focus:outline-none cursor-pointer h-8"
              >
                <option value="all">Mọi nguồn gốc</option>
                <option value="guideline">Từ file cẩm nang (.md)</option>
                <option value="scanned">Từ truyện AI quét</option>
                <option value="manual">Nhập thủ công bằng tay</option>
              </select>

              <select
                id="select-filter-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-white border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700 focus:outline-none cursor-pointer h-8"
              >
                <option value="all">Tất cả thể loại</option>
                <option value="character">Nhân vật</option>
                <option value="location">Địa danh</option>
                <option value="term">Bí kíp / Vật phẩm</option>
                <option value="phrase">Thành ngữ / Cụm từ</option>
                <option value="other">Thuật ngữ khác</option>
              </select>

              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                }}
                className="bg-white border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700 focus:outline-none cursor-pointer h-8"
              >
                <option value="all">Hiện tất cả</option>
                <option value={10}>Hiện 10 từ/trang</option>
                <option value={30}>Hiện 30 từ/trang</option>
                <option value={50}>Hiện 50 từ/trang</option>
                <option value={100}>Hiện 100 từ/trang</option>
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
      </div>

      <div className="bg-indigo-55/40 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex gap-2 items-start shadow-xs">
        <Info className="w-4 h-4 text-indigo-650 mt-0.5 shrink-0" />
        <div className="text-[11px] text-indigo-900 leading-relaxed font-sans">
          <strong className="block text-indigo-950 mb-0.5">Mẹo xưng hô nhân vật linh hoạt:</strong>
          Đặc biệt đối với nhân vật nữ hoặc thầy trò quân nhân, bạn hãy điền ghi chú cột reference: <code className="bg-white/80 border border-indigo-100 px-1 rounded font-mono text-red-650 font-semibold">nhân vật nữ, kêu bằng nàng, có xưng hô đệ tử/sư tôn...</code>. AI sẽ xử lý ngữ cảnh này để cải thiện chất lượng dịch thô!
        </div>
      </div>

      {pendingGlossary.length > 0 && onConfirmPending && onDiscardPending && (
        <div className="bg-white border border-amber-250 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-amber-900">Hàng Chờ Kiểm Duyệt Trùng Lặp</h3>
              <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingGlossary.length} mục
              </span>
            </div>
            <p className="text-[11px] text-amber-600 hidden sm:block">
              Các thuật ngữ bị trùng lặp khi nhập. Xem xét và xác nhận hoặc loại bỏ.
            </p>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {pendingGlossary.map((pending) => (
              <div key={pending.id}
                   className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-bold text-amber-800 text-sm">{pending.chinese}</span>
                    <span className="text-slate-400 text-xs">→</span>
                    <span className="font-semibold text-slate-800 text-sm">{pending.vietnamese}</span>
                    {pending.pinyin && <span className="text-slate-400 text-[10px]">({pending.pinyin})</span>}
                    <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                      {pending.reason}
                    </span>
                  </div>
                  {pending.note && <p className="text-xs text-slate-500 italic">{pending.note}</p>}
                  {pending.originalValue && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      ⚠ Đã có: {pending.originalValue}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onConfirmPending(pending.id)}
                    className="flex items-center gap-1 py-1 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold transition cursor-pointer"
                    title="Xác nhận thêm vào từ điển"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" /> Xác nhận
                  </button>
                  <button
                    onClick={() => onDiscardPending(pending.id)}
                    className="flex items-center gap-1 py-1 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded text-xs font-semibold transition cursor-pointer"
                    title="Loại bỏ"
                  >
                    <XIcon className="w-3.5 h-3.5" /> Bỏ qua
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default React.memo(GlossaryManager);
