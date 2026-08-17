import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { GlossaryItem, StoryProject } from '../types';
import { DuplicateGroupEdit } from '../components/glossary-manager/DuplicatePanel';
import { MergeHanGroup } from '../components/glossary-manager/MergeHanPanel';
import { canonicalizeHan } from '@shared/sinoNormalize';
import { useNotifications } from '../components/NotificationSystem';

export function computeDuplicateGroups(
  glossary: GlossaryItem[], 
  projectId: string = '', 
  ignoredDuplicatePairs: string[] = []
): DuplicateGroupEdit[] {
  const n = glossary.length;
  if (n < 2) return [];

  const ignoredPairs = new Set<string>(ignoredDuplicatePairs);

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

export function computeMergeHanGroups(glossary: GlossaryItem[]): MergeHanGroup[] {
  const groupsMap = new Map<string, GlossaryItem[]>();
  glossary.forEach(item => {
    if (!item.chinese) return;
    const canon = canonicalizeHan(item.chinese);
    const existing = groupsMap.get(canon) || [];
    existing.push(item);
    groupsMap.set(canon, existing);
  });

  const groups: MergeHanGroup[] = [];
  let groupCounter = 0;
  groupsMap.forEach((items, canon) => {
    const uniqueChinese = new Set(items.map(it => it.chinese.trim()));
    if (uniqueChinese.size > 1) {
      groups.push({
        groupId: `merge_${groupCounter++}_${Date.now()}`,
        canonical: canon,
        items
      });
    }
  });

  return groups;
}

export interface UseGlossaryDuplicatesProps {
  projectId: string;
  glossary: GlossaryItem[];
  activeProject?: StoryProject;
  onUpdateProject?: (updated: StoryProject) => void;
  onUpdateGlossaryItem: (id: string, item: GlossaryItem) => void;
  onDeleteGlossaryItem: (id: string) => void;
  onMergeGlossaryItems?: (primaryId: string, mergedPayload: Partial<GlossaryItem>, idsToDelete: string[]) => void;
}

export function useGlossaryDuplicates({
  projectId,
  glossary,
  activeProject,
  onUpdateProject,
  onUpdateGlossaryItem,
  onDeleteGlossaryItem,
  onMergeGlossaryItems,
}: UseGlossaryDuplicatesProps) {
  const { showToast, showConfirm } = useNotifications();

  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroupEdit[]>([]);
  const duplicateGroupsRef = useRef(duplicateGroups);
  useEffect(() => { duplicateGroupsRef.current = duplicateGroups; }, [duplicateGroups]);

  const [showMergeHanPanel, setShowMergeHanPanel] = useState(false);
  const [mergeHanGroups, setMergeHanGroups] = useState<MergeHanGroup[]>([]);

  const handleOpenDuplicatePanel = () => {
    const projId = projectId || 'default_project';
    setShowDuplicatePanel(true);
    setDuplicateGroups([]);
    startTransition(() => {
      const groups = computeDuplicateGroups(glossary, projId, activeProject?.ignoredDuplicatePairs || []);
      setDuplicateGroups(groups);
      if (groups.length === 0) {
        showToast({ message: 'Tuyệt vời! Không tìm thấy từ ngữ nào bị trùng lặp trong từ điển của bạn.', type: 'success' });
        setShowDuplicatePanel(false);
      }
    });
  };

  const handleOpenMergeHanPanel = () => {
    setShowMergeHanPanel(true);
    setMergeHanGroups([]);
    
    startTransition(() => {
      const groups = computeMergeHanGroups(glossary);
      setMergeHanGroups(groups);
      if (groups.length === 0) {
        showToast({ message: 'Không tìm thấy các từ trùng lặp do lệch Phồn/Giản thể trong từ điển của bạn.', type: 'success' });
        setShowMergeHanPanel(false);
      }
    });
  };

  const handleConfirmMergeHan = useCallback(async (
    groupId: string,
    primaryId: string,
    mergedPayload: Partial<GlossaryItem>,
    idsToDelete: string[]
  ) => {
    if (!onMergeGlossaryItems) return;
    onMergeGlossaryItems(primaryId, mergedPayload, idsToDelete);
    setMergeHanGroups(prev => prev.filter(g => g.groupId !== groupId));
    showToast({ message: 'Đã gộp thành công các biến thể và đồng bộ vào từ điển!', type: 'success' });
  }, [onMergeGlossaryItems, showToast]);

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

    if (!activeProject || !onUpdateProject) return;

    const currentIgnored = activeProject.ignoredDuplicatePairs || [];
    const newIgnored = [...currentIgnored];

    for (let i = 0; i < group.items.length; i++) {
      for (let j = i + 1; j < group.items.length; j++) {
        newIgnored.push(`${group.items[i].id}-${group.items[j].id}`);
      }
    }

    onUpdateProject({
      ...activeProject,
      ignoredDuplicatePairs: newIgnored
    });
    setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, [activeProject, onUpdateProject]);

  const handleDeleteDupItem = useCallback(async (groupId: string, itemId: string) => {
    const confirmed = await showConfirm({
      title: 'Xóa mục từ điển',
      message: 'Bạn có chắc muốn xóa từ điển này khỏi hệ thống?',
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      type: 'danger'
    });
    if (!confirmed) return;
    onDeleteGlossaryItem(itemId);
    setDuplicateGroups(prev => prev.map(group => {
      if (group.groupId !== groupId) return group;
      const remaining = group.items.filter(i => i.id !== itemId);
      return { ...group, items: remaining };
    }).filter(group => group.items.length > 1));
  }, [onDeleteGlossaryItem, showConfirm]);

  return {
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
  };
}
