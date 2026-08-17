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
    <div className="bg-slate-950/40 border border-violet-900/40 rounded-xl overflow-hidden shadow-lg hover:border-violet-800/80 transition-colors">
      <div className="flex items-center justify-between bg-violet-950/30 border-b border-violet-900/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
            {group.reason}
          </span>
          <span className="text-[10px] text-violet-400 font-semibold">
            ({group.items.length} từ liên quan)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(group.groupId)}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-md shadow-violet-500/10"
            title="Lưu tất cả thay đổi và đóng nhóm này"
          >
            <Check className="w-3.5 h-3.5" />
            Xác nhận &amp; đóng
          </button>
          <button
            onClick={() => onIgnore(group.groupId)}
            className="flex items-center gap-1.5 bg-slate-900/50 hover:bg-slate-800/60 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer shadow-sm border border-slate-800"
            title="Giữ cả hai từ, không hỏi lại ở lần quét tiếp theo"
          >
            <X className="w-3.5 h-3.5" />
            Giữ cả hai
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-850/80">
        {group.items.map((item, itemIdx) => (
          <div
            key={item.id}
            className="p-3.5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-violet-950/15 transition-colors"
          >
            <div className="flex flex-col gap-1.5 shrink-0 min-w-[120px]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-violet-950/80 text-violet-300 border border-violet-900/40 font-extrabold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {itemIdx + 1}
                </span>
                {getOriginBadge(item.origin)}
              </div>

              {item.origin === 'scanned' && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => toggleContext(item.id)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-900/40 rounded-lg px-2.5 py-1.5 hover:bg-amber-900/60 transition-colors cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    {expandedContextIds.has(item.id) ? 'Ẩn ngữ cảnh' : 'Xem ngữ cảnh'}
                  </button>

                  {item.sourceChapter && (
                    <div className="text-[9px] font-bold text-amber-400 bg-amber-950/40 border border-amber-900/30 rounded px-1.5 py-0.5 truncate max-w-[200px]" title={item.sourceChapter}>
                      📖 {item.sourceChapter}
                    </div>
                  )}

                  {expandedContextIds.has(item.id) && (() => {
                    const hits = findLiveContext(item.chinese);
                    if (hits.length === 0) return (
                      <p className="text-[10px] text-slate-500 italic">Không tìm thấy đoạn văn chứa từ này.</p>
                    );
                    return (
                      <div className="space-y-2 max-w-[300px]">
                        {hits.map((hit, hi) => (
                          <div key={hi} className="bg-slate-950/60 border border-amber-900/30 rounded-lg p-2 space-y-1">
                            <div className="text-[9px] font-extrabold text-amber-400 uppercase truncate">{hit.chapterTitle}</div>
                            <div className="text-[10px] text-slate-300 font-mono leading-tight bg-slate-950/50 rounded px-1.5 py-1 border border-slate-800 line-clamp-2" title={hit.sourceLine}>
                              {hit.sourceLine}
                            </div>
                            {hit.translationLine && (
                              <div className="text-[10px] text-indigo-400 leading-tight italic line-clamp-2" title={hit.translationLine}>
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
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Tiếng Trung *</span>
                <input
                  type="text"
                  value={item.chinese}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'chinese', e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-950/60 border border-violet-900/30 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-slate-100 outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Dịch Việt *</span>
                <input
                  type="text"
                  value={item.vietnamese}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'vietnamese', e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-950/60 border border-violet-900/30 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-slate-100 outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Phiên âm</span>
                <input
                  type="text"
                  value={item.pinyin}
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'pinyin', e.target.value)}
                  className="w-full text-xs bg-slate-950/60 border border-violet-900/30 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none transition-colors"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Ghi chú</span>
                <input
                  type="text"
                  value={item.note}
                  placeholder="Ghi chú vai trò..."
                  onChange={(e) => onUpdateItem(group.groupId, item.id, 'note', e.target.value)}
                  className="w-full text-xs bg-slate-950/60 border border-violet-900/30 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => onDeleteItem(group.groupId, item.id)}
              className="self-center sm:self-start mt-3 sm:mt-4.5 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer shrink-0"
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
    <div id="duplicate-filter-panel" className="bg-slate-900/40 border-2 border-violet-900/40 rounded-2xl p-4 md:p-5 space-y-4 shadow-xl backdrop-blur-md animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-violet-400 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-2">
              Bảng Lọc Từ Trùng Lặp
              <span className="bg-violet-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                {duplicateGroups.length} nhóm
              </span>
            </h4>
            <p className="text-[11px] text-violet-400 mt-0.5">
              Mỗi thanh bên dưới chứa các từ có liên quan với nhau (trùng tiếng Trung hoặc tiếng Việt). Chỉnh sửa rồi nhấn <strong>Xác nhận</strong> để lưu và đóng thanh đó.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowDuplicatePanel(false); setDuplicateGroups([]); }}
          className="text-violet-500 hover:text-violet-400 p-1 rounded-md hover:bg-violet-950/40 transition-colors cursor-pointer"
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

      <div className="flex justify-end pt-1 border-t border-slate-800">
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
          className="text-[11px] text-slate-400 hover:text-rose-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
        >
          Đóng tất cả không lưu
        </button>
      </div>
    </div>
  );
});
