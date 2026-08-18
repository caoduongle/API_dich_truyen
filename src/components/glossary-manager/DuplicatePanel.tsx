import React, { useState, useCallback } from 'react';
import { Link2, X, Check, Search, Trash2, BookOpen } from 'lucide-react';
import { GlossaryItem } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirm(group.groupId)}
            icon={<Check className="w-3.5 h-3.5" />}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            title="Lưu tất cả thay đổi và đóng nhóm này"
          >
            Xác nhận &amp; đóng
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onIgnore(group.groupId)}
            icon={<X className="w-3.5 h-3.5" />}
            title="Giữ cả hai từ, không hỏi lại ở lần quét tiếp theo"
          >
            Giữ cả hai
          </Button>
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
                    <div
                      className="text-[9px] font-bold text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded-[2px] px-1.5 py-0.5 truncate max-w-[200px] flex items-center gap-1"
                      title={item.sourceChapter}
                    >
                      <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{item.sourceChapter}</span>
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

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted font-serif">Tiếng Trung gốc</label>
                <input
                  type="text"
                  value={item.chinese}
                  onChange={e => onUpdateItem(group.groupId, item.id, 'chinese', e.target.value)}
                  className="w-full text-xs font-serif font-bold bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Phiên âm Pinyin</label>
                <input
                  type="text"
                  value={item.pinyin || ''}
                  onChange={e => onUpdateItem(group.groupId, item.id, 'pinyin', e.target.value)}
                  placeholder="Phiên âm..."
                  className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Dịch nghĩa tiếng Việt</label>
                <input
                  type="text"
                  value={item.vietnamese}
                  onChange={e => onUpdateItem(group.groupId, item.id, 'vietnamese', e.target.value)}
                  className="w-full text-xs font-semibold bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-main focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-[9px] uppercase font-bold text-text-muted">Ghi chú ngữ cảnh</label>
                <input
                  type="text"
                  value={item.note || ''}
                  onChange={e => onUpdateItem(group.groupId, item.id, 'note', e.target.value)}
                  placeholder="Ghi chú nhân vật, danh xưng..."
                  className="w-full text-xs bg-parchment border border-parchment-2 rounded-[2px] px-2 py-1 text-text-muted focus:text-text-main focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              onClick={() => onDeleteItem(group.groupId, item.id)}
              className="self-center sm:self-start mt-3 sm:mt-4.5 p-1.5 text-text-muted hover:text-polish hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer shrink-0"
              title="Xóa từ này khỏi từ điển"
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

  if (!showDuplicatePanel) return null;

  return (
    <div id="duplicate-panel-root" className="bg-parchment border border-amber-800/40 rounded-md p-4 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-parchment-2 pb-2.5">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-bold font-display uppercase tracking-wider text-text-main">
              Rà soát &amp; Hợp nhất từ trùng lặp
            </h3>
            <p className="text-[11px] text-text-muted">
              Hệ thống phát hiện các mục từ điển có tiếng Trung hoặc tiếng Việt trùng nhau. Hãy chỉnh sửa và bấm Xác nhận để áp dụng.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="warning">
            {duplicateGroups.length} nhóm cần xử lý
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDuplicatePanel(false)}
          >
            Đóng
          </Button>
        </div>
      </div>

      {duplicateGroups.length === 0 ? (
        <div className="text-center py-6 text-xs text-text-muted">
          ✓ Tuyệt vời! Không phát hiện từ nào bị trùng lặp trong từ điển hiện tại.
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {duplicateGroups.map(group => (
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
      )}

      {duplicateGroups.length > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-parchment-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const confirmed = await showConfirm({
                title: 'Bỏ qua tất cả từ trùng',
                message: 'Giữ lại tất cả các từ trong danh sách trùng lặp này mà không chỉnh sửa?',
                confirmText: 'Bỏ qua tất cả',
                cancelText: 'Hủy',
                type: 'warning',
              });
              if (confirmed) {
                setDuplicateGroups([]);
                setShowDuplicatePanel(false);
              }
            }}
            className="text-text-muted hover:text-polish"
          >
            Bỏ qua tất cả nhóm
          </Button>
          <span className="text-[11px] text-text-muted italic">
            Mẹo: Bấm "Giữ cả hai" nếu hai từ tuy giống nhau nhưng là 2 nghĩa riêng biệt trong truyện.
          </span>
        </div>
      )}
    </div>
  );
});

export default DuplicatePanel;
