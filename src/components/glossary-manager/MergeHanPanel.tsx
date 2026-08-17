import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, AlertCircle } from 'lucide-react';
import { GlossaryItem } from '../../types';

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
          <span className="bg-ink text-polish border border-parchment-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            {groups.length} nhóm
          </span>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-xs font-semibold text-text-muted hover:text-text-main bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 transition-all cursor-pointer"
        >
          Đóng gợi ý
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed max-w-4xl">
        Hệ thống phát hiện các thuật ngữ viết khác nhau giữa Phồn thể và Giản thể nhưng có cùng dạng chuẩn hóa. Bạn có thể chọn giữ lại 1 từ chính (Primary), các từ còn lại sẽ được lưu tự động thành biến thể (variants) của từ đó để hệ thống tiếp tục hỗ trợ đối chiếu dịch tự động.
      </p>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
        {groups.map(group => {
          const primaryId = selectedPrimaryIds[group.groupId];
          const payload = mergePayloads[group.groupId] || {};
          const primaryItem = group.items.find(it => it.id === primaryId) || group.items[0];
          const otherItems = group.items.filter(it => it.id !== primaryId);

          return (
            <div
              key={group.groupId}
              className="bg-ink border border-parchment-2 hover:border-text-muted rounded-md overflow-hidden shadow-xs transition-colors grid grid-cols-1 lg:grid-cols-12"
            >
              {/* Left Column: Select Primary */}
              <div className="lg:col-span-7 p-4 border-r border-parchment-2 space-y-3 bg-ink/60">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                  Chọn dạng chữ chính (Primary Form)
                </span>
                
                <div className="space-y-2">
                  {group.items.map(item => {
                    const isPrimary = item.id === primaryId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectPrimary(group.groupId, item)}
                        className={`p-3 border rounded-[2px] flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isPrimary
                            ? 'bg-parchment border-polish shadow-xs'
                            : 'bg-ink border-parchment-2 hover:bg-parchment-2'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-polish text-sm">{item.chinese}</span>
                            <span className="text-text-muted text-xs">→</span>
                            <span className="font-semibold text-text-main text-xs">{item.vietnamese}</span>
                            <span className="text-[9px] bg-ink text-text-muted border border-parchment-2 px-1.5 py-0.5 rounded-[2px] font-sans">
                              {item.type}
                            </span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-text-muted italic truncate mt-0.5" title={item.note}>
                              {item.note}
                            </p>
                          )}
                          {Array.isArray(item.variants) && item.variants.length > 0 && (
                            <div className="text-[9px] text-polish/80 mt-1 font-serif">
                              Biến thể đã có: {item.variants.join(', ')}
                            </div>
                          )}
                        </div>
                        
                        <div className="shrink-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isPrimary
                              ? 'bg-polish border-polish text-white'
                              : 'bg-ink border-parchment-2'
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
              <div className="lg:col-span-5 p-4 flex flex-col justify-between gap-3 bg-parchment/60">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-polish uppercase tracking-wider block">
                    Thông tin sau khi gộp
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Dịch Việt</span>
                      <input
                        type="text"
                        value={payload.vietnamese || ''}
                        onChange={(e) => handleUpdateField(group.groupId, 'vietnamese', e.target.value)}
                        className="w-full text-xs font-semibold bg-ink border border-parchment-2 focus:border-polish rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Phiên âm</span>
                      <input
                        type="text"
                        value={payload.pinyin || ''}
                        onChange={(e) => handleUpdateField(group.groupId, 'pinyin', e.target.value)}
                        className="w-full text-xs bg-ink border border-parchment-2 focus:border-polish rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Phân loại</span>
                    <select
                      value={payload.type || 'character'}
                      onChange={(e) => handleUpdateField(group.groupId, 'type', e.target.value)}
                      className="w-full text-xs bg-ink border border-parchment-2 focus:border-polish rounded-[2px] px-2 py-1.5 text-text-main outline-none transition-colors cursor-pointer"
                    >
                      <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
                      <option value="location" className="bg-parchment text-text-main">Địa danh</option>
                      <option value="term" className="bg-parchment text-text-main">Bí kíp / Vật phẩm</option>
                      <option value="phrase" className="bg-parchment text-text-main">Thành ngữ / Cụm từ</option>
                      <option value="other" className="bg-parchment text-text-main">Thuật ngữ khác</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Ghi chú gộp</span>
                    <textarea
                      value={payload.note || ''}
                      onChange={(e) => handleUpdateField(group.groupId, 'note', e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-ink border border-parchment-2 focus:border-polish rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors resize-none"
                    />
                  </div>

                  <div className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-[10px] text-text-muted leading-tight">
                      Từ chính: <strong className="font-serif text-text-main">{primaryItem.chinese}</strong>.
                      <br />
                      Biến thể sẽ lưu: <strong className="font-serif text-text-main">{otherItems.map(it => it.chinese).join(', ')}</strong>.
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-parchment-2 pt-3">
                  <button
                    onClick={() => handleMergeSubmit(group.groupId)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-polish hover:bg-[#A03522] text-white rounded-[2px] py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    Đồng ý gộp
                  </button>
                  <button
                    onClick={() => handleIgnore(group.groupId)}
                    className="flex items-center justify-center gap-1 bg-ink hover:bg-parchment-2 border border-parchment-2 text-text-muted hover:text-text-main rounded-[2px] px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
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
