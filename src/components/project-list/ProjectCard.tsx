import React from 'react';
import { motion } from 'motion/react';
import { StoryProject } from '../../types';
import {
  BookOpen, Tag, Download, Edit3, Trash2, Sparkles, Calendar
} from 'lucide-react';
import { useNotifications } from '../NotificationSystem';
import { GenreMark } from '../ui/GenreMark';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
    <motion.div
      id={`project-card-${proj.id}`}
      onClick={() => onSelect(proj.id)}
      whileTap={{ scale: 0.99 }}
      className={`p-5 rounded-md border transition-all cursor-pointer relative flex flex-col justify-between ${
        isActive
          ? 'border-polish bg-parchment shadow-md ring-1 ring-polish/30'
          : 'border-parchment-2 bg-parchment hover:border-text-muted hover:shadow-xs'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <GenreMark genre={proj.genre} />
            <Badge tone="neutral" className="uppercase tracking-wider">
              {proj.genre}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sao lưu lưu trữ truyện về máy tính (.json)"
              title="Sao lưu lưu trữ truyện về máy tính (.json)"
              onClick={(e) => {
                e.stopPropagation();
                onExportJson(proj);
              }}
            >
              <Download className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Chỉnh sửa thông tin môi trường và bộ truyện"
              title="Chỉnh sửa thông tin môi trường và bộ truyện"
              onClick={(e) => onEdit(e, proj)}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>

            {canDelete && (
              <Button
                id={`btn-delete-project-${proj.id}`}
                variant="ghost"
                size="icon"
                aria-label="Xóa truyện"
                title="Xóa truyện"
                className="hover:text-polish"
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
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
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
              <motion.div
                className="h-full bg-polish rounded-full"
                initial={{ width: 0 }}
                animate={{ width: progress.pct + '%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {proj.chapters.length > 0 && (
          <div className="flex gap-1.5 pt-2 border-t border-parchment-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] py-1.5"
              title="Xuất bản dịch tiếng Việt (.txt)"
              onClick={(e) => { e.stopPropagation(); onExportText(proj, 'vietnamese'); }}
            >
              ↓ Bản Việt (.txt)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] py-1.5"
              title="Xuất song ngữ Trung-Việt (.txt)"
              onClick={(e) => { e.stopPropagation(); onExportText(proj, 'bilingual'); }}
            >
              ↓ Song ngữ (.txt)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] py-1.5 text-polish"
              disabled={isExportingEpub}
              title="Đóng gói và xuất file sách điện tử (.epub) để đọc trên điện thoại/Kindle"
              onClick={(e) => { e.stopPropagation(); onExportEpub(proj); }}
            >
              {isExportingEpub ? 'Đang xuất...' : '↓ Sách EPUB'}
            </Button>
          </div>
        )}
      </div>

      {isActive && (
        <Badge tone="solid" className="absolute top-4 right-14 text-[9px]">
          Đang dịch
        </Badge>
      )}
    </motion.div>
  );
}
