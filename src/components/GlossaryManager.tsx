import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue, startTransition } from 'react';
import { GlossaryItem, GlossaryType, PendingGlossaryItem, Chapter } from '../types';
import {
  Plus, Trash2, Edit2, Check, X, Search, Sparkles, Filter, Info,
  ChevronRight, BookOpen, FileText, AlertCircle, Save, Hash,
  UploadCloud, AlertTriangle, CheckCircle, Download, Link2, Calendar
} from 'lucide-react';

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

interface DuplicateGroupEdit {
  groupId: string;
  reason: string;
  items: GlossaryItem[];
}

function computeDuplicateGroups(glossary: GlossaryItem[], projectId: string = ''): DuplicateGroupEdit[] {
  const n = glossary.length;
  if (n < 2) return [];

  // Đọc danh sách các cặp ID trùng lặp được phép giữ nguyên từ localStorage
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

  // Gom index theo khóa (chinese / vietnamese đã chuẩn hóa) bằng Map — O(n),
  // thay vì so n² cặp. Hai từ chỉ có thể trùng nếu rơi vào CÙNG một bucket,
  // nên chỉ cần xử lý pairwise NỘI BỘ trong từng bucket (thường rất nhỏ).
  function buildBuckets(keys: string[]): Map<string, number[]> {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = keys[i];
      if (!key) continue; // bỏ qua chuỗi rỗng, không tính là "trùng"
      const arr = buckets.get(key);
      if (arr) arr.push(i); else buckets.set(key, [i]);
    }
    return buckets;
  }

  const chBuckets = buildBuckets(cleanCh);
  const viBuckets = buildBuckets(cleanVi);

  // Union các index trong cùng bucket (kích thước bucket thường chỉ 2-3,
  // nên pairwise ở đây gần như không tốn gì so với n² ban đầu)
  function unionBuckets(buckets: Map<string, number[]>) {
    buckets.forEach((indices) => {
      if (indices.length < 2) return;
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const i = indices[a], j = indices[b];
          // Chỉ build pairKey + tra ignoredPairs cho cặp ĐÃ XÁC NHẬN trùng khóa
          const idI = glossary[i].id, idJ = glossary[j].id;
          if (ignoredPairs.has(`${idI}-${idJ}`) || ignoredPairs.has(`${idJ}-${idI}`)) continue;
          union(i, j);
        }
      }
    });
  }

  unionBuckets(chBuckets);
  unionBuckets(viBuckets);

  // Đánh dấu O(1) những index thuộc bucket có >1 phần tử, dùng để suy ra
  // "reason" của nhóm cuối mà không cần so lại pairwise (tránh O(group²))
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
// ========= THÊM COMPONENT NÀY TRƯỚC export default GlossaryManager =========
interface InlineEditRowProps {
  item: GlossaryItem;
  onSave: (id: string, chinese: string, pinyin: string, vietnamese: string, type: GlossaryType, note: string) => void;
  onCancel: () => void;
}

const InlineEditRow = React.memo(function InlineEditRow({ item, onSave, onCancel }: InlineEditRowProps) {
  const [chinese, setChinese] = useState(item.chinese);
  const [pinyin, setPinyin] = useState(item.pinyin);
  const [vietnamese, setVietnamese] = useState(item.vietnamese);
  const [type, setType] = useState<GlossaryType>(item.type);
  const [note, setNote] = useState(item.note);

  return (
      <td colSpan={6} className="p-3" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 font-sans">Chữ Trung</label>
            <input type="text" value={chinese} onChange={(e) => setChinese(e.target.value)}
                   className="w-full px-2 py-1 text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400">Phiên âm</label>
            <input type="text" value={pinyin} onChange={(e) => setPinyin(e.target.value)}
                   className="w-full px-2 py-1 text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400">Bản dịch Việt</label>
            <input type="text" value={vietnamese} onChange={(e) => setVietnamese(e.target.value)}
                   className="w-full px-2 py-1 text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400">Phân loại</label>
            <select value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                    className="w-full px-1.5 py-1 text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none">
              <option value="character">Nhân vật</option>
              <option value="location">Địa danh</option>
              <option value="term">Bí kíp/Vật phẩm</option>
              <option value="phrase">Thành ngữ</option>
              <option value="other">Thuật ngữ khác</option>
            </select>
          </div>
          <div className="flex gap-1 justify-end">
            <button onClick={() => {
              if (!chinese.trim() || !vietnamese.trim()) {
                alert("Vui lòng nhập đầy đủ tiếng Trung gốc và dịch tiếng Việt.");
                return;
              }
              onSave(item.id, chinese.trim(), pinyin.trim() || vietnamese.trim(), vietnamese.trim(), type, note.trim());
            }}
                    className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-colors cursor-pointer">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancel}
                    className="p-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-400">
          <span>Ghi chú: </span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="Ghi chú thêm..."
                 className="w-full mt-1 px-2 py-1 text-slate-800 bg-white border border-slate-200 rounded text-xs focus:outline-none" />
        </div>
      </td>
  );
});
// ========= KẾT THÚC COMPONENT THÊM MỚI =========
// ========= THÊM COMPONENT NÀY NGAY SAU InlineEditRow =========
interface DetailEditPanelProps {
  item: GlossaryItem;
  onSave: (updated: GlossaryItem) => void;
}

const DetailEditPanel = React.memo(function DetailEditPanel({ item, onSave }: DetailEditPanelProps) {
  const [chinese, setChinese]       = useState(item.chinese);
  const [pinyin, setPinyin]         = useState(item.pinyin);
  const [vietnamese, setVietnamese] = useState(item.vietnamese);
  const [type, setType]             = useState<GlossaryType>(item.type);
  const [note, setNote]             = useState(item.note);

  const handleSave = () => {
    if (!chinese.trim() || !vietnamese.trim()) {
      alert("Vui lòng nhập đầy đủ tiếng Trung gốc và dịch tiếng Việt.");
      return;
    }
    onSave({
      ...item,
      chinese:     chinese.trim(),
      pinyin:      pinyin.trim() || vietnamese.trim(),
      vietnamese:  vietnamese.trim(),
      type,
      note:        note.trim(),
    });
  };

  return (
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <Edit2 className="w-3.5 h-3.5 text-indigo-650" /> Chỉnh sửa nhanh thuật ngữ
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400">Chữ gốc Trung</label>
            <input type="text" value={chinese} onChange={(e) => setChinese(e.target.value)}
                   className="w-full text-xs font-bold font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 font-sans">Phiên âm</label>
            <input type="text" value={pinyin} onChange={(e) => setPinyin(e.target.value)}
                   className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400">Bản dịch Việt</label>
            <input type="text" value={vietnamese} onChange={(e) => setVietnamese(e.target.value)}
                   className="w-full text-xs font-bold bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400">Phân loại</label>
            <select value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                    className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer text-slate-800">
              <option value="character">Nhân vật</option>
              <option value="location">Địa danh</option>
              <option value="term">Bí kíp/Vật phẩm</option>
              <option value="phrase">Thành ngữ</option>
              <option value="other">Thuật ngữ khác</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400 font-sans">Chỉ dẫn ngữ cảnh AI / Ghi chú xưng hô</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600 resize-none"
                    placeholder="Xưng hô bá đạo, nàng, phu nhân..." />
        </div>

        <button type="button" onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
          <Save className="w-3.5 h-3.5" />
          Cập nhật thay đổi từ khóa
        </button>
      </div>
  );
});
// ========= KẾT THÚC DetailEditPanel =========

// ========= THÊM COMPONENT AddGlossaryForm =========
interface AddGlossaryFormProps {
  onSave: (item: { chinese: string; pinyin: string; vietnamese: string; type: GlossaryType; note: string }) => void;
  onCancel: () => void;
}

const AddGlossaryForm = React.memo(function AddGlossaryForm({ onSave, onCancel }: AddGlossaryFormProps) {
  const [chinese,    setChinese]    = useState('');
  const [pinyin,     setPinyin]     = useState('');
  const [vietnamese, setVietnamese] = useState('');
  const [type,       setType]       = useState<GlossaryType>('character');
  const [note,       setNote]       = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chinese.trim() || !vietnamese.trim()) {
      alert("Vui lòng nhập từ gốc tiếng Trung và bản dịch tiếng Việt.");
      return;
    }
    onSave({ chinese, pinyin, vietnamese, type, note });
  };

  return (
    <form id="form-add-glossary" onSubmit={handleSubmit} className="bg-slate-100/60 p-4 border border-slate-200 rounded-xl space-y-3">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thêm từ khóa mới bằng tay</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Gốc tiếng Trung *</label>
          <input id="input-chinese-new" type="text" placeholder="Ví dụ: 萧炎" value={chinese}
                 onChange={(e) => setChinese(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" required />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phiên âm Hán Việt</label>
          <input id="input-pinyin-new" type="text" placeholder="Ví dụ: Tiêu Viêm" value={pinyin}
                 onChange={(e) => setPinyin(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Bản dịch tiếng Việt *</label>
          <input id="input-vietnamese-new" type="text" placeholder="Ví dụ: Tiêu Viêm" value={vietnamese}
                 onChange={(e) => setVietnamese(e.target.value)}
                 className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" required />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phân loại</label>
          <select id="select-type-new" value={type} onChange={(e) => setType(e.target.value as GlossaryType)}
                  className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600">
            <option value="character">Nhân vật</option>
            <option value="location">Địa danh</option>
            <option value="term">Bí kíp / Vật phẩm</option>
            <option value="phrase">Thành ngữ / Cụm từ</option>
            <option value="other">Thuật ngữ khác</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ghi chú ngữ cảnh (Hướng dẫn AI xưng hô, đại từ đúng đắn)</label>
        <input id="input-note-new" type="text"
               placeholder="Ví dụ: Nam chính, sư phụ, nhân vật nữ kêu bằng nàng, có xưng hô bá đạo..."
               value={note} onChange={(e) => setNote(e.target.value)}
               className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button id="btn-cancel-add" type="button" onClick={onCancel}
                className="px-2.5 py-1 text-xs font-bold text-slate-650 hover:bg-slate-200 rounded transition-colors">
          Hủy
        </button>
        <button id="btn-save-add" type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1 text-xs font-bold rounded transition-colors">
          Lưu từ điển
        </button>
      </div>
    </form>
  );
});
// ========= KẾT THÚC AddGlossaryForm =========

// ========= GlossaryTableRow: React.memo — chỉ re-render khi isSelected / isEditing thay đổi =========
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
}

const GlossaryTableRow = React.memo(function GlossaryTableRow({
  item, isSelected, isEditing, onSelect, onEdit, onDelete, onSave, onCancelEdit,
  getOriginBadge, getBadgeColor, getTypeName,
}: GlossaryTableRowProps) {
  return (
    <tr
      onClick={() => onSelect(item)}
      className={`transition-colors cursor-pointer select-none relative ${
        isSelected ? 'bg-indigo-50 border-l-4 border-indigo-650' : 'hover:bg-slate-50/50'
      }`}
    >
      {isEditing ? (
        <InlineEditRow item={item} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <>
          <td className="px-3 py-2.5">
            <span className="font-bold text-slate-900 font-mono tracking-wide block hover:underline">
              {item.chinese}
            </span>
            <div className="mt-1">{getOriginBadge(item.origin)}</div>
          </td>
          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{item.pinyin}</td>
          <td className="px-3 py-2.5 text-indigo-950 font-bold bg-indigo-50/10 border-l-2 border-indigo-505">
            {item.vietnamese}
          </td>
          <td className="px-3 py-2.5 whitespace-nowrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getBadgeColor(item.type)}`}>
              {getTypeName(item.type)}
            </span>
          </td>
          <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 font-sans text-[11px]">
            {item.createdAt ? (
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-slate-700">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ) : (
              <span className="text-slate-300 italic">--</span>
            )}
          </td>
          <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => onEdit(item)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded transition-colors cursor-pointer" title="Sửa từ khóa này trực tiếp">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer" title="Xóa từ">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </>
      )}
    </tr>
  );
});
// ========= KẾT THÚC GlossaryTableRow =========

// ========= DuplicateGroupCard: React.memo — chỉ nhóm đang được sửa mới re-render =========
// Trước đây toàn bộ danh sách "duplicateGroups" (có thể 30+ nhóm) được render
// trực tiếp bằng .map() ngay trong GlossaryManager. Gõ 1 ký tự ở BẤT KỲ ô input
// nào trong BẤT KỲ nhóm nào cũng khiến state `duplicateGroups` đổi reference,
// kéo theo GlossaryManager re-render và React phải dựng lại TOÀN BỘ 30 nhóm.
// Tách thành component riêng + React.memo: chỉ nhóm có item bị sửa mới
// re-render, các nhóm còn lại được bỏ qua hoàn toàn.
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
  // Trạng thái "đang xem ngữ cảnh" giờ CỤC BỘ trong từng card — mở ngữ cảnh ở
  // nhóm này không còn buộc các nhóm khác phải re-render theo như trước đây.
  const [expandedContextIds, setExpandedContextIds] = useState<Set<string>>(new Set());
  const toggleContext = useCallback((itemId: string) => {
    setExpandedContextIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  return (
    <div className="bg-white border border-violet-200 rounded-xl overflow-hidden shadow-xs hover:border-violet-300 transition-colors">
      <div className="flex items-center justify-between bg-violet-50 border-b border-violet-100 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-bold text-violet-900 uppercase tracking-wider">
            {group.reason}
          </span>
          <span className="text-[10px] text-violet-500 font-semibold">
            ({group.items.length} từ liên quan)
          </span>
        </div>
        <button
            onClick={() => onConfirm(group.groupId)}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
            title="Lưu tất cả thay đổi và đóng nhóm này"
        >
          <Check className="w-3.5 h-3.5" />
          Xác nhận & đóng
        </button>
        <button
            onClick={() => onIgnore(group.groupId)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer shadow-xs border border-slate-300"
            title="Giữ cả hai từ, không hỏi lại ở lần quét tiếp theo"
        >
          <X className="w-3.5 h-3.5" />
          Giữ cả hai (bỏ qua vĩnh viễn)
        </button>
      </div>

      <div className="divide-y divide-violet-50">
        {group.items.map((item, itemIdx) => (
            <div
                key={item.id}
                className="p-3 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-violet-50/30 transition-colors"
            >
              <div className="flex flex-col gap-1.5 shrink-0 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-violet-100 text-violet-700 font-extrabold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                    {itemIdx + 1}
                  </span>
                  {getOriginBadge(item.origin)}
                </div>

                {item.origin === 'scanned' && (
                    <div className="space-y-1.5">
                      <button
                          onClick={() => toggleContext(item.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        <Search className="w-3 h-3" />
                        {expandedContextIds.has(item.id) ? 'Ẩn ngữ cảnh' : 'Xem ngữ cảnh'}
                      </button>

                      {item.sourceChapter && (
                          <div className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 truncate max-w-[200px]" title={item.sourceChapter}>
                            📖 {item.sourceChapter}
                          </div>
                      )}

                      {expandedContextIds.has(item.id) && (() => {
                        const hits = findLiveContext(item.chinese);
                        if (hits.length === 0) return (
                            <p className="text-[10px] text-slate-400 italic">Không tìm thấy đoạn văn chứa từ này.</p>
                        );
                        return (
                            <div className="space-y-2 max-w-[300px]">
                              {hits.map((hit, hi) => (
                                  <div key={hi} className="bg-white border border-amber-200 rounded-md p-2 space-y-1">
                                    <div className="text-[9px] font-extrabold text-amber-700 uppercase truncate">{hit.chapterTitle}</div>
                                    <div className="text-[10px] text-slate-700 font-mono leading-tight bg-slate-50 rounded px-1.5 py-1 border border-slate-100 line-clamp-2" title={hit.sourceLine}>
                                      {hit.sourceLine}
                                    </div>
                                    {hit.translationLine && (
                                        <div className="text-[10px] text-indigo-700 leading-tight italic line-clamp-2" title={hit.translationLine}>
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
                  <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tiếng Trung *</span>
                  <input
                      type="text"
                      value={item.chinese}
                      onChange={(e) => onUpdateItem(group.groupId, item.id, 'chinese', e.target.value)}
                      className="w-full text-xs font-bold font-mono bg-white border border-violet-200 focus:border-violet-500 rounded px-2 py-1.5 text-slate-800 outline-none transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Dịch Việt *</span>
                  <input
                      type="text"
                      value={item.vietnamese}
                      onChange={(e) => onUpdateItem(group.groupId, item.id, 'vietnamese', e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-violet-200 focus:border-violet-500 rounded px-2 py-1.5 text-indigo-950 outline-none transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phiên âm</span>
                  <input
                      type="text"
                      value={item.pinyin}
                      onChange={(e) => onUpdateItem(group.groupId, item.id, 'pinyin', e.target.value)}
                      className="w-full text-xs bg-white border border-violet-200 focus:border-violet-500 rounded px-2 py-1.5 text-slate-700 outline-none transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Ghi chú</span>
                  <input
                      type="text"
                      value={item.note}
                      placeholder="Ghi chú vai trò..."
                      onChange={(e) => onUpdateItem(group.groupId, item.id, 'note', e.target.value)}
                      className="w-full text-xs bg-white border border-violet-200 focus:border-violet-500 rounded px-2 py-1.5 text-slate-700 outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                  onClick={() => onDeleteItem(group.groupId, item.id)}
                  className="self-center sm:self-start mt-3 sm:mt-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
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
// ========= KẾT THÚC DuplicateGroupCard =========

function GlossaryManager({
                                          glossary,
                                          pendingGlossary = [],
                                          chapters = [],
                                          apiKeys = [],
                                          selectedModel = 'gemini-2.5-flash',
                                          onAddGlossaryItem,
                                          onAddGlossaryItems,
                                          onUpdateGlossaryItem,
                                          onDeleteGlossaryItem,
                                          onAddToPending,
                                          onConfirmPending,
                                          onDiscardPending,
                                        }: GlossaryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [searchDate, setSearchDate] = useState<string>(''); // Khởi tạo state tìm kiếm theo ngày

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

  // Ref giữ giá trị mới nhất của duplicateGroups — dùng trong các handler
  // (handleConfirmDupGroup/handleIgnoreDupGroup) để các hàm này có thể bọc
  // useCallback với deps RỖNG, không bị tạo lại mỗi khi người dùng gõ phím
  // trong panel (vốn liên tục đổi `duplicateGroups`). Nhờ vậy props truyền
  // xuống <DuplicateGroupCard> (đã bọc React.memo) luôn ổn định.
  const duplicateGroupsRef = useRef(duplicateGroups);
  useEffect(() => { duplicateGroupsRef.current = duplicateGroups; }, [duplicateGroups]);

  const handleOpenDuplicatePanel = () => {
    const projectId = chapters?.[0]?.id || 'default_project';
    // Mở panel ngay (hiện loading), tính toán O(n²) trong startTransition — không block UI
    setShowDuplicatePanel(true);
    setDuplicateGroups([]);
    startTransition(() => {
      const groups = computeDuplicateGroups(glossary, projectId);
      setDuplicateGroups(groups);
      if (groups.length === 0) {
        alert('Tuyệt vời! Không tìm thấy từ ngữ nào bị trùng lặp trong từ điển của bạn.');
        setShowDuplicatePanel(false);
      }
    });
  };

  // useCallback deps rỗng: chỉ dùng setState dạng functional, không đọc
  // duplicateGroups qua closure → reference không đổi khi gõ phím.
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

    for (const chap of chapters) {   // ← chapters prop truy cập được ở đây
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

    const projectId = chapters?.[0]?.id || 'default_project';
    const ignoreKey = `ignored_dups_${projectId}`;
    const ignoredPairs = JSON.parse(localStorage.getItem(ignoreKey) || '[]');

    // Thêm tổ hợp ID của các từ trong nhóm này vào danh sách loại trừ
    for (let i = 0; i < group.items.length; i++) {
      for (let j = i + 1; j < group.items.length; j++) {
        ignoredPairs.push(`${group.items[i].id}-${group.items[j].id}`);
      }
    }

    localStorage.setItem(ignoreKey, JSON.stringify(ignoredPairs));
    // Cập nhật lại giao diện, xóa nhóm này khỏi danh sách hiển thị tạm thời
    setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, [chapters]);

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
    // scanOccurrences runs in useEffect below — không block UI khi click
  }, []);

  const handleDetailSave = useCallback((updated: GlossaryItem) => {
    onUpdateGlossaryItem(updated.id, updated);
    setSelectedItem(updated);
    // scanOccurrences chạy tự động qua useEffect khi selectedItem thay đổi
  }, [onUpdateGlossaryItem]);



  // Tất cả scanOccurrences đều chạy ở đây — SAU khi React vẽ xong UI
  // Nhờ vậy click chọn item không bị đơ: panel mở ngay, kết quả scan load sau
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
    }
  };

  const handleAcceptReviewItem = (reviewId: string) => {
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
  };

  const handleDiscardReviewItem = (reviewId: string) => {
    setReviewQueue(prev => prev.filter(r => r.id !== reviewId));
  };

  const handleUpdateReviewItem = (reviewId: string, updatedFields: Partial<GlossaryItem>) => {
    setReviewQueue(prev => prev.map(r => {
      if (r.id === reviewId) {
        return { ...r, ...updatedFields };
      }
      return r;
    }));
  };

  const exportGlossaryToMd = () => {
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
  };

  const startEdit = useCallback((item: GlossaryItem) => {
    setEditingId(item.id);
    // Không cần set các state edit nữa vì InlineEditRow tự quản lý
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
    // Dùng functional update để không cần selectedItem trong deps —
    // tránh saveEdit đổi reference mỗi khi người dùng chọn dòng khác
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
        matchesDate = item.createdAt ? item.createdAt.substring(0, 10) === searchDate : false;
      }
      return matchesSearch && matchesType && matchesOrigin && matchesDate;
    });
  }, [glossary, deferredSearchTerm, selectedType, selectedOrigin, searchDate]);

  // Reset về trang 1 khi filter thay đổi
  useEffect(() => { setCurrentPage(1); }, [deferredSearchTerm, selectedType, selectedOrigin, searchDate]);

  const totalPages = Math.max(1, Math.ceil(filteredGlossary.length / ITEMS_PER_PAGE));
  // Tự động kẹp về trang cuối hợp lệ nếu trang hiện tại đã vượt quá tổng số trang
  // (ví dụ: xóa hết các từ ở trang cuối cùng)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Chỉ render ITEMS_PER_PAGE rows thay vì toàn bộ 2319+
  const paginatedGlossary = useMemo(() =>
    filteredGlossary.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredGlossary, currentPage, ITEMS_PER_PAGE]
  );

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

  const highlightWordInText = (text: string, word: string) => {
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
  };

  const filteredMatches = useMemo(() => {
    return searchContextMatches.filter(match => {
      if (contextFilterType === 'source') return match.textType === 'source';
      if (contextFilterType === 'translation') return match.textType === 'raw' || match.textType === 'polished';
      return true;
    });
  }, [searchContextMatches, contextFilterType]);

  return (
      <div id="glossary-manager-root" className="space-y-4 animate-fadeIn">
        {/* Top Controller Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-650" />
              Từ Điển Quy Định Dự Án &amp; Kho Cẩm Nang
            </h2>
            <p className="text-xs text-slate-400">
              Khai báo thuật ngữ để AI dịch nhất quán văn phong. Hệ thống tự động ghi nhận thời gian tạo và hỗ trợ tra cứu từ vựng theo ngày.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
                id="btn-export-glossary-md"
                onClick={exportGlossaryToMd}
                disabled={glossary.length === 0}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={glossary.length === 0 ? 'Từ điển đang trống' : `Xuất ${glossary.length} thuật ngữ ra file .md`}
            >
              <Download className="w-3.5 h-3.5" />
              Xuất từ điển (.md)
            </button>

            <button
                id="btn-filter-duplicates"
                onClick={handleOpenDuplicatePanel}
                disabled={glossary.length < 2}
                className={`flex items-center gap-1.5 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    showDuplicatePanel && duplicateGroups.length > 0
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200'
                        : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
                }`}
                title="Quét và lọc các từ bị trùng tiếng Trung hoặc tiếng Việt trong từ điển"
            >
              <Link2 className="w-3.5 h-3.5" />
              Lọc từ trùng
              {showDuplicatePanel && duplicateGroups.length > 0 && (
                  <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5">
                {duplicateGroups.length}
              </span>
              )}
            </button>

            <button
                id="btn-trigger-import-md"
                onClick={() => {
                  setIsImporting(!isImporting);
                  setIsAdding(false);
                }}
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Nhập file cẩm nang (.md)
            </button>

            <button
                id="btn-trigger-add-glossary"
                onClick={() => {
                  setIsAdding(!isAdding);
                  setIsImporting(false);
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 text-xs rounded transition-colors cursor-pointer"
            >
              {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isAdding ? 'Hủy thêm mới' : 'Thêm từ mới'}
            </button>
          </div>
        </div>

        {/* File MD Guideline uploader portion */}
        {isImporting && (
            <div id="md-uploader-zone" className="bg-slate-55 border border-slate-200 p-4 rounded-xl space-y-3.5 animate-slideUp">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Đồng bộ hóa thuật ngữ từ Cẩm Nang Markdown
                  </h3>
                  <p className="text-xs text-slate-400">
                    Hãy tải lên tệp cẩm nang dịch (.md). Trí tuệ nhân tạo sẽ tự động Sàng lọc cấu trúc các bảng từ khóa, sau đó thực hiện rà soát chuyên nghiệp loại bỏ tuyệt đối các từ ngữ bị trùng khớp.
                  </p>
                </div>
                <button onClick={() => setIsImporting(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                  onClick={() => mdInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white/50 hover:bg-indigo-50/10 p-6 rounded-lg text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
              >
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-650 transition-colors" />
                <div className="text-xs font-medium text-slate-650">
                  {mdFileName ? (
                      <span className="text-indigo-750 font-bold block">{mdFileName} (Nhấp phát nữa để đổi tệp)</span>
                  ) : (
                      <span>Kéo thả tệp cẩm nang truyện (.md) tại đây hoặc <strong className="text-indigo-600">Nhấp để mở thư mục tìm kiếm</strong></span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Định dạng khuyên dùng: .md</span>
                <input type="file" accept=".md" ref={mdInputRef} onChange={handleMdImportFileChange} className="hidden" />
              </div>

              {isAnalyzingMd && (
                  <div className="flex items-center gap-2 justify-center py-2 text-indigo-700 bg-indigo-50 rounded-lg text-xs font-bold">
                    <Sparkles className="w-4 h-4 animate-spin text-indigo-650" />
                    Đang phân tích cấu trúc cẩm nang bằng AI... Vui lòng chờ một đến hai giây.
                  </div>
              )}
            </div>
        )}

        {/* Add Form */}
        {isAdding && (
            <AddGlossaryForm
                onSave={handleAddFormSave}
                onCancel={() => setIsAdding(false)}
            />
        )}

        {/* Pending Review Queue Section for filtered out items */}
        {reviewQueue.length > 0 && (
            <div id="review-queue-section" className="bg-amber-50/50 border-2 border-amber-300 rounded-xl p-4 md:p-5 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Mục Rà Soát Từ Trùng Lặp / Lặp Nghĩa ({reviewQueue.length} từ cần xử lý)
                    </h4>
                    <p className="text-[11px] text-amber-700">
                      Những từ khóa này đã bị chặn khỏi việc nạp rộng rãi do trùng nghĩa hoặc trùng lặp giữa các dòng. Hãy tùy chỉnh rồi ấn Xác nhận!
                    </p>
                  </div>
                </div>
                <button
                    onClick={() => {
                      if (window.confirm("Bạn có tin chắc muốn loại bỏ hoàn toàn danh sách rà soát trùng lặp này?")) {
                        setReviewQueue([]);
                      }
                    }}
                    className="bg-rose-100 hover:bg-rose-250 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Bỏ qua tất cả
                </button>
              </div>

              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {reviewQueue.map((item) => (
                    <div key={item.id}
                         className="bg-white border border-amber-200 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-amber-300 transition-colors">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-900 bg-amber-100/60 px-2.5 py-1 rounded-md font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span><strong>Lọc trùng:</strong> {item.reason}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tiếng Trung *</span>
                            <input type="text" value={item.chinese} onChange={(e) => handleUpdateReviewItem(item.id, { chinese: e.target.value })}
                                   className="w-full text-xs font-bold font-mono bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-800 outline-none" />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phiên âm</span>
                            <input type="text" value={item.pinyin} onChange={(e) => handleUpdateReviewItem(item.id, { pinyin: e.target.value })}
                                   className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-800 outline-none" />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Dịch Việt *</span>
                            <input type="text" value={item.vietnamese} onChange={(e) => handleUpdateReviewItem(item.id, { vietnamese: e.target.value })}
                                   className="w-full text-xs font-bold bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-indigo-950 outline-none" />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Phân loại</span>
                            <select value={item.type} onChange={(e) => handleUpdateReviewItem(item.id, { type: e.target.value as GlossaryType })}
                                    className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-1 py-1 text-slate-700 outline-none cursor-pointer">
                              <option value="character">Nhân vật</option>
                              <option value="location">Địa danh</option>
                              <option value="term">Bí kíp/Vật phẩm</option>
                              <option value="phrase">Thành ngữ</option>
                              <option value="other">Thuật ngữ khác</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Chỉ dẫn ngữ cảnh / Vai trò</span>
                          <input type="text" placeholder="Ghi chú thêm thông tin..." value={item.note}
                                 onChange={(e) => handleUpdateReviewItem(item.id, { note: e.target.value })}
                                 className="w-full text-xs bg-amber-50/10 border border-slate-205 focus:border-amber-450 rounded px-2 py-1 text-slate-700 outline-none" />
                        </div>
                      </div>
                      <div className="flex md:flex-col gap-1.5 shrink-0 justify-end md:justify-center">
                        <button onClick={() => handleAcceptReviewItem(item.id)}
                                className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-3xs">
                          <CheckCircle className="w-3.5 h-3.5" /> Xác nhận từ
                        </button>
                        <button onClick={() => handleDiscardReviewItem(item.id)}
                                className="flex-1 md:w-32 bg-slate-100 text-slate-650 hover:bg-rose-50 hover:text-rose-700 rounded px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer">
                          <X className="w-3.5 h-3.5" /> Loại bỏ
                        </button>
                      </div>
                    </div>
                ))}
              </div>
            </div>
        )}

        {/* Duplicate Filter Panel */}
        {showDuplicatePanel && duplicateGroups.length > 0 && (
            <div id="duplicate-filter-panel" className="bg-violet-50/60 border-2 border-violet-300 rounded-xl p-4 md:p-5 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-violet-200 pb-3">
                <div className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-violet-600 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-violet-950 uppercase tracking-wider flex items-center gap-2">
                      Bảng Lọc Từ Trùng Lặp
                      <span className="bg-violet-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                    {duplicateGroups.length} nhóm
                  </span>
                    </h4>
                    <p className="text-[11px] text-violet-700 mt-0.5">
                      Mỗi thanh bên dưới chứa các từ có liên quan với nhau (trùng tiếng Trung hoặc tiếng Việt). Chỉnh sửa rồi nhấn <strong>Xác nhận</strong> để lưu và đóng thanh đó.
                    </p>
                  </div>
                </div>
                <button
                    onClick={() => { setShowDuplicatePanel(false); setDuplicateGroups([]); }}
                    className="text-violet-400 hover:text-violet-700 p-1 rounded-md hover:bg-violet-100 transition-colors cursor-pointer"
                    title="Đóng bảng lọc trùng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
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

              <div className="flex justify-end pt-1 border-t border-violet-100">
                <button
                    onClick={() => {
                      if (window.confirm(`Bạn có muốn đóng toàn bộ ${duplicateGroups.length} nhóm trùng lặp mà không lưu thay đổi?`)) {
                        setShowDuplicatePanel(false);
                        setDuplicateGroups([]);
                      }
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Đóng tất cả không lưu
                </button>

              </div>
            </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left column: Glossary catalog list */}
          <div className={`space-y-4 transition-all duration-300 ${selectedItem ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {/* Filter and Search Bar */}
            <div className="flex flex-col xl:flex-row gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-2xs">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                    id="input-search-glossary"
                    type="text"
                    placeholder="Tìm kiếm từ tiếng Trung, Hán Việt hoặc bản dịch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500 text-slate-850"
                />
              </div>

              {/* Thanh điều khiển kết hợp bộ lọc nâng cao bao gồm tìm theo Ngày nhập */}
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
              </div>
            </div>

            {/* Table Results */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              {filteredGlossary.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    Không tìm thấy từ điển nào khớp với tiêu chuẩn tìm kiếm của bạn. Hãy tạo mới ở nút góc trên!
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Chữ Trung (Gốc)</th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Phiên âm</th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Bản dịch Việt</th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Phân loại</th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Ngày thêm</th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-400 text-center w-20 text-[10px]">Thao tác</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                      {paginatedGlossary.map((item) => (
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
                          />
                      ))}
                      </tbody>
                    </table>
                    {/* Pagination bar — chỉ hiện khi có nhiều hơn 1 trang */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/60 text-xs">
                        <span className="text-slate-400 font-sans">
                          Hiển thị <strong className="text-slate-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredGlossary.length)}</strong> / {filteredGlossary.length} thuật ngữ
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer transition-colors"
                          >‹ Trước</button>
                          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            // Hiện tối đa 7 nút trang xung quanh trang hiện tại
                            let page: number;
                            if (totalPages <= 7) page = i + 1;
                            else if (currentPage <= 4) page = i + 1;
                            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                            else page = currentPage - 3 + i;
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-7 h-7 rounded border text-xs font-bold cursor-pointer transition-colors ${
                                  page === currentPage
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-slate-200 text-slate-600 hover:bg-white'
                                }`}
                              >{page}</button>
                            );
                          })}
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer transition-colors"
                          >Sau ›</button>
                        </div>
                      </div>
                    )}
                  </div>
              )}
            </div>
          </div>

          {/* Right column: Sticky Selected item details */}
          {selectedItem && (
              <div className="lg:col-span-5 bg-white border border-slate-250 rounded-xl p-5 shadow-sm space-y-5 animate-in slide-in-from-right duration-300 lg:sticky lg:top-32 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                <span className="text-[10px] bg-indigo-100 text-indigo-850 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Bảng chi tiết &amp; Tra cứu ngữ cảnh
                </span>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      {selectedItem.chinese} → {selectedItem.vietnamese}
                    </h3>
                  </div>
                  <button
                      onClick={() => setSelectedItem(null)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer" title="Đóng bảng chi tiết">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Khối hiển thị chi tiết mốc thời gian ghi nhận từ vựng */}
                <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nguồn gốc nạp:</span>
                    <span className="font-bold text-slate-700">
                  {selectedItem.origin === 'guideline' ? 'Tệp cẩm nang (.md)' : selectedItem.origin === 'scanned' ? 'AI trích xuất tự động' : 'Nhập tay thủ công'}
                </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời điểm khởi tạo:</span>
                    <span className="font-bold text-indigo-900">
                  {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('vi-VN') : 'Trước phiên bản v2.4'}
                </span>
                  </div>
                </div>

                {selectedItem.sourceChapter && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1 animate-fadeIn">
                      <div className="flex items-center gap-1.5 font-extrabold text-amber-950 uppercase tracking-wider text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Nguồn gốc trích lọc tự động từ AI Filter
                      </div>
                      <p>• <strong>Chương gốc:</strong> {selectedItem.sourceChapter}</p>
                      {selectedItem.sourceParagraph && (
                          <p className="text-slate-500 italic line-clamp-2" title={selectedItem.sourceParagraph}>
                            • <strong>Ngữ cảnh:</strong> "{selectedItem.sourceParagraph}"
                          </p>
                      )}
                    </div>
                )}

                {/* Quick Live Editor Portion inside Sidebar */}
                <DetailEditPanel
                    key={selectedItem.id}
                    item={selectedItem}
                    onSave={handleDetailSave}
                />

                {/* Context Checker / Occurrence Locator */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-150 pt-4">
                    <div className="flex items-center gap-1">
                      <Hash className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">
                    Vị trí trong các chương truyện ({searchContextMatches.length} lần xuất hiện)
                  </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400">Xem:</span>
                      <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
                        <button onClick={() => setContextFilterType('all')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'all' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}>
                          Mọi tệp
                        </button>
                        <button onClick={() => setContextFilterType('source')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'source' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}
                                title="Chỉ tìm trong chữ Trung nguyên tác gốc">
                          Bản Gốc
                        </button>
                        <button onClick={() => setContextFilterType('translation')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${contextFilterType === 'translation' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-400'}`}
                                title="Chỉ tìm trong văn bản tiếng Việt bồi dưỡng">
                          Văn Dịch
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredMatches.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs italic border border-slate-150">
                        Từ khóa '{selectedItem.chinese}' hoặc '{selectedItem.vietnamese}' chưa tìm thấy đoạn văn nào trùng khớp ở tệp sách hiện hữu.
                      </div>
                  ) : (
                      <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                        {filteredMatches.map((match, idx) => {
                          const isSource = match.textType === 'source';
                          const targetWord = isSource ? selectedItem.chinese : selectedItem.vietnamese;
                          return (
                              <div key={idx}
                                   className="p-2.5 rounded-lg border border-slate-150 hover:border-indigo-300 transition-colors text-xs space-y-1 bg-white">
                                <div className="flex items-center justify-between text-[10px]">
                          <span className="font-extrabold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[190px]" title={match.chapterTitle}>
                            {match.chapterTitle}
                          </span>
                                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                                    <span>Dòng #{match.paragraphIndex}</span>
                                    <span className={`px-1 rounded-sm text-[9px] font-bold ${
                                        match.textType === 'source' ? 'bg-rose-50 text-rose-700 font-mono' :
                                            match.textType === 'polished' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                                    }`}>
                              {match.textType === 'source' ? 'Gốc Trung' : match.textType === 'polished' ? 'Chuốt' : 'Dịch Thô'}
                            </span>
                                  </div>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-sans text-[11px] break-words italic select-text">
                                  "...{highlightWordInText(match.paragraphText, targetWord)}..."
                                </p>
                              </div>
                          );
                        })}
                      </div>
                  )}
                </div>
              </div>
          )}
        </div>

        <div className="bg-indigo-55/40 rounded-lg p-3 border border-indigo-100 flex gap-2 items-start shadow-xs">
          <Info className="w-4 h-4 text-indigo-650 mt-0.5 shrink-0" />
          <div className="text-[11px] text-indigo-900 leading-relaxed font-sans">
            <strong className="block text-indigo-950 mb-0.5">Mẹo xưng hô nhân vật linh hoạt:</strong>
            Đặc biệt đối với nhân vật nữ hoặc thầy trò quân nhân, bạn hãy điền ghi chú cột reference: <code className="bg-white/80 border border-indigo-100 px-1 rounded font-mono text-red-650 font-semibold">nhân vật nữ, kêu bằng nàng, có xưng hô đệ tử/sư tôn...</code>. AI sẽ xử lý ngữ cảnh này để cải thiện chất lượng dịch thô!
          </div>
        </div>

        {/* Pending Glossary Queue (Deduplication Verification) */}
        {pendingGlossary.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
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
                        {onConfirmPending && (
                            <button
                                onClick={() => onConfirmPending(pending.id)}
                                className="flex items-center gap-1 py-1 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold transition"
                                title="Xác nhận thêm vào từ điển">
                              <Check className="w-3 h-3" /> Xác nhận
                            </button>
                        )}
                        {onDiscardPending && (
                            <button
                                onClick={() => onDiscardPending(pending.id)}
                                className="flex items-center gap-1 py-1 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded text-xs font-semibold transition"
                                title="Loại bỏ">
                              <X className="w-3 h-3" /> Bỏ qua
                            </button>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            </div>
        )}
      </div>
  );
}

// Bọc React.memo: GlossaryManager luôn mount cùng lúc các tab khác qua class CSS,
// memo hóa để tránh re-render thừa khi đổi tab hoặc gõ phím ở component khác.
export default React.memo(GlossaryManager);
