import React from 'react';
import { Edit3, X, Check } from 'lucide-react';

export interface ProjectMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTitle: string;
  setEditTitle: (s: string) => void;
  editAuthor: string;
  setEditAuthor: (s: string) => void;
  editGenre: string;
  setEditGenre: (s: string) => void;
  editTone: string;
  setEditTone: (s: string) => void;
  editDescription: string;
  setEditDescription: (s: string) => void;
  handleSaveMetadata: (e: React.FormEvent) => void;
  importSection: React.ReactNode;
}

export const ProjectMetadataModal = React.memo(function ProjectMetadataModal({
  isOpen,
  onClose,
  editTitle,
  setEditTitle,
  editAuthor,
  setEditAuthor,
  editGenre,
  setEditGenre,
  editTone,
  setEditTone,
  editDescription,
  setEditDescription,
  handleSaveMetadata,
  importSection,
}: ProjectMetadataModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-955 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-400">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            Cấu hình &amp; Chỉnh sửa thông tin Truyện
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMetadata} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Tên tiểu thuyết / Bộ truyện dịch *</label>
              <input
                type="text"
                placeholder="Ví dụ: Đấu Phá Thương Khung, Thần Điêu Đại Hiệp..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Tác giả gốc</label>
              <input
                type="text"
                placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Ngã Thất Tây Hồng Thị..."
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                className="w-full text-xs bg-slate-955 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Thể loại chính</label>
              <select
                value={editGenre}
                onChange={(e) => setEditGenre(e.target.value)}
                className="w-full text-xs bg-slate-955 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Tiên Hiệp">Tiên Hiệp (Giả tưởng bay bổng, tu tiên, tiên giới)</option>
                <option value="Võ Hiệp">Võ Hiệp (Kiếm hiệp truyền thống, ân oán giang hồ)</option>
                <option value="Ngôn Tình">Ngôn Tình (Tình cảm lãng mạn lôi cuốn)</option>
                <option value="Đô Thị">Đô Thị (Thời hiện đại, thương trường, cuộc sống)</option>
                <option value="Huyền Huyễn">Huyền Huyễn (Lịch sử giả tưởng kỳ ảo)</option>
                <option value="Huyền Huyễn Phương Tây">Huyền Huyễn Phương Tây (Hiệp sĩ, ma pháp, rồng, ma quỷ phương Tây)</option>
                <option value="Vô Hạn Lưu">Vô Hạn Lưu (Sinh tồn, luân hồi, nhiệm vụ phó bản nghẹt thở)</option>
                <option value="Lịch Sử / Quân Sự">Lịch Sử / Quân Sự (Dã sử, quân triều, binh pháp chiến tranh)</option>
                <option value="Khoa Huyễn / Võng Du">Khoa Huyễn / Võng Du (Khoa học viễn tưởng, thế giới game ảo, cơ giáp)</option>
                <option value="Linh Dị / Thần Quái">Linh Dị / Thần Quái (Kinh dị tâm linh, ma quỷ kỳ bí, trinh thám u ám)</option>
                <option value="Hệ Thống / Điền Văn">Hệ Thống / Điền Văn (Sinh hoạt gia đình, làm ruộng điền viên nhẹ nhàng)</option>
                <option value="Khác">Thể loại khác</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Tông giọng biên dịch &amp; Biên tập</label>
              <select
                value={editTone}
                onChange={(e) => setEditTone(e.target.value)}
                className="w-full text-xs bg-slate-955 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Dịch thuần Việt mượt mà">Thuần Việt mượt mà (Ưu tiên câu từ lưu loát tự nhiên Việt Nam)</option>
                <option value="Trang nghiêm cổ phong">Cổ phong trang nghiêm (Từ ngữ đậm chất Hán Việt, sang quý)</option>
                <option value="Bình dị dân dã">Bình dị đời thường (Từ ngữ đơn giản mộc mạc phong vị đời thật)</option>
                <option value="Hùng tráng dồn dập">Hùng tráng dập dồn (Thích hợp truyện võ đấu, kịch tính nhiệt huyết)</option>
                <option value="Trầm hùng dã sử">Trầm hùng dã sử (Trang nghiêm sử thi, thích hợp quân sự lịch sử)</option>
                <option value="Hiện đại công nghệ">Hiện đại công nghệ (Thuật ngữ viễn tưởng số hóa, hiện đại)</option>
                <option value="Kịch tính ly kỳ">Kịch tính ly kỳ (Gợi cảm giác hồi hộp, u ám tâm linh)</option>
                <option value="Nhẹ nhàng điền văn">Nhẹ nhàng điền văn (Lối kể mộc mạc ấm áp, đời thường chậm rãi)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-slate-400">Giới thiệu tóm tắt / Quy tắc dịch</label>
            <textarea
              rows={4}
              placeholder="Ghi chú về văn phong, cốt truyện hoặc cách xưng hô chung..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-xs bg-slate-955 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Render Import chapters section dynamically */}
          {importSection}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
