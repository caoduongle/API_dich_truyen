import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  BookOpenText, Settings, History, Folder, Cpu, Languages, Lock, Unlock 
} from 'lucide-react';
import { Chapter, StoryProject } from './types';
import { NotificationProvider } from './components/NotificationSystem';
import { AIConfigProvider, useAIConfigContext } from './context/AIConfigContext';
import { ProjectProvider, useProjectContext } from './context/ProjectContext';
import { checkAuthStatus, logoutAuth } from './utils/apiClient';

import { TabSkeleton } from './components/common/Skeleton';

// Code splitting các tab nặng qua React.lazy để tối ưu hóa initial bundle parse time
const TranslatorWorkspace = React.lazy(() => import('./components/TranslatorWorkspace'));
const AutoTranslator = React.lazy(() => import('./components/AutoTranslator'));
const GlossaryManager = React.lazy(() => import('./components/GlossaryManager'));
const ProjectList = React.lazy(() => import('./components/ProjectList'));
const ChapterHistoryPanel = React.lazy(() => import('./components/ChapterHistoryPanel'));
const ApiSettings = React.lazy(() => import('./components/ApiSettings'));
import AuthModal from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const MemoTranslatorWorkspace = React.memo(TranslatorWorkspace);
const MemoAutoTranslator = React.memo(AutoTranslator);
const MemoProjectList = React.memo(ProjectList);
const MemoChapterHistoryPanel = React.memo(ChapterHistoryPanel);

function AppContent() {
  const {
    projects,
    activeProject,
    activeProjectId,
    isLoading,
    handleSelectProject,
    handleDeleteProject,
    handleCreateProject,
    handleUpdateProject,
    handleAddGlossaryItem,
    handleAddGlossaryItems,
    handleUpdateGlossaryItem,
    handleDeleteGlossaryItem,
    handleMergeGlossaryItems,
    handleAddToPendingGlossary,
    handleConfirmPendingItem,
    handleDiscardPendingItem,
    handleDeleteChapterHistory,
    handleResetChapters,
  } = useProjectContext();

  const {
    apiKeys,
    selectedModel,
    warningParagraphMismatch,
    enableAiQaCritique,
    enableSegmentTranslation,
    setWarningParagraphMismatch,
    setEnableAiQaCritique,
    setEnableSegmentTranslation,
    handleSaveModel,
    handleAddApiKey,
    handleUpdateKeyIndex,
    handleDeleteKeyIndex,
    handleImportClipboardKeys,
  } = useAIConfigContext();

  const [activeTab, setActiveTab] = useState<'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects'>('translate');
  const [, startTransition] = useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['translate']));

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);

  // Check auth requirement on mount
  useEffect(() => {
    checkAuthStatus().then((status) => {
      setAuthRequired(status.authRequired);
      setIsAuthenticated(status.authenticated);
      if (status.authRequired && !status.authenticated) {
        setShowAuthModal(true);
      }
    });

    const handleAuthRequired = () => {
      setIsAuthenticated(false);
      setShowAuthModal(true);
    };
    window.addEventListener('app:auth-required', handleAuthRequired);
    return () => window.removeEventListener('app:auth-required', handleAuthRequired);
  }, []);

  const switchTab = useCallback((tab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects') => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);

  const handleGoToTranslate = useCallback(
    (chapter?: Chapter) => {
      setLoadedChapter(chapter || null);
      switchTab('translate');
    },
    [switchTab]
  );

  const handleSelectProjectAndSwitch = useCallback(
    (id: string) => {
      handleSelectProject(id);
      switchTab('translate');
    },
    [handleSelectProject, switchTab]
  );

  const handleCreateProjectAndSwitch = useCallback(
    (project: Omit<StoryProject, 'id' | 'createdAt'>) => {
      handleCreateProject(project);
      switchTab('translate');
    },
    [handleCreateProject, switchTab]
  );

  const handleClearLoadedChapter = useCallback(() => {
    setLoadedChapter(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center font-sans text-text-main">
        <Cpu className="w-10 h-10 text-polish animate-spin mb-4" />
        <p className="text-xs font-bold text-text-muted tracking-widest uppercase">Đang khởi tạo bản thảo &amp; cơ sở dữ liệu...</p>
      </div>
    );
  }

  return (
    <div id="ai-story-translator-app" className="min-h-screen bg-ink flex flex-col font-sans text-text-main selection:bg-polish/25 selection:text-text-main">

      {/* Platform Header */}
      <header className="sticky top-0 z-55 h-14 bg-parchment/95 border-b border-parchment-2 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-polish rounded-[3px] flex items-center justify-center text-white shadow-xs">
            <Languages className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-display font-semibold tracking-wide text-text-main flex items-center gap-1.5 leading-none">
              ZHONG-VIET AI TRANSLATOR
              <span className="text-[9px] font-mono text-text-muted bg-parchment-2 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">v2.4.0</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeProject && (
            <div className="hidden sm:flex items-center bg-ink/70 rounded-[3px] px-2.5 py-1 gap-1.5 border border-parchment-2">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Ngữ điệu:</span>
              <span className="text-xs font-medium text-text-main">{activeProject.genre} / {activeProject.tone}</span>
            </div>
          )}

          {authRequired && (
            <button
              onClick={() => {
                if (isAuthenticated) {
                  if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi máy chủ?")) {
                    logoutAuth().then(() => {
                      setIsAuthenticated(false);
                      setShowAuthModal(true);
                    });
                  }
                } else {
                  setShowAuthModal(true);
                }
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-[3px] text-xs font-bold cursor-pointer transition-all border ${
                isAuthenticated
                  ? 'bg-parchment text-text-main border-parchment-2 hover:bg-parchment-2'
                  : 'bg-polish/20 text-polish border-polish/40 hover:bg-polish/30 animate-pulse'
              }`}
              title={isAuthenticated ? "Máy chủ đã xác thực. Bấm để đăng xuất" : "Yêu cầu đăng nhập máy chủ"}
            >
              {isAuthenticated ? <Unlock className="w-3.5 h-3.5 text-text-muted" /> : <Lock className="w-3.5 h-3.5 text-polish" />}
              <span className="hidden sm:inline">{isAuthenticated ? 'Đã khóa máy chủ' : 'Chưa đăng nhập'}</span>
            </button>
          )}

          <button
            onClick={() => setShowApiSettings(true)}
            className="flex items-center gap-1.5 bg-polish hover:bg-[#A03522] active:bg-[#8F2D1E] text-white py-1.5 px-3 rounded-[3px] text-xs font-semibold cursor-pointer transition-all shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            Cấu hình AI ({apiKeys.filter(k => k.trim()).length ? `${apiKeys.filter(k => k.trim()).length} Keys` : 'Hệ thống'})
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-parchment border-b border-parchment-2 sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto scrollbar-none py-0.5">
            <nav className="flex space-x-1 min-w-max">
              <button
                onClick={() => switchTab('translate')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'translate' ? 'border-polish text-text-main font-bold glow-polish' : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <BookOpenText className="w-3.5 h-3.5 shrink-0" />
                Mặt Trận Dịch Thuật
              </button>

              <button
                onClick={() => switchTab('auto-translate')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'auto-translate' ? 'border-polish text-text-main font-bold glow-polish' : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Cpu className={`w-3.5 h-3.5 shrink-0 ${isAutoTranslating ? 'text-polish animate-pulse' : 'text-text-muted'}`} />
                Dịch Tự Động Toàn Bộ
              </button>

              <button
                onClick={() => switchTab('glossary')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'glossary' ? 'border-polish text-text-main font-bold glow-polish' : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                Từ Điển Nhân Vật
                {activeProject && activeProject.glossary.length > 0 && (
                  <span className="bg-parchment-2 text-text-main border border-parchment-2 text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] shrink-0 ml-1">
                    {activeProject.glossary.length}
                  </span>
                )}
                {activeProject && (activeProject.pendingGlossary || []).length > 0 && (
                  <span className="bg-amber-950/60 text-amber-300 border border-amber-800/50 text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] shrink-0 ml-1">
                    {(activeProject.pendingGlossary || []).length} chờ
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('history')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'history' ? 'border-polish text-text-main font-bold glow-polish' : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                Lịch Sử Chương Dịch
                {activeProject && activeProject.chapters.length > 0 && (
                  <span className="bg-parchment-2 text-text-main border border-parchment-2 text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] shrink-0 ml-1">
                    {activeProject.chapters.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('projects')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'projects' ? 'border-polish text-text-main font-bold glow-polish' : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Folder className="w-3.5 h-3.5 shrink-0" />
                Quản Lý Truyện ({projects.length})
              </button>
            </nav>

            {activeProject && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                <span>Bộ đang dịch: </span>
                <strong className="text-text-main font-display bg-ink border border-parchment-2 px-2.5 py-0.5 rounded-[2px] font-bold">
                  {activeProject.title}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <React.Suspense fallback={<TabSkeleton />}>
          {activeProject ? (
            <>
              <div className={activeTab !== 'translate' ? 'hidden' : ''}>
                {visitedTabs.has('translate') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Mặt Trận Dịch Thuật">
                    <MemoTranslatorWorkspace
                      activeProject={activeProject}
                      onUpdateProject={handleUpdateProject}
                      apiKeys={apiKeys}
                      selectedModel={selectedModel}
                      loadedChapter={loadedChapter}
                      onClearLoadedChapter={handleClearLoadedChapter}
                      warningParagraphMismatch={warningParagraphMismatch}
                      enableAiQaCritique={enableAiQaCritique}
                      enableSegmentTranslation={enableSegmentTranslation}
                    />
                  </ErrorBoundary>
                )}
              </div>

              <div className={activeTab !== 'auto-translate' ? 'hidden' : ''}>
                {visitedTabs.has('auto-translate') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Dịch Tự Động Toàn Bộ">
                    <MemoAutoTranslator
                      activeProject={activeProject}
                      onUpdateProject={handleUpdateProject}
                      apiKeys={apiKeys}
                      selectedModel={selectedModel}
                      onProcessingChange={setIsAutoTranslating}
                      enableAiQaCritique={enableAiQaCritique}
                      enableSegmentTranslation={enableSegmentTranslation}
                    />
                  </ErrorBoundary>
                )}
              </div>

              <div className={activeTab !== 'glossary' ? 'hidden' : ''}>
                {visitedTabs.has('glossary') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Từ Điển Nhân Vật">
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
                      onMergeGlossaryItems={handleMergeGlossaryItems}
                      onAddToPending={handleAddToPendingGlossary}
                      onConfirmPending={handleConfirmPendingItem}
                      onDiscardPending={handleDiscardPendingItem}
                      activeProject={activeProject}
                      onUpdateProject={handleUpdateProject}
                    />
                  </ErrorBoundary>
                )}
              </div>

              <div className={activeTab !== 'projects' ? 'hidden' : ''}>
                {visitedTabs.has('projects') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Quản Lý Truyện">
                    <MemoProjectList
                      projects={projects}
                      activeProjectId={activeProjectId}
                      onSelectProject={handleSelectProjectAndSwitch}
                      onDeleteProject={handleDeleteProject}
                      onCreateProject={handleCreateProjectAndSwitch}
                      onUpdateProject={handleUpdateProject}
                      apiKeys={apiKeys}
                      selectedModel={selectedModel}
                      isLoading={isLoading}
                    />
                  </ErrorBoundary>
                )}
              </div>

              <div className={activeTab !== 'history' ? 'hidden' : ''}>
                {visitedTabs.has('history') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Lịch Sử Chương Dịch">
                    <MemoChapterHistoryPanel
                      activeProject={activeProject}
                      onUpdateProject={handleUpdateProject}
                      onDeleteChapterHistory={handleDeleteChapterHistory}
                      onGoToTranslate={handleGoToTranslate}
                      onResetChapters={handleResetChapters}
                    />
                  </ErrorBoundary>
                )}
              </div>
            </>
          ) : (
            <ErrorBoundary fallbackTitle="Lỗi phân vùng: Quản Lý Truyện (Không có Dự Án)">
              <MemoProjectList
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProjectAndSwitch}
                onDeleteProject={handleDeleteProject}
                onCreateProject={handleCreateProjectAndSwitch}
                onUpdateProject={handleUpdateProject}
                apiKeys={apiKeys}
                selectedModel={selectedModel}
                isLoading={isLoading}
              />
            </ErrorBoundary>
          )}
        </React.Suspense>
      </main>

      {/* Footer */}
      <footer className="bg-parchment border-t border-parchment-2 text-text-muted py-8 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-[2px] bg-ink flex items-center justify-center border border-parchment-2">
              <Languages className="w-3 h-3 text-polish" />
            </div>
            <span className="font-display font-semibold text-text-main tracking-wider uppercase text-[11px]">ZHONG-VIET AI TRANSLATOR</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-text-muted font-medium justify-center md:justify-end">
            <span>Dịch Giản &amp; Phồn thể</span>
            <span>Glossary Manager v2.4</span>
            <span className="bg-ink px-2 py-0.5 rounded-[2px] text-[10px] text-text-main border border-parchment-2">IndexedDB Persistent Storage</span>
          </div>
        </div>
      </footer>

      {/* Modal Cấu hình AI */}
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
          warningParagraphMismatch={warningParagraphMismatch}
          setWarningParagraphMismatch={setWarningParagraphMismatch}
          enableAiQaCritique={enableAiQaCritique}
          setEnableAiQaCritique={setEnableAiQaCritique}
          enableSegmentTranslation={enableSegmentTranslation}
          setEnableSegmentTranslation={setEnableSegmentTranslation}
        />
      )}

      {/* Modal Mật Khẩu Truy Cập Máy Chủ */}
      <AuthModal
        isOpen={showAuthModal}
        canDismiss={isAuthenticated}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setIsAuthenticated(true);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AIConfigProvider>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </AIConfigProvider>
    </NotificationProvider>
  );
}
