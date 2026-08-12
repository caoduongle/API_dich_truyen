import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useVirtualList } from '../../hooks/useVirtualList';
import { useNotifications } from '../NotificationSystem';

// Sleek single-row Inline Editor to fit inside virtualized row height
interface InlineEditRowProps {
  item: GlossaryItem;
  onSave: (id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => void;
  onCancel: () => void;
}

const InlineEditRow = React.memo(function InlineEditRow({ item, onSave, onCancel }: InlineEditRowProps) {
  const { showToast } = useNotifications();
  const [chinese, setChinese] = useState(item.chinese);
  const [pinyin, setPinyin] = useState(item.pinyin);
  const [vietnamese, setVietnamese] = useState(item.vietnamese);
  const [type, setType] = useState<GlossaryType>(item.type);

  return (
    <div 
      className="col-span-12 grid grid-cols-12 gap-2 items-center px-3 h-full bg-indigo-950/20 border-b border-indigo-900/30" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="col-span-3">
        <input 
          type="text" 
          value={chinese} 
          onChange={(e) => setChinese(e.target.value)}
          className="w-full px-2 py-0.5 text-slate-100 bg-slate-950 border border-slate-700/60 rounded text-xs focus:outline-none focus:border-indigo-500" 
        />
      </div>
      <div className="col-span-2">
        <input 
          type="text" 
          value={pinyin} 
          onChange={(e) => setPinyin(e.target.value)}
          className="w-full px-2 py-0.5 text-slate-100 bg-slate-950 border border-slate-700/60 rounded text-xs focus:outline-none focus:border-indigo-500" 
        />
      </div>
      <div className="col-span-3">
        <input 
          type="text" 
          value={vietnamese} 
          onChange={(e) => setVietnamese(e.target.value)}
          className="w-full px-2 py-0.5 text-slate-100 bg-slate-950 border border-slate-700/60 rounded text-xs focus:outline-none focus:border-indigo-500" 
        />
      </div>
      <div className="col-span-2">
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as GlossaryType)}
          className="w-full px-1 py-0.5 text-slate-100 bg-slate-950 border border-slate-700/60 rounded text-xs focus:outline-none cursor-pointer"
        >
          <option value="character">Nhân vật</option>
          <option value="location">Địa danh</option>
          <option value="term">Bí kíp/Vật phẩm</option>
          <option value="phrase">Thành ngữ</option>
          <option value="other">Khác</option>
        </select>
      </div>
      <div className="col-span-2 flex gap-1 justify-center">
        <button 
          onClick={() => {
            if (!chinese.trim() || !vietnamese.trim()) {
              showToast({ message: "Vui lòng nhập đầy đủ tiếng Trung gốc và dịch tiếng Việt.", type: 'warning' });
              return;
            }
            onSave(item.id, chinese.trim(), pinyin.trim() || vietnamese.trim(), vietnamese.trim(), type, item.note);
          }}
          className="p-1 bg-indigo-650 text-white hover:bg-indigo-700 rounded transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={onCancel}
          className="p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

interface GlossaryTableRowProps {
  item: GlossaryItem;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (item: GlossaryItem) => void;
  onEdit: (item: GlossaryItem) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => void;
  onCancelEdit: () => void;
  getOriginBadge: (origin?: string) => React.ReactNode;
  getBadgeColor: (type: GlossaryType) => string;
  getTypeName: (type: GlossaryType) => string;
  style?: React.CSSProperties;
}

const GlossaryTableRow = React.memo(function GlossaryTableRow({
  item, isSelected, isEditing, onSelect, onEdit, onDelete, onSave, onCancelEdit,
  getOriginBadge, getBadgeColor, getTypeName, style
}: GlossaryTableRowProps) {
  const { showConfirm } = useNotifications();
  return (
    <div
      style={style}
      onClick={() => onSelect(item)}
      className={`grid grid-cols-12 items-center border-b border-slate-800/80 transition-colors cursor-pointer select-none text-xs hover:bg-slate-850/30 ${
        isSelected ? 'bg-indigo-950/30 border-l-4 border-indigo-600' : ''
      }`}
    >
      {isEditing ? (
        <InlineEditRow item={item} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <>
          <div className="col-span-3 px-3 py-2.5">
            <span className="font-bold text-slate-200 font-mono tracking-wide block hover:underline truncate">
              {item.chinese}
            </span>
            <div className="mt-1">{getOriginBadge(item.origin)}</div>
          </div>
          
          <div className="col-span-2 px-3 py-2.5 text-slate-400 truncate">{item.pinyin}</div>
          
          <div className="col-span-3 px-3 py-2.5 text-indigo-300 font-bold bg-indigo-950/10 border-l-2 border-indigo-500/40 truncate">
            {item.vietnamese}
          </div>
          
          <div className="col-span-2 px-3 py-2.5 truncate">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getBadgeColor(item.type)}`}>
              {getTypeName(item.type)}
            </span>
          </div>
          
          <div className="col-span-1 px-3 py-2.5 whitespace-nowrap text-slate-450 font-sans text-[11px]">
            {item.createdAt ? (
              <span className="font-semibold text-slate-350">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
            ) : (
              <span className="text-slate-600 italic">--</span>
            )}
          </div>
          
          <div className="col-span-1 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <button 
                onClick={() => onEdit(item)}
                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/50 rounded transition-colors cursor-pointer" 
                title="Sửa từ khóa này trực tiếp"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: 'Xóa mục từ điển',
                    message: `Bạn có chắc chắn muốn xóa thuật ngữ "${item.chinese}" khỏi từ điển?`,
                    confirmText: 'Xác nhận xóa',
                    cancelText: 'Hủy',
                    type: 'danger'
                  });
                  if (confirmed) {
                    onDelete(item.id);
                  }
                }}
                className="p-1 text-slate-400 hover:text-rose-450 hover:bg-rose-950/40 rounded transition-colors cursor-pointer" 
                title="Xóa từ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export interface GlossaryTableProps {
  filteredGlossary: GlossaryItem[];
  selectedItem: GlossaryItem | null;
  handleSelectItem: (item: GlossaryItem) => void;
  editingId: string | null;
  startEdit: (item: GlossaryItem) => void;
  cancelEdit: () => void;
  saveEdit: (id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => void;
  onDeleteGlossaryItem: (id: string) => void;
  getOriginBadge: (origin?: string) => React.ReactNode;
  getBadgeColor: (type: GlossaryType) => string;
  getTypeName: (type: GlossaryType) => string;
  pageSize: number | 'all';
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export const GlossaryTable = React.memo(function GlossaryTable({
  filteredGlossary,
  selectedItem,
  handleSelectItem,
  editingId,
  startEdit,
  cancelEdit,
  saveEdit,
  onDeleteGlossaryItem,
  getOriginBadge,
  getBadgeColor,
  getTypeName,
  pageSize,
  currentPage,
  setCurrentPage,
}: GlossaryTableProps) {
  const containerHeight = 550;
  const itemHeight = 56;

  const totalItems = filteredGlossary.length;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);

  const [pageInput, setPageInput] = useState(safeCurrentPage.toString());

  useEffect(() => {
    setPageInput(safeCurrentPage.toString());
  }, [safeCurrentPage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = () => {
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
    } else {
      setPageInput(safeCurrentPage.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredGlossary;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredGlossary.slice(start, start + pageSize);
  }, [filteredGlossary, pageSize, safeCurrentPage]);

  const activeContainerHeight = pageSize === 'all'
    ? containerHeight
    : Math.min(containerHeight, Math.max(120, paginatedItems.length * itemHeight));

  // Use list virtualization hook
  const { visibleItems, totalHeight, onScroll } = useVirtualList<GlossaryItem>({
    items: paginatedItems,
    itemHeight,
    containerHeight: activeContainerHeight,
    overscan: 10,
  });

  const getPageRange = () => {
    const range = [];
    const maxButtons = 5;
    let start = Math.max(1, safeCurrentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg overflow-hidden shadow-2xs">
      {filteredGlossary.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs italic">
          Không tìm thấy từ điển nào khớp với tiêu chuẩn tìm kiếm của bạn. Hãy tạo mới ở nút góc trên!
        </div>
      ) : (
        <div className="w-full text-left">
          {/* Header Row */}
          <div className="bg-slate-950/60 border-b border-slate-800 grid grid-cols-12 items-center font-bold uppercase tracking-wider text-slate-400 text-[10px] py-2.5">
            <div className="col-span-3 px-3">Chữ Trung (Gốc)</div>
            <div className="col-span-2 px-3">Phiên âm</div>
            <div className="col-span-3 px-3">Bản dịch Việt</div>
            <div className="col-span-2 px-3">Phân loại</div>
            <div className="col-span-1 px-3">Ngày thêm</div>
            <div className="col-span-1 px-3 text-center">Thao tác</div>
          </div>

          {/* Virtualized scroll body */}
          <div 
            className="overflow-y-auto" 
            key={`${currentPage}-${pageSize}`}
            style={{ height: `${activeContainerHeight}px` }}
            onScroll={onScroll}
          >
            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
              {visibleItems.map(({ item, index, style }) => (
                <GlossaryTableRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  isEditing={editingId === item.id}
                  onSelect={handleSelectItem}
                  onEdit={startEdit}
                  onDelete={onDeleteGlossaryItem}
                  onSave={saveEdit}
                  onCancelEdit={cancelEdit}
                  getOriginBadge={getOriginBadge}
                  getBadgeColor={getBadgeColor}
                  getTypeName={getTypeName}
                  style={style}
                />
              ))}
            </div>
          </div>

          {/* Pagination and count stats at bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-955/20 bg-slate-950/30 text-xs">
            <span className="text-slate-450 font-sans">
              {pageSize === 'all' ? (
                <>
                  Hiển thị toàn bộ <strong className="text-slate-200">{totalItems}</strong> thuật ngữ trong danh sách ảo hóa.
                </>
              ) : (
                <>
                  Hiển thị từ <strong className="text-slate-200">{Math.min(totalItems, (safeCurrentPage - 1) * pageSize + 1)}</strong> đến{' '}
                  <strong className="text-slate-200">{Math.min(totalItems, safeCurrentPage * pageSize)}</strong> trong tổng số{' '}
                  <strong className="text-slate-200">{totalItems}</strong> thuật ngữ.
                </>
              )}
            </span>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-350 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Đầu
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-350 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Trước
                  </button>

                  {getPageRange().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                        safeCurrentPage === pageNum
                          ? 'bg-indigo-650 border-indigo-600 text-white'
                          : 'bg-slate-950 border border-slate-800 text-slate-350 hover:bg-slate-850'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-350 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Sau
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-350 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Cuối
                  </button>
                </div>

                <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2 ml-1 text-slate-450 font-sans text-[11px]">
                  <span>Đi đến:</span>
                  <input
                    type="text"
                    value={pageInput}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={handlePageInputSubmit}
                    className="w-10 px-1 py-0.5 text-center bg-slate-950 border border-slate-750/80 rounded font-bold text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <span>/ {totalPages}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
