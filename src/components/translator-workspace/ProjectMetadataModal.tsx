import React from 'react';
import { Edit3, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="2xl"
      icon={<Edit3 className="w-4 h-4 text-polish" />}
      title="Cấu hình & Chỉnh sửa thông tin Truyện"
    >
      <form onSubmit={handleSaveMetadata} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-text-muted">
              Tên tiểu thuyết / Bộ truyện dịch *
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Đấu Phá Thương Khung, Thần Điêu Đại Hiệp..."
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish font-semibold"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-text-muted">Tác giả gốc</label>
            <input
              type="text"
              placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Ngã Thất Tây Hồng Thị..."
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-text-muted">Thể loại chính</label>
            <select
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
            >
              <option value="Tiên Hiệp" className="bg-parchment text-text-main">Tiên Hiệp (Giả tưởng bay bổng, tu tiên, tiên giới)</option>
              <option value="Võ Hiệp" className="bg-parchment text-text-main">Võ Hiệp (Kiếm hiệp truyền thống, ân oán giang hồ)</option>
              <option value="Ngôn Tình" className="bg-parchment text-text-main">Ngôn Tình (Tình cảm lãng mạn lôi cuốn)</option>
              <option value="Đô Thị" className="bg-parchment text-text-main">Đô Thị (Thời hiện đại, thương trường, cuộc sống)</option>
              <option value="Huyền Huyễn" className="bg-parchment text-text-main">Huyền Huyễn (Lịch sử giả tưởng kỳ ảo)</option>
              <option value="Huyền Huyễn Phương Tây" className="bg-parchment text-text-main">Huyền Huyễn Phương Tây (Hiệp sĩ, ma pháp, rồng, ma quỷ phương Tây)</option>
              <option value="Vô Hạn Lưu" className="bg-parchment text-text-main">Vô Hạn Lưu (Sinh tồn, luân hồi, nhiệm vụ phó bản nghẹt thở)</option>
              <option value="Lịch Sử / Quân Sự" className="bg-parchment text-text-main">Lịch Sử / Quân Sự (Dã sử, quân triều, binh pháp chiến tranh)</option>
              <option value="Khoa Huyễn / Võng Du" className="bg-parchment text-text-main">Khoa Huyễn / Võng Du (Khoa học viễn tưởng, thế giới game ảo, cơ giáp)</option>
              <option value="Linh Dị / Thần Quái" className="bg-parchment text-text-main">Linh Dị / Thần Quái (Kinh dị tâm linh, ma quỷ kỳ bí, trinh thám u ám)</option>
              <option value="Hệ Thống / Điền Văn" className="bg-parchment text-text-main">Hệ Thống / Điền Văn (Sinh hoạt gia đình, làm ruộng điền viên nhẹ nhàng)</option>
              <option value="Khác" className="bg-parchment text-text-main">Thể loại khác</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-text-muted">Tông giọng biên dịch &amp; Biên tập</label>
            <select
              value={editTone}
              onChange={(e) => setEditTone(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
            >
              <option value="Dịch thuần Việt mượt mà" className="bg-parchment text-text-main">Thuần Việt mượt mà (Ưu tiên câu từ lưu loát tự nhiên Việt Nam)</option>
              <option value="Trang nghiêm cổ phong" className="bg-parchment text-text-main">Cổ phong trang nghiêm (Từ ngữ đậm chất Hán Việt, sang quý)</option>
              <option value="Bình dị dân dã" className="bg-parchment text-text-main">Bình dị đời thường (Từ ngữ đơn giản mộc mạc phong vị đời thật)</option>
              <option value="Hùng tráng dồn dập" className="bg-parchment text-text-main">Hùng tráng dập dồn (Thích hợp truyện võ đấu, kịch tính nhiệt huyết)</option>
              <option value="Trầm hùng dã sử" className="bg-parchment text-text-main">Trầm hùng dã sử (Trang nghiêm sử thi, thích hợp quân sự lịch sử)</option>
              <option value="Hiện đại công nghệ" className="bg-parchment text-text-main">Hiện đại công nghệ (Thuật ngữ viễn tưởng số hóa, hiện đại)</option>
              <option value="Kịch tính ly kỳ" className="bg-parchment text-text-main">Kịch tính ly kỳ (Gợi cảm giác hồi hộp, u ám tâm linh)</option>
              <option value="Nhẹ nhàng điền văn" className="bg-parchment text-text-main">Nhẹ nhàng điền văn (Lối kể mộc mạc ấm áp, đời thường chậm rãi)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-text-muted">Giới thiệu tóm tắt / Quy tắc dịch</label>
          <textarea
            rows={4}
            placeholder="Ghi chú về văn phong, cốt truyện hoặc cách xưng hô chung..."
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish resize-none"
          />
        </div>

        {/* Render Import chapters section dynamically */}
        {importSection}

        <div className="flex justify-end gap-2 pt-3 border-t border-parchment-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<Check className="w-3.5 h-3.5" />}
          >
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
});

export default ProjectMetadataModal;
