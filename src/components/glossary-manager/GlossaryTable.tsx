import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { GlossaryItem, GlossaryType } from '../../types';
import { useVirtualList } from '../../hooks/useVirtualList';
import { useNotifications } from '../NotificationSystem';
import { SealStamp } from '../SealStamp';

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
      className="col-span-12 grid grid-cols-12 gap-2 items-center px-3 h-full bg-parchment-2 border-b border-parchment-2" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="col-span-3">
        <input 
          type="text" 
          value={chinese} 
          onChange={(e) => setChinese(e.target.value)}
          className="w-full px-2 py-0.5 text-text-main bg-ink border border-parchment-2 rounded-[2px] text-xs font-serif focus:outline-none focus:border-polish" 
        />
      </div>
      <div className="col-span-2">
        <input 
          type="text" 
          value={pinyin} 
          onChange={(e) => setPinyin(e.target.value)}
          className="w-full px-2 py-0.5 text-text-main bg-ink border border-parchment-2 rounded-[2px] text-xs focus:outline-none focus:border-polish" 
        />
      </div>
      <div className="col-span-3">
        <input 
          type="text" 
          value={vietnamese} 
          onChange={(e) => setVietnamese(e.target.value)}
          className="w-full px-2 py-0.5 text-text-main bg-ink border border-parchment-2 rounded-[2px] text-xs focus:outline-none focus:border-polish" 
        />
      </div>
      <div className="col-span-2">
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as GlossaryType)}
          className="w-full px-1 py-0.5 text-text-main bg-ink border border-parchment-2 rounded-[2px] text-xs focus:outline-none cursor-pointer"
        >
          <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
          <option value="location" className="bg-parchment text-text-main">Địa danh</option>
          <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
          <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
          <option value="other" className="bg-parchment text-text-main">Khác</option>
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
          className="p-1 bg-polish text-white hover:bg-[#A03522] rounded-[2px] transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={onCancel}
          className="p-1 bg-ink text-text-muted hover:text-text-main rounded-[2px] transition-colors cursor-pointer border border-parchment-2"
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
      className={`grid grid-cols-12 items-center border-b border-parchment-2 transition-colors cursor-pointer select-none text-xs hover:bg-parchment-2/50 ${
        isSelected ? 'bg-parchment-2 border-l-4 border-polish' : ''
      }`}
    >
      {isEditing ? (
        <InlineEditRow item={item} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <>
          <div className="col-span-3 px-3 py-2.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-text-main font-serif tracking-wide hover:underline truncate">
                {item.chinese}
              </span>
              {(item.origin === 'guideline' || item.origin === 'manual') && (
                <SealStamp character="確" className="shrink-0" />
              )}
            </div>
            <div className="mt-1">{getOriginBadge(item.origin)}</div>
          </div>
          
          <div className="col-span-2 px-3 py-2.5 text-text-muted truncate">{item.pinyin}</div>
          
          <div className="col-span-3 px-3 py-2.5 text-text-main font-bold border-l border-parchment-2 truncate">
            {item.vietnamese}
          </div>
          
          <div className="col-span-2 px-3 py-2.5 truncate">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold border ${getBadgeColor(item.type)}`}>
              {getTypeName(item.type)}
            </span>
          </div>
          
          <div className="col-span-1 px-3 py-2.5 whitespace-nowrap text-text-muted font-sans text-[11px]">
            {item.createdAt ? (
              <span className="font-semibold text-text-muted">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
            ) : (
              <span className="text-text-muted opacity-50 italic">--</span>
            )}
          </div>
          
          <div className="col-span-1 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <button 
                onClick={() => onEdit(item)}
                className="p-1 text-text-muted hover:text-text-main hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer" 
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
                className="p-1 text-text-muted hover:text-rose-400 hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer" 
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
    <div className="bg-parchment border border-parchment-2 rounded-md overflow-hidden shadow-xs">
      {filteredGlossary.length === 0 ? (
        <div className="p-6 text-center text-text-muted text-xs italic">
          Không tìm thấy từ điển nào khớp với tiêu chuẩn tìm kiếm của bạn. Hãy tạo mới ở nút góc trên!
        </div>
      ) : (
        <div className="w-full text-left">
          {/* Header Row */}
          <div className="bg-ink border-b border-parchment-2 grid grid-cols-12 items-center font-bold uppercase tracking-wider text-text-muted text-[10px] py-2.5">
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
              {visibleItems.map(({ item, style }) => (
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-parchment-2 bg-ink/40 text-xs">
            <span className="text-text-muted font-sans">
              {pageSize === 'all' ? (
                <>
                  Hiển thị toàn bộ <strong className="text-text-main">{totalItems}</strong> thuật ngữ trong danh sách ảo hóa.
                </>
              ) : (
                <>
                  Hiển thị từ <strong className="text-text-main">{Math.min(totalItems, (safeCurrentPage - 1) * pageSize + 1)}</strong> đến{' '}
                  <strong className="text-text-main">{Math.min(totalItems, safeCurrentPage * pageSize)}</strong> trong tổng số{' '}
                  <strong className="text-text-main">{totalItems}</strong> thuật ngữ.
                </>
              )}
            </span>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="px-2 py-1 rounded-[2px] bg-ink border border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Đầu
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    className="px-2 py-1 rounded-[2px] bg-ink border border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Trước
                  </button>

                  {getPageRange().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 py-1 rounded-[2px] border text-[11px] font-semibold transition-colors cursor-pointer ${
                        safeCurrentPage === pageNum
                          ? 'bg-polish border-polish text-white shadow-xs'
                          : 'bg-ink border border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="px-2 py-1 rounded-[2px] bg-ink border border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Sau
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="px-2 py-1 rounded-[2px] bg-ink border border-parchment-2 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    Cuối
                  </button>
                </div>

                <div className="flex items-center gap-1.5 border-l border-parchment-2 pl-2 ml-1 text-text-muted font-sans text-[11px]">
                  <span>Đi đến:</span>
                  <input
                    type="text"
                    value={pageInput}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={handlePageInputSubmit}
                    className="w-10 px-1 py-0.5 text-center bg-ink border border-parchment-2 rounded-[2px] font-bold text-text-main text-[11px] focus:outline-none focus:border-polish transition-colors"
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
