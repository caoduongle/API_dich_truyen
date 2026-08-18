import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { GlossaryItem } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface MergeHanGroup {
  groupId: string;
  canonical: string;
  items: GlossaryItem[];
}

interface MergeHanPanelProps {
  show: boolean;
  setShow: (b: boolean) => void;
  groups: MergeHanGroup[];
  setGroups: React.Dispatch<React.SetStateAction<MergeHanGroup[]>>;
  onConfirmMerge: (groupId: string, primaryId: string, mergedPayload: Partial<GlossaryItem>, idsToDelete: string[]) => void;
}

export function MergeHanPanel({
  show,
  setShow,
  groups,
  setGroups,
  onConfirmMerge
}: MergeHanPanelProps) {
  const [selectedPrimaryIds, setSelectedPrimaryIds] = useState<Record<string, string>>({});
  const [mergePayloads, setMergePayloads] = useState<Record<string, Partial<GlossaryItem>>>({});

  useEffect(() => {
    const initialIds: Record<string, string> = {};
    const initialPayloads: Record<string, Partial<GlossaryItem>> = {};

    groups.forEach(group => {
      const defaultPrimary = group.items[0];
      initialIds[group.groupId] = defaultPrimary.id;
      initialPayloads[group.groupId] = {
        vietnamese: defaultPrimary.vietnamese || '',
        pinyin: defaultPrimary.pinyin || '',
        type: defaultPrimary.type || 'character',
        note: defaultPrimary.note || ''
      };
    });

    setSelectedPrimaryIds(initialIds);
    setMergePayloads(initialPayloads);
  }, [groups]);

  const handleSelectPrimary = (groupId: string, item: GlossaryItem) => {
    setSelectedPrimaryIds(prev => ({ ...prev, [groupId]: item.id }));
    setMergePayloads(prev => ({
      ...prev,
      [groupId]: {
        vietnamese: item.vietnamese || '',
        pinyin: item.pinyin || '',
        type: item.type || 'character',
        note: item.note || ''
      }
    }));
  };

  const handleUpdateField = (groupId: string, field: keyof GlossaryItem, value: any) => {
    setMergePayloads(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [field]: value
      }
    }));
  };

  const handleIgnore = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.groupId !== groupId));
  };

  const handleMergeSubmit = (groupId: string) => {
    const group = groups.find(g => g.groupId === groupId);
    const primaryId = selectedPrimaryIds[groupId];
    const payload = mergePayloads[groupId];

    if (!group || !primaryId || !payload) return;

    const primaryItem = group.items.find(it => it.id === primaryId);
    if (!primaryItem) return;

    const otherItems = group.items.filter(it => it.id !== primaryId);
    const idsToDelete = otherItems.map(it => it.id);

    const variantsSet = new Set<string>();
    
    otherItems.forEach(it => {
      variantsSet.add(it.chinese);
      if (Array.isArray(it.variants)) {
        it.variants.forEach(v => variantsSet.add(v));
      }
    });

    if (Array.isArray(primaryItem.variants)) {
      primaryItem.variants.forEach(v => variantsSet.add(v));
    }

    variantsSet.delete(primaryItem.chinese);

    const finalVariants = Array.from(variantsSet).filter(v => v.trim() !== '');

    const mergedPayload: Partial<GlossaryItem> = {
      chinese: primaryItem.chinese,
      vietnamese: (payload.vietnamese || '').trim(),
      pinyin: (payload.pinyin || '').trim(),
      type: payload.type || primaryItem.type,
      note: (payload.note || '').trim(),
      variants: finalVariants
    };

    onConfirmMerge(groupId, primaryId, mergedPayload, idsToDelete);
  };

  if (!show || groups.length === 0) return null;

  return (
    <div className="bg-parchment border border-parchment-2 rounded-md p-4 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-parchment-2 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-polish" />
          <h3 className="text-sm font-bold font-serif text-text-main uppercase tracking-wider">
            Gợi ý gộp biến thể Hán tự (Phồn / Giản thể)
          </h3>
          <Badge tone="polish">
            {groups.length} nhóm
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShow(false)}
        >
          Đóng gợi ý
        </Button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed max-w-4xl">
        Hệ thống phát hiện các thuật ngữ viết khác nhau giữa Phồn thể và Giản thể nhưng có cùng dạng chuẩn hóa. Bạn có thể chọn giữ lại 1 từ chính (Primary), các từ còn lại sẽ được lưu tự động thành biến thể (variants) của từ đó để hệ thống tiếp tục hỗ trợ đối chiếu dịch tự động.
      </p>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {groups.map(group => {
          const primaryId = selectedPrimaryIds[group.groupId];
          const payload = mergePayloads[group.groupId] || {};

          return (
            <div key={group.groupId} className="bg-ink border border-parchment-2 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-parchment-2 pb-2">
                <span className="text-xs font-mono font-bold text-text-muted">
                  Chuẩn hóa: <span className="text-polish font-serif">{group.canonical}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleMergeSubmit(group.groupId)}
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Xác nhận gộp
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleIgnore(group.groupId)}
                    icon={<X className="w-3.5 h-3.5" />}
                  >
                    Bỏ qua
                  </Button>
                </div>
              </div>

              {/* Chọn từ chính */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted block">
                  Chọn mục từ hiển thị chính (Primary entry):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {group.items.map(item => {
                    const isSelected = item.id === primaryId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectPrimary(group.groupId, item)}
                        className={`p-2.5 rounded-[2px] border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-parchment border-polish shadow-xs'
                            : 'bg-parchment/40 border-parchment-2 hover:border-text-muted'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-serif font-bold text-text-main text-xs">{item.chinese}</div>
                          <div className="text-[11px] text-polish truncate font-semibold">{item.vietnamese}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-[2px] flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-polish border-polish text-white' : 'border-parchment-2'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tùy chỉnh thông tin gộp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label className="text-[9px] uppercase font-bold text-text-muted block mb-0.5">Dịch nghĩa chuẩn *</label>
                  <input
                    type="text"
                    value={payload.vietnamese || ''}
                    onChange={e => handleUpdateField(group.groupId, 'vietnamese', e.target.value)}
                    className="w-full text-xs font-semibold bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-polish"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-text-muted block mb-0.5">Phiên âm Hán Việt</label>
                  <input
                    type="text"
                    value={payload.pinyin || ''}
                    onChange={e => handleUpdateField(group.groupId, 'pinyin', e.target.value)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-polish"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-text-muted block mb-0.5">Phân loại</label>
                  <select
                    value={payload.type || 'character'}
                    onChange={e => handleUpdateField(group.groupId, 'type', e.target.value)}
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-1 py-1 text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
                    <option value="location" className="bg-parchment text-text-main">Địa danh</option>
                    <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
                    <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
                    <option value="other" className="bg-parchment text-text-main">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-text-muted block mb-0.5">Ghi chú ngữ cảnh</label>
                  <input
                    type="text"
                    value={payload.note || ''}
                    onChange={e => handleUpdateField(group.groupId, 'note', e.target.value)}
                    placeholder="Ghi chú thêm..."
                    className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-polish"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MergeHanPanel;
