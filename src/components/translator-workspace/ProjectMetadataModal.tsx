import React from 'react';
import { Edit3, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { GuidelineStagedGlossaryAction } from '../../services/glossaryIO';
import { StyleGuidelineEditor } from '../common/StyleGuidelineEditor';

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
  projectGlossaryCount?: number;
  stagedGlossaryAction?: GuidelineStagedGlossaryAction | null;
  onStageGlossaryAction?: (action: GuidelineStagedGlossaryAction | null) => void;
  genreError?: string | null;
  toneError?: string | null;
  apiKeys?: string[];
  selectedModel?: string;
  showToast?: (opts: { message: string; type: 'success' | 'warning' | 'error' | 'info' }) => void;
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
  projectGlossaryCount = 0,
  stagedGlossaryAction,
  onStageGlossaryAction,
  genreError,
  toneError,
  apiKeys = [],
  selectedModel,
  showToast,
}: ProjectMetadataModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="4xl"
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
        </div>

        <StyleGuidelineEditor
          idPrefix="edit"
          genre={editGenre}
          onGenreChange={setEditGenre}
          tone={editTone}
          onToneChange={setEditTone}
          description={editDescription}
          onDescriptionChange={setEditDescription}
          projectTitle={editTitle}
          existingGlossaryCount={projectGlossaryCount}
          stagedGlossaryAction={stagedGlossaryAction}
          onStageGlossaryAction={onStageGlossaryAction}
          genreError={genreError}
          toneError={toneError}
          apiKeys={apiKeys}
          selectedModel={selectedModel}
          showToast={showToast}
        />

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
