import React, { useState, useCallback } from 'react';
import { Link2, X, Check, Search, Trash2 } from 'lucide-react';
import { GlossaryItem } from '../../types';
import { useNotifications } from '../NotificationSystem';

export interface DuplicateGroupEdit {
  groupId: string;
  reason: string;
  items: GlossaryItem[];
}

interface DuplicateGroupCardProps {
  group: DuplicateGroupEdit;
  onUpdateItem: (groupId: string, itemId: string, field: keyof GlossaryItem, value: string) => void;
  onConfirm: (groupId: string) => void;
  onIgnore: (groupId: string) => void;
  onDeleteItem: (groupId: string, itemId: string) => void;
  findLiveContext: (chineseTerm: string) => Array<{ chapterTitle: string; sourceLine: string; translationLine: string }>;
  getOriginBadge: (origin?: string) => React.ReactNode;
}

const DuplicateGroupCard = React.memo(function DuplicateGroupCard({
  group, onUpdateItem, onConfirm, onIgnore, onDeleteItem, findLiveContext, getOriginBadge
}: DuplicateGroupCardProps) {
  const [expandedContextIds, setExpandedContextIds] = useState<Set<string>>(new Set());
  const toggleContext = useCallback((itemId: string) => {
    setExpandedContextIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  return (
    <div className="bg-ink border border-amber-800/40 rounded-md overflow-hidden shadow-xs hover:border-amber-700/80 transition-colors">
      <div className="flex items-center justify-between bg-amber-950/20 border-b border-amber-800/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
            {group.reason}
          </span>
          <span className="text-[10px] text-amber-400 font-semibold">
            ({group.items.length} từ liên quan)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(group.groupId)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[2px] px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-xs"
            title="Lưu tất cả thay đổi và đóng nhóm này"
          >
            <Check className="w-3.5 h-3.5" />
            Xác nhận &amp; đóng
          </button>
          <button
            onClick={() => onIgnore(group.groupId)}
            className="flex items-center gap-1.5 bg-ink hover:bg-parchment-2 text-text-muted hover:text-text-main rounded-[2px] px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer border border-parchment-2"
            title="Giữ cả hai từ, không hỏi lại ở lần quét tiếp theo"
          >
            <X className="w-3.5 h-3.5" />
            Giữ cả hai
          </button>
        </div>
      </div>

      <div className="divide-y divide-parchment-2">
        {group.items.map((item, itemIdx) => (
          <div
            key={item.id}
            className="p-3.5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-amber-950/10 transition-colors"
          >
            <div className="flex flex-col gap-1.5 shrink-0 min-w-[120px]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/40 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {itemIdx + 1}
                </span>
                {getOriginBadge(item.origin)}
              </div>

              {item.origin === 'scanned' && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => toggleContext(item.id)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-[2px] px-2.5 py-1.5 hover:bg-amber-900/40 transition-colors cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    {expandedContextIds.has(item.id) ? 'Ẩn ngữ cảnh' : 'Xem ngữ cảnh'}
                  </button>

                  {item.sourceChapter && (
                    <div className="text-[9px] font-bold text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded-[2px] px-1.5 py-0.5 truncate max-w-[200px]" title={item.sourceChapter}>
                      📖 {item.sourceChapter}
                    </div>
                  )}

                  {expandedContextIds.has(item.id) && (() => {
                    const hits = findLiveContext(item.chinese);
                    if (hits.length === 0) return (
                      <p className="text-[10px] text-text-muted italic">Không tìm thấy đoạn văn chứa từ này.</p>
                    );
                    return (
                      <div className="space-y-2 max-w-[300px]">
                        {hits.map((hit, hi) => (
                          <div key={hi} className="bg-ink border border-amber-800/30 rounded-[2px] p-2 space-y-1">
                            <div className="text-[9px] font-bold text-amber-300 uppercase truncate">{hit.chapterTitle}</div>
                            <div className="text-[10px] text-text-main font-serif leading-tight bg-parchment rounded-[2px] px-1.5 py-1 border border-parchment-2 line-clamp-2" title={hit.sourceLine}>
                              {hit.sourceLine}
                            </div>
                            {hit.translationLine && (
                              <div className="text-[10px] text-polish leading-tight italic line-clamp-2" title={hit.translationLine}>
                                → {hit.translationLine}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div>
                <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Tiếng Trung *</span>
                <input
                  type="text"
                  value={item.chinese}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'chinese', e.target.value)}
                  className="w-full text-xs font-serif bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Dịch Việt *</span>
                <input
                  type="text"
                  value={item.vietnamese}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'vietnamese', e.target.value)}
                  className="w-full text-xs font-semibold bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Phiên âm</span>
                <input
                  type="text"
                  value={item.pinyin}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'pinyin', e.target.value)}
                  className="w-full text-xs bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-text-muted mb-0.5">Ghi chú</span>
                <input
                  type="text"
                  value={item.note}
                  placeholder="Ghi chú vai trò..."
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'note', e.target.value)}
                  className="w-full text-xs bg-parchment border border-parchment-2 focus:border-amber-500 rounded-[2px] px-2.5 py-1.5 text-text-main outline-none transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => onDeleteItem(group.groupId, item.id)}
              className="self-center sm:self-start mt-3 sm:mt-4.5 p-1.5 text-text-muted hover:text-rose-400 hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer shrink-0"
              title="Xóa từ điển này khỏi dự án"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

export interface DuplicatePanelProps {
  showDuplicatePanel: boolean;
  setShowDuplicatePanel: (b: boolean) => void;
  duplicateGroups: DuplicateGroupEdit[];
  setDuplicateGroups: React.Dispatch<React.SetStateAction<DuplicateGroupEdit[]>>;
  handleUpdateDupItem: (groupId: string, itemId: string, field: keyof GlossaryItem, value: string) => void;
  handleConfirmDupGroup: (groupId: string) => void;
  handleIgnoreDupGroup: (groupId: string) => void;
  handleDeleteDupItem: (groupId: string, itemId: string) => void;
  findLiveContext: (chineseTerm: string) => Array<{ chapterTitle: string; sourceLine: string; translationLine: string }>;
  getOriginBadge: (origin?: string) => React.ReactNode;
}

export const DuplicatePanel = React.memo(function DuplicatePanel({
  showDuplicatePanel,
  setShowDuplicatePanel,
  duplicateGroups,
  setDuplicateGroups,
  handleUpdateDupItem,
  handleConfirmDupGroup,
  handleIgnoreDupGroup,
  handleDeleteDupItem,
  findLiveContext,
  getOriginBadge,
}: DuplicatePanelProps) {
  const { showConfirm } = useNotifications();
  if (!showDuplicatePanel || duplicateGroups.length === 0) return null;

  return (
    <div id="duplicate-filter-panel" className="bg-parchment border border-amber-800/40 rounded-md p-4 md:p-5 space-y-4 shadow-xs animate-fadeIn">
      <div className="flex items-center justify-between border-b border-parchment-2 pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-amber-400 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              Bảng Lọc Từ Trùng Lặp
              <span className="bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                {duplicateGroups.length} nhóm
              </span>
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              Mỗi thanh bên dưới chứa các từ có liên quan với nhau (trùng tiếng Trung hoặc tiếng Việt). Chỉnh sửa rồi nhấn <strong>Xác nhận</strong> để lưu và đóng thanh đó.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowDuplicatePanel(false); setDuplicateGroups([]); }}
          className="text-text-muted hover:text-text-main p-1 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
          title="Đóng bảng lọc trùng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
        {duplicateGroups.map((group) => (
          <DuplicateGroupCard
            key={group.groupId}
            group={group}
            onUpdateItem={handleUpdateDupItem}
            onConfirm={handleConfirmDupGroup}
            onIgnore={handleIgnoreDupGroup}
            onDeleteItem={handleDeleteDupItem}
            findLiveContext={findLiveContext}
            getOriginBadge={getOriginBadge}
          />
        ))}
      </div>

      <div className="flex justify-end pt-1 border-t border-parchment-2">
        <button
          onClick={async () => {
            const confirmed = await showConfirm({
              title: 'Hủy bỏ lọc trùng lặp',
              message: `Bạn có muốn đóng toàn bộ ${duplicateGroups.length} nhóm trùng lặp mà không lưu thay đổi?`,
              confirmText: 'Đồng ý đóng',
              cancelText: 'Hủy',
              type: 'warning'
            });
            if (confirmed) {
              setShowDuplicatePanel(false);
              setDuplicateGroups([]);
            }
          }}
          className="text-[11px] text-text-muted hover:text-rose-400 font-semibold px-3 py-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
        >
          Đóng tất cả không lưu
        </button>
      </div>
    </div>
  );
});
