import React from 'react';
import { StoryProject } from '../../types';
import {
  BookOpen, Tag, Download, Edit3, Trash2, Sparkles, Calendar
} from 'lucide-react';
import { useNotifications } from '../NotificationSystem';

export interface ProjectCardProps {
  proj: StoryProject;
  isActive: boolean;
  onSelect: (id: string) => void;
  onEdit: (e: React.MouseEvent, proj: StoryProject) => void;
  onDelete: (id: string) => void;
  onExportJson: (proj: StoryProject) => void;
  onExportText: (proj: StoryProject, mode: 'vietnamese' | 'bilingual') => void;
  onExportEpub: (proj: StoryProject) => void;
  isExportingEpub: boolean;
  canDelete: boolean;
  progress?: { total: number; done: number; pct: number };
}

export function getGenreEmoji(g: string): string {
  switch (g) {
    case 'Tiên Hiệp': return '✨';
    case 'Võ Hiệp': return '⚔️';
    case 'Ngôn Tình': return '💖';
    case 'Đô Thị': return '🏙️';
    case 'Huyền Huyễn': return '🐉';
    case 'Huyền Huyễn Phương Tây': return '🏰';
    case 'Vô Hạn Lưu': return '🌀';
    case 'Lịch Sử / Quân Sự': return '🛡️';
    case 'Khoa Huyễn / Võng Du': return '🤖';
    case 'Linh Dị / Thần Quái': return '👻';
    case 'Hệ Thống / Điền Văn': return '🌾';
    default: return '📖';
  }
}

export function ProjectCard({
  proj,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onExportJson,
  onExportText,
  onExportEpub,
  isExportingEpub,
  canDelete,
  progress = { total: 0, done: 0, pct: 0 },
}: ProjectCardProps) {
  const { showConfirm } = useNotifications();

  return (
    <div
      id={`project-card-${proj.id}`}
      onClick={() => onSelect(proj.id)}
      className={`p-5 rounded-md border transition-all cursor-pointer relative flex flex-col justify-between ${
        isActive
          ? 'border-polish bg-parchment shadow-md ring-1 ring-polish/30'
          : 'border-parchment-2 bg-parchment hover:border-text-muted hover:shadow-xs'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">{getGenreEmoji(proj.genre)}</span>
            <span className="bg-ink text-text-muted border border-parchment-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-[2px]">
              {proj.genre}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Export JSON */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExportJson(proj);
              }}
              className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
              title="Sao lưu lưu trữ truyện về máy tính (.json)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Edit Button */}
            <button
              onClick={(e) => onEdit(e, proj)}
              className="text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
              title="Chỉnh sửa thông tin môi trường và bộ truyện"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {canDelete && (
              <button
                id={`btn-delete-project-${proj.id}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  const confirmed = await showConfirm({
                    title: 'Xóa vĩnh viễn dự án',
                    message: `Bạn chắc chắn muốn xóa vĩnh viễn dự án '${proj.title}'? Hành động này sẽ xóa tất cả từ điển và chương đã luỹ tích.`,
                    confirmText: 'Xác nhận xóa',
                    cancelText: 'Hủy',
                    type: 'danger',
                  });
                  if (confirmed) {
                    onDelete(proj.id);
                  }
                }}
                className="text-text-muted hover:text-rose-400 p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
                title="Xóa truyện"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3.5 space-y-0.5">
          <h3 className="text-sm font-display font-bold text-text-main line-clamp-1">
            {proj.title}
          </h3>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide">
            Tác giả: <span className="text-text-main font-sans">{proj.author}</span>
          </p>
        </div>

        {proj.description && (
          <p className="mt-3 text-xs text-text-muted line-clamp-2 leading-relaxed">
            {proj.description}
          </p>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-parchment-2 space-y-2 text-[11px] text-text-muted">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-polish shrink-0" />
            <span>Tổng số chương dịch:</span>
          </div>
          <strong className="text-text-main font-bold">{proj.chapters.length} chương</strong>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>Bảng từ điển (Glossary):</span>
          </div>
          <strong className="text-text-main font-bold">{proj.glossary.length} từ</strong>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>Phong cách:</span>
          </div>
          <strong className="text-text-main font-semibold truncate max-w-[120px]" title={proj.tone}>{proj.tone}</strong>
        </div>

        <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Ngày khởi tạo:</span>
          </div>
          <span>{new Date(proj.createdAt).toLocaleDateString('vi-VN')}</span>
        </div>

        {/* Progress bar */}
        {progress.total > 0 && (
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-text-muted">Tiến trình dịch</span>
              <span className="font-bold text-polish">{progress.done}/{progress.total} chương ({progress.pct}%)</span>
            </div>
            <div className="w-full h-1.5 bg-ink border border-parchment-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-polish rounded-full transition-all duration-500"
                style={{ width: progress.pct + '%' }}
              />
            </div>
          </div>
        )}

        {proj.chapters.length > 0 && (
          <div className="flex gap-1.5 pt-2 border-t border-parchment-2">
            <button
              onClick={(e) => { e.stopPropagation(); onExportText(proj, 'vietnamese'); }}
              className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-ink hover:bg-parchment-2 text-text-main border border-parchment-2 rounded-[2px] transition cursor-pointer"
              title="Xuất bản dịch tiếng Việt (.txt)"
            >
              ↓ Bản Việt (.txt)
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onExportText(proj, 'bilingual'); }}
              className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-ink hover:bg-parchment-2 text-text-main border border-parchment-2 rounded-[2px] transition cursor-pointer"
              title="Xuất song ngữ Trung-Việt (.txt)"
            >
              ↓ Song ngữ (.txt)
            </button>
            <button
              disabled={isExportingEpub}
              onClick={(e) => { e.stopPropagation(); onExportEpub(proj); }}
              className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-ink hover:bg-parchment-2 text-polish border border-parchment-2 rounded-[2px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Đóng gói và xuất file sách điện tử (.epub) để đọc trên điện thoại/Kindle"
            >
              {isExportingEpub ? 'Đang xuất...' : '↓ Sách EPUB'}
            </button>
          </div>
        )}
      </div>

      {isActive && (
        <div className="absolute top-4 right-14 bg-polish text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase">
          ĐANG DỊCH
        </div>
      )}
    </div>
  );
}
