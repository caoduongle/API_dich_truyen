import React, { useState, useRef, useMemo } from 'react';
import { StoryProject, GlossaryItem, Chapter } from '../types';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { triggerDownload } from '../utils/download';
import { useEpubExport } from '../hooks/useEpubExport';
import { ProjectCard } from './project-list/ProjectCard';
import { ProjectFormModal } from './project-list/ProjectFormModal';
import { 
  Folder, Upload, Plus
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
}

export default function ProjectList({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
}: ProjectListProps) {
  const { showToast } = useNotifications();
  const { isExportingEpub, handleExportEpub } = useEpubExport();

  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
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
    triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_${mode}.txt`);
    URL.revokeObjectURL(url);
  };

  // Import project JSON from disk
  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const imported = JSON.parse(raw);

        if (!imported.title) {
          showToast({ message: 'Tệp JSON không hợp lệ, không tìm thấy tên tiểu thuyết (title).', type: 'error' });
          return;
        }

        const projectPayload: StoryProject = {
          ...imported,
          id: 'proj_' + Date.now(),
          createdAt: imported.createdAt || new Date().toISOString(),
          glossary: Array.isArray(imported.glossary) ? imported.glossary : [],
          pendingGlossary: Array.isArray(imported.pendingGlossary) ? imported.pendingGlossary : [],
          chapters: Array.isArray(imported.chapters) ? imported.chapters : [],
        };

        onCreateProject(projectPayload);
        showToast({ message: `Nhập khẩu dự án thành công! Thêm bộ truyện "${projectPayload.title}" với ${projectPayload.chapters.length} chương và ${projectPayload.glossary.length} từ điển.`, type: 'success' });
      } catch (err: any) {
        showToast({ message: 'Lỗi giải mã cấu trúc dữ liệu tệp JSON: ' + err.message, type: 'error' });
      }
    };
    reader.readAsText(file);
    
    if (importJsonInputRef.current) {
      importJsonInputRef.current.value = '';
    }
  };

  const handleSaveProjectForm = (payload: {
    title: string;
    author: string;
    genre: string;
    tone: string;
    description: string;
    chapters: Chapter[];
    glossary: GlossaryItem[];
  }) => {
    if (editingProjectId && onUpdateProject) {
      const existingProj = projects.find((p) => p.id === editingProjectId);
      if (existingProj) {
        const updatedProj: StoryProject = {
          ...existingProj,
          title: payload.title,
          author: payload.author,
          genre: payload.genre,
          tone: payload.tone,
          description: payload.description,
          chapters: [...existingProj.chapters, ...payload.chapters],
          glossary: [...existingProj.glossary, ...payload.glossary],
        };
        onUpdateProject(updatedProj);
        showToast({ message: `Đã cập nhật thông tin truyện "${payload.title}" thành công!`, type: 'success' });
      }
    } else {
      onCreateProject({
        title: payload.title,
        author: payload.author,
        genre: payload.genre,
        tone: payload.tone,
        description: payload.description,
        chapters: payload.chapters,
        glossary: payload.glossary,
        pendingGlossary: [],
      });
    }

    setEditingProjectId(null);
    setIsCreating(false);
  };

  const handleStartEditProject = (e: React.MouseEvent, proj: StoryProject) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setIsCreating(true);

    setTimeout(() => {
      const formElement = document.getElementById('form-create-project');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const currentEditingProject = editingProjectId
    ? projects.find((p) => p.id === editingProjectId) || null
    : null;

  return (
    <div id="project-list-root-container" className="space-y-6">
      {/* Outer Quick Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400 animate-pulse" />
            Giám Sát & Quản Lý Dự Án Truyện
          </h2>
          <p className="text-xs text-slate-400">
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
          <button
            id="btn-import-project-json"
            onClick={() => importJsonInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-slate-800 hover:bg-slate-850 hover:text-slate-200 text-slate-300 font-semibold px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
            title="Đọc tệp tin .json lưu ở máy tính để dịch tiếp"
          >
            <Upload className="w-3.5 h-3.5" />
            Nạp tệp sao lưu (.json)
          </button>

          <button
            id="btn-trigger-add-project"
            onClick={() => {
              if (isCreating) {
                setIsCreating(false);
                setEditingProjectId(null);
              } else {
                setIsCreating(true);
              }
            }}
            className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-755 text-white font-bold px-4 py-1.5 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {isCreating ? 'Hủy' : 'Tạo truyện mới'}
          </button>
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
        <h3 className="text-xs font-bold text-slate-455 uppercase tracking-widest">
          Tiểu thuyết hiện hữu trong hệ thống
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const progress = projectProgressMap.get(proj.id);

            return (
              <ProjectCard
                key={proj.id}
                proj={proj}
                isActive={isActive}
                onSelect={onSelectProject}
                onEdit={handleStartEditProject}
                onDelete={onDeleteProject}
                onExportJson={handleExportProjectJson}
                onExportText={handleExportText}
                onExportEpub={handleExportEpub}
                isExportingEpub={isExportingEpub === proj.id}
                canDelete={projects.length > 1}
                progress={progress}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
