import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, AlertCircle } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';

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

  // Initialize selected primary item and form payloads when groups load
  useEffect(() => {
    const initialIds: Record<string, string> = {};
    const initialPayloads: Record<string, Partial<GlossaryItem>> = {};

    groups.forEach(group => {
      // Pick the first item as default primary
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

    // The other items in the group will be merged
    const otherItems = group.items.filter(it => it.id !== primaryId);
    const idsToDelete = otherItems.map(it => it.id);

    // Collect all unique variants.
    // The variants include:
    // - The other items' chinese names
    // - Any existing variants in all items (primary + other items)
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

    // Ensure primary chinese is not in variants
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
    <div className="bg-slate-50 border border-amber-200 rounded-xl p-4 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Gợi ý gộp biến thể Hán tự (Phồn / Giản thể)
          </h3>
          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            {groups.length} nhóm
          </span>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded px-2.5 py-1 transition-colors cursor-pointer"
        >
          Đóng gợi ý
        </button>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed max-w-4xl">
        Hệ thống phát hiện các thuật ngữ viết khác nhau giữa Phồn thể và Giản thể nhưng có cùng dạng chuẩn hóa. Bạn có thể chọn giữ lại 1 từ chính (Primary), các từ còn lại sẽ được lưu tự động thành biến thể (variants) của từ đó để hệ thống tiếp tục hỗ trợ đối chiếu dịch tự động.
      </p>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {groups.map(group => {
          const primaryId = selectedPrimaryIds[group.groupId];
          const payload = mergePayloads[group.groupId] || {};
          const primaryItem = group.items.find(it => it.id === primaryId) || group.items[0];
          const otherItems = group.items.filter(it => it.id !== primaryId);

          return (
            <div
              key={group.groupId}
              className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl overflow-hidden shadow-2xs transition-colors grid grid-cols-1 lg:grid-cols-12"
            >
              {/* Left Column: Select Primary */}
              <div className="lg:col-span-7 p-4 border-r border-slate-100 space-y-3 bg-slate-50/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Chọn dạng chữ chính (Primary Form)
                </span>
                
                <div className="space-y-2">
                  {group.items.map(item => {
                    const isPrimary = item.id === primaryId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectPrimary(group.groupId, item)}
                        className={`p-3 border rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isPrimary
                            ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 text-sm">{item.chinese}</span>
                            <span className="text-slate-400 text-xs">→</span>
                            <span className="font-semibold text-indigo-950 text-xs">{item.vietnamese}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {item.type}
                            </span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-slate-400 italic truncate mt-0.5" title={item.note}>
                              {item.note}
                            </p>
                          )}
                          {Array.isArray(item.variants) && item.variants.length > 0 && (
                            <div className="text-[9px] text-amber-700 mt-1 font-mono">
                              Biến thể đã có: {item.variants.join(', ')}
                            </div>
                          )}
                        </div>
                        
                        <div className="shrink-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isPrimary
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-white border-slate-300'
                          }`}>
                            {isPrimary && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Edit Merged Details */}
              <div className="lg:col-span-5 p-4 flex flex-col justify-between gap-3 bg-amber-50/5">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                    Thông tin sau khi gộp
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Dịch Việt</span>
                      <input
                        type="text"
                        value={payload.vietnamese || ''}
                        onChange={(e) => handleUpdateField(group.groupId, 'vietnamese', e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 focus:border-amber-400 rounded px-2 py-1.5 text-indigo-950 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phiên âm</span>
                      <input
                        type="text"
                        value={payload.pinyin || ''}
                        onChange={(e) => handleUpdateField(group.groupId, 'pinyin', e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 focus:border-amber-400 rounded px-2 py-1.5 text-slate-700 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phân loại</span>
                    <select
                      value={payload.type || 'character'}
                      onChange={(e) => handleUpdateField(group.groupId, 'type', e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 focus:border-amber-400 rounded px-2 py-1.5 text-slate-700 outline-none transition-colors"
                    >
                      <option value="character">Nhân vật</option>
                      <option value="location">Địa danh</option>
                      <option value="term">Bí kíp / Vật phẩm</option>
                      <option value="phrase">Thành ngữ / Cụm từ</option>
                      <option value="other">Thuật ngữ khác</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Ghi chú gộp</span>
                    <textarea
                      value={payload.note || ''}
                      onChange={(e) => handleUpdateField(group.groupId, 'note', e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-white border border-slate-200 focus:border-amber-400 rounded px-2 py-1 text-slate-600 outline-none transition-colors resize-none"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-[10px] text-slate-500 leading-tight">
                      Từ chính: <strong className="font-mono text-slate-700">{primaryItem.chinese}</strong>.
                      <br />
                      Biến thể sẽ lưu: <strong className="font-mono text-slate-700">{otherItems.map(it => it.chinese).join(', ')}</strong>.
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleMergeSubmit(group.groupId)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer shadow-xs border border-amber-600/10"
                  >
                    <Check className="w-4 h-4" />
                    Đồng ý gộp
                  </button>
                  <button
                    onClick={() => handleIgnore(group.groupId)}
                    className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                  >
                    <X className="w-4 h-4" />
                    Bỏ qua
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
