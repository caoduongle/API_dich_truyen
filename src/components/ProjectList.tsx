import React, { useState, useRef, useMemo } from 'react';
import { motion, type Variants } from 'motion/react';
import { StoryProject, Chapter } from '../types';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { triggerDownload } from '../utils/download';
import { useEpubExport } from '../hooks/useEpubExport';
import { ProjectCard } from './project-list/ProjectCard';
import { ProjectFormModal } from './project-list/ProjectFormModal';
import { ShareProjectModal } from './google-sync/ShareProjectModal';
import { SkeletonProjectCard } from './common/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import {
  Folder, Upload, BookOpenText
} from 'lucide-react';

interface ProjectListProps {
  projects: StoryProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: (project: Omit<StoryProject, 'id' | 'createdAt'>) => void;
  onUpdateProject?: (project: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  isLoading?: boolean;
}

const CARD_ENTRANCE: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 8) * 0.04, duration: 0.25, ease: 'easeOut' },
  }),
};

export default function ProjectList({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  isLoading = false,
}: ProjectListProps) {
  const { showToast } = useNotifications();
  const { isExportingEpub, handleExportEpub } = useEpubExport();

  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [sharingProject, setSharingProject] = useState<StoryProject | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);

  // Memoize project completion progress calculations
  const projectProgressMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number; pct: number }>();
    projects.forEach((proj) => {
      const total = proj.chapters.length;
      if (total === 0) {
        map.set(proj.id, { total: 0, done: 0, pct: 0 });
      } else {
        const done = proj.chapters.filter((c) => c.status === 'completed').length;
        map.set(proj.id, { total, done, pct: Math.round((done / total) * 100) });
      }
    });
    return map;
  }, [projects]);

  // Export project to disk as JSON
  const handleExportProjectJson = async (proj: StoryProject) => {
    const fullChapters: Chapter[] = [];
    if (proj.chapters && Array.isArray(proj.chapters)) {
      for (const meta of proj.chapters) {
        const chap = await getChapterFromDB(meta.id);
        if (chap) {
          fullChapters.push(chap);
        }
      }
    }

    const projectWithFullChapters = {
      ...proj,
      chapters: fullChapters,
    };

    const jsonString = JSON.stringify(projectWithFullChapters, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_from_disk.json`);
    URL.revokeObjectURL(url);
  };

  // Export polished Vietnamese text or bilingual side-by-side
  const handleExportText = async (proj: StoryProject, mode: 'vietnamese' | 'bilingual') => {
    let output = '';
    for (const chapterMeta of proj.chapters) {
      const chapter = await getChapterFromDB(chapterMeta.id);
      if (!chapter) continue;
      output += `=== ${chapter.title} ===\n\n`;
      if (mode === 'bilingual') {
        if (chapter.paragraphs && chapter.paragraphs.length > 0) {
          chapter.paragraphs.forEach((cnLine, idx) => {
            const viLine = chapter.translatedLines?.[idx] || chapter.polishedTranslation || '';
            output += `[CN]: ${cnLine}\n[VI]: ${viLine || '(Chưa dịch)'}\n\n`;
          });
        } else {
          output += `[CN]:\n${chapter.sourceText}\n\n[VI]:\n${chapter.polishedTranslation || chapter.rawTranslation || '(Chưa dịch)'}\n\n`;
        }
      } else {
        output += (chapter.polishedTranslation || chapter.rawTranslation || '') + '\n\n';
      }
    }

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const modeSuffix = mode === 'bilingual' ? 'song_ngu' : 'tieng_viet';
    triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_${modeSuffix}.txt`);
    URL.revokeObjectURL(url);
  };

  // Import full project from exported JSON file
  const handleImportProjectJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.title) {
        throw new Error('Tệp JSON không đúng cấu trúc dự án của ứng dụng.');
      }

      const importedChapters: Chapter[] = (data.chapters || []).map((c: any, idx: number) => ({
        id: c.id || `chap_${Date.now()}_${idx}`,
        title: c.title || `Chương ${idx + 1}`,
        sourceText: c.sourceText || '',
        processedSourceText: c.processedSourceText || '',
        rawTranslation: c.rawTranslation || '',
        polishedTranslation: c.polishedTranslation || '',
        paragraphs: c.paragraphs || [],
        translatedLines: c.translatedLines || [],
        status: c.status || 'not_started',
        createdAt: c.createdAt || new Date().toISOString(),
      }));

      const newProjPayload = {
        title: data.title,
        author: data.author || 'Khuyết danh',
        genre: data.genre || 'Tiên Hiệp',
        tone: data.tone || 'Dịch thuần Việt mượt mà',
        description: data.description || '',
        chapters: importedChapters,
        glossary: data.glossary || [],
        pendingGlossary: data.pendingGlossary || [],
      };

      onCreateProject(newProjPayload);
      showToast({ message: `Đã khôi phục thành công truyện "${data.title}" (${importedChapters.length} chương)!`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      showToast({ message: 'Lỗi khi nhập tệp sao lưu JSON: ' + err.message, type: 'error' });
    } finally {
      if (importJsonInputRef.current) {
        importJsonInputRef.current.value = '';
      }
    }
  };

  const handleStartEditProject = (e: React.MouseEvent, proj: StoryProject) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setIsCreating(true);
  };

  const handleSaveProjectForm = (payload: any) => {
    if (editingProjectId && onUpdateProject) {
      const existing = projects.find((p) => p.id === editingProjectId);
      if (existing) {
        onUpdateProject({
          ...existing,
          title: payload.title,
          author: payload.author,
          genre: payload.genre,
          tone: payload.tone,
          description: payload.description,
          chapters: payload.chapters.length > 0 ? payload.chapters : existing.chapters,
          glossary: payload.glossary.length > 0 ? [...existing.glossary, ...payload.glossary] : existing.glossary,
        });
        showToast({ message: 'Đã cập nhật thông tin dự án!', type: 'success' });
      }
    } else {
      onCreateProject(payload);
      showToast({ message: 'Đã khởi tạo thành công tiểu thuyết mới!', type: 'success' });
    }

    setIsCreating(false);
    setEditingProjectId(null);
  };

  const currentEditingProject = editingProjectId
    ? projects.find((p) => p.id === editingProjectId) || null
    : null;

  return (
    <div id="project-list-root-container" className="space-y-6">
      {/* Outer Quick Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs">
        <div className="space-y-1">
          <h2 className="text-sm font-display font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
            <Folder className="w-4 h-4 text-polish" />
            Giám Sát & Quản Lý Dự Án Truyện
          </h2>
          <p className="text-xs text-text-muted">
            Tạo truyện mới, nhập tệp truyện thô (.txt, .epub), phân tích tệp hướng dẫn dịch (.md) để trích xuất từ điển thông minh, và lưu trữ dữ liệu bền vững về máy tính của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            ref={importJsonInputRef}
            onChange={handleImportProjectJson}
            className="hidden"
          />
          <Button
            id="btn-import-project-json"
            variant="secondary"
            icon={<Upload className="w-3.5 h-3.5 text-polish" />}
            onClick={() => importJsonInputRef.current?.click()}
            title="Đọc tệp tin .json lưu ở máy tính để dịch tiếp"
          >
            Nạp tệp sao lưu (.json)
          </Button>

          <Button
            id="btn-trigger-add-project"
            variant="primary"
            className="glow-polish font-bold"
            onClick={() => {
              if (isCreating) {
                setIsCreating(false);
                setEditingProjectId(null);
              } else {
                setIsCreating(true);
              }
            }}
          >
            {isCreating ? 'Hủy' : 'Tạo truyện mới'}
          </Button>
        </div>
      </div>

      {/* Creation / Edit form */}
      {isCreating && (
        <ProjectFormModal
          editingProject={currentEditingProject}
          onSave={handleSaveProjectForm}
          onCancel={() => {
            setIsCreating(false);
            setEditingProjectId(null);
          }}
          apiKeys={apiKeys}
          selectedModel={selectedModel}
        />
      )}

      {/* Grid displays projects */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
          Tiểu thuyết hiện hữu trong hệ thống
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonProjectCard />
            <SkeletonProjectCard />
            <SkeletonProjectCard />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<BookOpenText className="w-5 h-5" />}
            title="Chưa có tiểu thuyết nào"
            description="Tạo dự án đầu tiên hoặc nạp một tệp sao lưu .json để bắt đầu dịch."
            action={
              <Button variant="primary" className="mt-1" onClick={() => setIsCreating(true)}>
                Tạo truyện mới
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj, i) => {
              const isActive = proj.id === activeProjectId;
              const progress = projectProgressMap.get(proj.id);

              return (
                <motion.div
                  key={proj.id}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  variants={CARD_ENTRANCE}
                >
                  <ProjectCard
                    proj={proj}
                    isActive={isActive}
                    onSelect={onSelectProject}
                    onEdit={handleStartEditProject}
                    onDelete={onDeleteProject}
                    onShare={(e, p) => {
                      e.stopPropagation();
                      setSharingProject(p);
                    }}
                    onExportJson={handleExportProjectJson}
                    onExportText={handleExportText}
                    onExportEpub={handleExportEpub}
                    isExportingEpub={isExportingEpub === proj.id}
                    canDelete={projects.length > 1}
                    progress={progress}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Chia sẻ dự án qua Google Drive */}
      <ShareProjectModal
        open={!!sharingProject}
        onClose={() => setSharingProject(null)}
        project={sharingProject}
        onProjectUpdated={(updated) => {
          onUpdateProject?.(updated);
          setSharingProject(updated);
        }}
      />
    </div>
  );
}
