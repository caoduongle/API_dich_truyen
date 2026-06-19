import React, { useState, startTransition, useCallback, memo } from 'react';
import { Chapter } from './types';
import ProjectList from './components/ProjectList';
import GlossaryManager from './components/GlossaryManager';
import TranslatorWorkspace from './components/TranslatorWorkspace';
import AutoTranslator from './components/AutoTranslator';
import ChapterHistoryPanel from './components/ChapterHistoryPanel';
import ApiSettings from './components/ApiSettings';
import { useProjects } from './hooks/useProjects';
import { useAIConfig } from './hooks/useAIConfig';
import {
  Languages, BookOpenText, Folder, Settings, Cpu, History, Sparkles
} from 'lucide-react';

// Bọc các tab nặng trong React.memo để tránh re-render khi chỉ activeTab thay đổi.
// GlossaryManager tự bọc memo ở export, ChapterHistoryPanel nhẹ nên không cần.
const MemoTranslatorWorkspace = memo(TranslatorWorkspace);
const MemoAutoTranslator      = memo(AutoTranslator);
const MemoProjectList         = memo(ProjectList);
const MemoChapterHistoryPanel = memo(ChapterHistoryPanel);

export default function App() {
  const [activeTab, setActiveTab] = useState<'translate' | 'glossary' | 'projects' | 'history' | 'auto-translate'>('translate');

  // Kế thừa kiến trúc từ Custom Hooks
  const {
    projects,
    activeProjectId,
    activeProject,
    isLoading,
    handleUpdateProject,
    handleSelectProject,
    handleDeleteProject,
    handleCreateProject,
    handleAddGlossaryItem,
    handleAddGlossaryItems,
    handleUpdateGlossaryItem,
    handleDeleteGlossaryItem,
    handleDeleteChapterHistory,
    handleAddToPendingGlossary,
    handleConfirmPendingItem,
    handleDiscardPendingItem,
    handleResetChapters
  } = useProjects();

  const {
    apiKeys,
    selectedModel,
    showApiSettings,
    setShowApiSettings,
    handleSaveModel,
    handleAddApiKey,
    handleUpdateKeyIndex,
    handleDeleteKeyIndex,
    handleImportClipboardKeys
  } = useAIConfig();

  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);

  // Dùng startTransition: React ưu tiên giữ UI responsive, render tab mới như "background work"
  const switchTab = useCallback((tab: typeof activeTab) => {
    startTransition(() => setActiveTab(tab));
  }, []);

  // Các handler tổ hợp bọc useCallback — tránh tạo function mới mỗi render,
  // đảm bảo React.memo trên ProjectList hoạt động đúng.
  const handleGoToTranslate = useCallback((chapter?: Chapter) => {
    if (chapter) {
      setLoadedChapter(chapter);
    } else {
      setLoadedChapter(null);
    }
    switchTab('translate');
  }, [switchTab]);

  const handleSelectProjectAndSwitch = useCallback((id: string) => {
    setLoadedChapter(null);
    handleSelectProject(id);
    switchTab('translate');
  }, [handleSelectProject, switchTab]);

  const handleCreateProjectAndSwitch = useCallback(
    (data: Parameters<typeof handleCreateProject>[0]) => {
      setLoadedChapter(null);
      handleCreateProject(data);
      switchTab('translate');
    },
    [handleCreateProject, switchTab]
  );

  const handleClearLoadedChapter = useCallback(() => {
    setLoadedChapter(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans">
        <Cpu className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Đang khởi tạo cấu trúc dữ liệu an toàn (IndexedDB)...</p>
      </div>
    );
  }

  return (
    <div id="ai-story-translator-app" className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-950 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Platform Header */}
      <header className="sticky top-0 z-50 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shadow-sm">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-none">
              ZHONG-VIET AI TRANSLATOR
              <span className="text-[10px] font-normal text-slate-400">v2.4.0 Professional</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activeProject && (
            <div className="hidden sm:flex items-center bg-slate-100 rounded-md px-2 py-1 gap-1.5 border border-slate-200/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Môi trường:</span>
              <span className="text-xs font-semibold text-indigo-700">{activeProject.genre} / {activeProject.tone}</span>
            </div>
          )}

          <button
            onClick={() => setShowApiSettings(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            Cấu hình AI ({apiKeys.filter(k => k.trim()).length ? `${apiKeys.filter(k => k.trim()).length} Keys` : 'Hệ thống'})
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto scrollbar-none py-0.5">
            <nav className="flex space-x-1 min-w-max">
              <button
                onClick={() => switchTab('translate')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'translate' ? 'border-indigo-600 text-slate-950 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpenText className="w-3.5 h-3.5 shrink-0" />
                Mặt Trận Dịch Thuật
              </button>

              <button
                onClick={() => switchTab('auto-translate')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'auto-translate' ? 'border-indigo-600 text-slate-950 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 shrink-0 text-indigo-600 animate-pulse" />
                Dịch Tự Động Toàn Bộ
              </button>

              <button
                onClick={() => switchTab('glossary')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'glossary' ? 'border-indigo-600 text-slate-950 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                Từ Điển Nhân Vật
                {activeProject && activeProject.glossary.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {activeProject.glossary.length}
                  </span>
                )}
                {activeProject && (activeProject.pendingGlossary || []).length > 0 && (
                  <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {(activeProject.pendingGlossary || []).length} chờ
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('history')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'history' ? 'border-indigo-600 text-slate-950 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                Lịch Sử Chương Dịch
                {activeProject && activeProject.chapters.length > 0 && (
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {activeProject.chapters.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('projects')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'projects' ? 'border-indigo-600 text-slate-950 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Folder className="w-3.5 h-3.5 shrink-0" />
                Quản Lý Truyện ({projects.length})
              </button>
            </nav>

            {activeProject && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <span>Bộ đang dịch: </span>
                <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-extrabold">
                  {activeProject.title}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeProject ? (
          <>
            <div className={activeTab !== 'translate' ? 'hidden' : ''}>
              <MemoTranslatorWorkspace
                activeProject={activeProject}
                onUpdateProject={handleUpdateProject}
                apiKeys={apiKeys}
                selectedModel={selectedModel}
                loadedChapter={loadedChapter}
                onClearLoadedChapter={handleClearLoadedChapter}
              />
            </div>

            <div className={activeTab !== 'auto-translate' ? 'hidden' : ''}>
              <MemoAutoTranslator
                activeProject={activeProject}
                onUpdateProject={handleUpdateProject}
                apiKeys={apiKeys}
                selectedModel={selectedModel}
              />
            </div>

            <div className={activeTab !== 'glossary' ? 'hidden' : ''}>
              {/* GlossaryManager tự bọc React.memo ở phần export */}
              <GlossaryManager
                projectId={activeProject.id}
                glossary={activeProject.glossary}
                pendingGlossary={activeProject.pendingGlossary || []}
                chapters={activeProject.chapters}
                apiKeys={apiKeys}
                selectedModel={selectedModel}
                onAddGlossaryItem={handleAddGlossaryItem}
                onAddGlossaryItems={handleAddGlossaryItems}
                onUpdateGlossaryItem={handleUpdateGlossaryItem}
                onDeleteGlossaryItem={handleDeleteGlossaryItem}
                onAddToPending={handleAddToPendingGlossary}
                onConfirmPending={handleConfirmPendingItem}
                onDiscardPending={handleDiscardPendingItem}
              />
            </div>

            <div className={activeTab !== 'projects' ? 'hidden' : ''}>
              <MemoProjectList
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProjectAndSwitch}
                onDeleteProject={handleDeleteProject}
                onCreateProject={handleCreateProjectAndSwitch}
                onUpdateProject={handleUpdateProject}
                apiKeys={apiKeys}
                selectedModel={selectedModel}
              />
            </div>

            <div className={activeTab !== 'history' ? 'hidden' : ''}>
              <MemoChapterHistoryPanel
                activeProject={activeProject}
                onUpdateProject={handleUpdateProject}
                onDeleteChapterHistory={handleDeleteChapterHistory}
                onGoToTranslate={handleGoToTranslate}
                onResetChapters={handleResetChapters}
              />
            </div>
          </>
        ) : (
          <MemoProjectList
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProjectAndSwitch}
            onDeleteProject={handleDeleteProject}
            onCreateProject={handleCreateProjectAndSwitch}
            onUpdateProject={handleUpdateProject}
            apiKeys={apiKeys}
            selectedModel={selectedModel}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600/30 flex items-center justify-center text-white">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="font-bold text-slate-200 tracking-wider">ZHONG-VIET AI TRANSLATOR</span>
          </div>
          <div className="flex gap-6 text-slate-500 font-medium">
            <span>Giản thể &amp; Phồn thể</span>
            <span>Glossary Manager v2.4</span>
            <span>IndexedDB Engine Persistent Storage</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Machine Learning Powered Translation Panel. All Rights Reserved.
          </div>
        </div>
      </footer>

      {/* Modal Cấu hình AI — component riêng, UI polished với Eye/toggle, CheckCircle validation */}
      {showApiSettings && (
        <ApiSettings
          apiKeys={apiKeys}
          selectedModel={selectedModel}
          onClose={() => setShowApiSettings(false)}
          onSaveModel={handleSaveModel}
          onAddApiKey={handleAddApiKey}
          onUpdateKeyIndex={handleUpdateKeyIndex}
          onDeleteKeyIndex={handleDeleteKeyIndex}
          onImportClipboardKeys={handleImportClipboardKeys}
        />
      )}
    </div>
  );
}
