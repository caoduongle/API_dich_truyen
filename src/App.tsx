import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  BookOpenText, Settings, History, Folder, Cpu, Languages, Lock, Unlock, ShieldCheck 
} from 'lucide-react';
import { Chapter, StoryProject } from './types';
import { NotificationProvider } from './components/NotificationSystem';
import { AIConfigProvider, useAIConfigContext } from './context/AIConfigContext';
import { ProjectProvider, useProjectContext } from './context/ProjectContext';
import { checkAuthStatus, logoutAuth } from './utils/apiClient';
import { TabSkeleton } from './components/common/Skeleton';
import { useHotkeys } from './hooks/useHotkeys';
import { useScrollOverflow } from './hooks/useScrollOverflow';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageSelector } from './components/common/LanguageSelector';
import { ThemeSwitcher } from './components/common/ThemeSwitcher';
import { CustomThemeModal } from './components/common/CustomThemeModal';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Kbd } from './components/ui/Kbd';
import { Seal } from './components/ui/Seal';

// Code splitting các tab nặng qua React.lazy để tối ưu hóa initial bundle parse time
const TranslatorWorkspace = React.lazy(() => import('./components/TranslatorWorkspace'));
const AutoTranslator = React.lazy(() => import('./components/AutoTranslator'));
const GlossaryManager = React.lazy(() => import('./components/GlossaryManager'));
const ProjectList = React.lazy(() => import('./components/ProjectList'));
const ChapterHistoryPanel = React.lazy(() => import('./components/ChapterHistoryPanel'));
const ApiSettings = React.lazy(() => import('./components/ApiSettings'));
const HakoCheckerWorkspace = React.lazy(() => import('./components/hako-checker/HakoCheckerWorkspace'));
import AuthModal from './components/AuthModal';
import { GoogleUserButton } from './components/google-sync/GoogleUserButton';
import { GoogleSyncModal } from './components/google-sync/GoogleSyncModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const MemoTranslatorWorkspace = React.memo(TranslatorWorkspace);
const MemoAutoTranslator = React.memo(AutoTranslator);
const MemoGlossaryManager = React.memo(GlossaryManager);
const MemoProjectList = React.memo(ProjectList);
const MemoChapterHistoryPanel = React.memo(ChapterHistoryPanel);
const MemoHakoCheckerWorkspace = React.memo(HakoCheckerWorkspace);

const EMPTY_PENDING_GLOSSARY: never[] = [];

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
    reloadProjects,
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
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker'>('translate');
  const [, startTransition] = useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['translate']));

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showGoogleSyncModal, setShowGoogleSyncModal] = useState(false);
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);

  const {
    containerRef: tabNavContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollToElement,
  } = useScrollOverflow<HTMLDivElement>();

  // Tự động cuộn tab kích hoạt vào vùng nhìn thấy khi activeTab thay đổi (click hoặc phím tắt Alt+1..6)
  useEffect(() => {
    scrollToElement(`tab-${activeTab}`, 'smooth');
  }, [activeTab, scrollToElement]);


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

  const switchTab = useCallback((tab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker') => {
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

  // Phím tắt bàn phím toàn cục
  useHotkeys('alt+1', () => switchTab('translate'));
  useHotkeys('alt+2', () => switchTab('auto-translate'));
  useHotkeys('alt+3', () => switchTab('glossary'));
  useHotkeys('alt+4', () => switchTab('history'));
  useHotkeys('alt+5', () => switchTab('projects'));
  useHotkeys('alt+6', () => switchTab('hako-checker'));
  useHotkeys('alt+,', () => setShowApiSettings((prev) => !prev));
  useHotkeys('escape', () => {
    if (showApiSettings) setShowApiSettings(false);
  });

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

      {/* Platform Header — z-30 ladder rule */}
      <header className="sticky top-0 z-30 h-14 bg-parchment/95 backdrop-blur-xs border-b border-parchment-2 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <Seal character="譯" className="text-[13px]" />
          <div>
            <h1 className="text-xs sm:text-sm font-display font-semibold tracking-wide text-text-main flex items-center gap-1.5 leading-none">
              {t('common.appTitle')}
              <span className="text-[9px] font-mono text-text-muted bg-parchment-2 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">v2.4.0</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {activeProject && (
            <div className="hidden sm:flex items-center bg-ink/70 rounded-[2px] px-2.5 py-1 gap-1.5 border border-parchment-2">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Ngữ điệu:</span>
              <span className="text-xs font-medium text-text-main">{activeProject.genre} / {activeProject.tone}</span>
            </div>
          )}

          {/* Language Selector */}
          <LanguageSelector />

          {/* Theme Selector (Dark, Light, Sepia, Custom) */}
          <ThemeSwitcher onOpenCustomModal={() => setShowCustomThemeModal(true)} />

          {/* Google Account & Drive Sync */}
          <GoogleUserButton onOpenSyncModal={() => setShowGoogleSyncModal(true)} />

          {authRequired && (
            <Button
              variant={isAuthenticated ? 'secondary' : 'primary'}
              size="sm"
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
              icon={isAuthenticated ? <Unlock className="w-3.5 h-3.5 text-text-muted" /> : <Lock className="w-3.5 h-3.5 text-white" />}
              className={!isAuthenticated ? 'animate-pulse' : ''}
              title={isAuthenticated ? "Máy chủ đã xác thực. Bấm để đăng xuất" : "Yêu cầu đăng nhập máy chủ"}
            >
              <span className="hidden sm:inline">{isAuthenticated ? 'Đã khóa máy chủ' : 'Chưa đăng nhập'}</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowApiSettings(true)}
            icon={<Settings className="w-3.5 h-3.5" />}
          >
            {t('nav.aiConfig')} ({apiKeys.filter(k => k.trim()).length ? `${apiKeys.filter(k => k.trim()).length} ${t('common.keys')}` : 'Chưa có key'})
          </Button>
        </div>
      </header>

      {/* Tab Navigation — z-30 ladder rule */}
      <div className="bg-parchment border-b border-parchment-2 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 py-0.5">
            {/* Scrollable Tab Navigation Area with Fade Overlays */}
            <div className="relative flex-1 min-w-0 overflow-hidden">
              {/* Left Fade Overlay */}
              {canScrollLeft && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-parchment to-transparent z-10"
                />
              )}

              {/* Scrollable Tabs Row */}
              <div
                ref={tabNavContainerRef}
                className="overflow-x-auto scrollbar-none"
              >
                <nav role="tablist" aria-label="Phân vùng làm việc chính" className="flex space-x-1 min-w-max">
                  <button
                    id="tab-translate"
                    role="tab"
                    aria-selected={activeTab === 'translate'}
                    aria-controls="panel-translate"
                    tabIndex={0}
                    onClick={() => switchTab('translate')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === 'translate'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <BookOpenText className="w-3.5 h-3.5 shrink-0 text-polish" />
                    <span>{t('nav.translate')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+1</Kbd>
                  </button>

                  <button
                    id="tab-auto-translate"
                    role="tab"
                    aria-selected={activeTab === 'auto-translate'}
                    aria-controls="panel-auto-translate"
                    tabIndex={0}
                    onClick={() => switchTab('auto-translate')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                      activeTab === 'auto-translate'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Cpu className={`w-3.5 h-3.5 shrink-0 ${isAutoTranslating ? 'text-polish animate-pulse' : 'text-text-muted'}`} />
                    <span>{t('nav.autoTranslate')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+2</Kbd>
                  </button>

                  <button
                    id="tab-glossary"
                    role="tab"
                    aria-selected={activeTab === 'glossary'}
                    aria-controls="panel-glossary"
                    tabIndex={0}
                    onClick={() => switchTab('glossary')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                      activeTab === 'glossary'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.glossary')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+3</Kbd>
                    {activeProject && activeProject.glossary.length > 0 && (
                      <Badge tone="neutral" className="ml-0.5">
                        {activeProject.glossary.length}
                      </Badge>
                    )}
                    {activeProject && (activeProject.pendingGlossary || EMPTY_PENDING_GLOSSARY).length > 0 && (
                      <Badge tone="warning" className="ml-0.5">
                        {t('glossary.pendingCount', { count: (activeProject.pendingGlossary || EMPTY_PENDING_GLOSSARY).length })}
                      </Badge>
                    )}
                  </button>

                  <button
                    id="tab-history"
                    role="tab"
                    aria-selected={activeTab === 'history'}
                    aria-controls="panel-history"
                    tabIndex={0}
                    onClick={() => switchTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                      activeTab === 'history'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.history')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+4</Kbd>
                    {activeProject && activeProject.chapters.length > 0 && (
                      <Badge tone="neutral" className="ml-0.5">
                        {activeProject.chapters.length}
                      </Badge>
                    )}
                  </button>

                  <button
                    id="tab-projects"
                    role="tab"
                    aria-selected={activeTab === 'projects'}
                    aria-controls="panel-projects"
                    tabIndex={0}
                    onClick={() => switchTab('projects')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === 'projects'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.projects')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+5</Kbd>
                    <Badge tone="neutral" className="ml-0.5">
                      {projects.length}
                    </Badge>
                  </button>

                  <button
                    id="tab-hako-checker"
                    role="tab"
                    aria-selected={activeTab === 'hako-checker'}
                    aria-controls="panel-hako-checker"
                    tabIndex={0}
                    onClick={() => switchTab('hako-checker')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === 'hako-checker'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-polish" />
                    <span>{t('nav.hakoChecker')}</span>
                    <Kbd className="hidden md:inline-block text-[9px]">Alt+6</Kbd>
                  </button>
                </nav>
              </div>

              {/* Right Fade Overlay */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-parchment to-transparent z-10"
                />
              )}
            </div>

            {/* Static Project Title Indicator */}
            {activeProject && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted shrink-0 pl-3 border-l border-parchment-2/60 ml-1"
                title={`${t('nav.currentBook')}: ${activeProject.title}`}
              >
                <span className="shrink-0">{t('nav.currentBook')}: </span>
                <strong className="text-text-main font-display bg-ink border border-parchment-2 px-2.5 py-0.5 rounded-[2px] font-bold truncate max-w-[160px] md:max-w-[220px] lg:max-w-[300px]">
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
              <div
                id="panel-translate"
                role="tabpanel"
                aria-labelledby="tab-translate"
                className={activeTab !== 'translate' ? 'hidden' : ''}
              >
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

              <div
                id="panel-auto-translate"
                role="tabpanel"
                aria-labelledby="tab-auto-translate"
                className={activeTab !== 'auto-translate' ? 'hidden' : ''}
              >
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

              <div
                id="panel-glossary"
                role="tabpanel"
                aria-labelledby="tab-glossary"
                className={activeTab !== 'glossary' ? 'hidden' : ''}
              >
                {visitedTabs.has('glossary') && (
                  <ErrorBoundary fallbackTitle="Lỗi phân vùng: Từ Điển Nhân Vật">
                    <MemoGlossaryManager
                      projectId={activeProject.id}
                      glossary={activeProject.glossary}
                      pendingGlossary={activeProject.pendingGlossary || EMPTY_PENDING_GLOSSARY}
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

              <div
                id="panel-projects"
                role="tabpanel"
                aria-labelledby="tab-projects"
                className={activeTab !== 'projects' ? 'hidden' : ''}
              >
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

              <div
                id="panel-history"
                role="tabpanel"
                aria-labelledby="tab-history"
                className={activeTab !== 'history' ? 'hidden' : ''}
              >
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
              <div
                id="panel-projects"
                role="tabpanel"
                aria-labelledby="tab-projects"
                className={activeTab !== 'projects' ? 'hidden' : ''}
              >
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
              </div>
            </ErrorBoundary>
          )}

          <div
            id="panel-hako-checker"
            role="tabpanel"
            aria-labelledby="tab-hako-checker"
            className={activeTab !== 'hako-checker' ? 'hidden' : ''}
          >
            {visitedTabs.has('hako-checker') && (
              <ErrorBoundary fallbackTitle="Lỗi phân vùng: Kiểm Định Hako">
                <MemoHakoCheckerWorkspace
                  apiKeys={apiKeys}
                  selectedModel={selectedModel}
                />
              </ErrorBoundary>
            )}
          </div>
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

      {/* Modal Đồng Bộ Google Drive */}
      <GoogleSyncModal
        isOpen={showGoogleSyncModal}
        onClose={() => setShowGoogleSyncModal(false)}
        onDataChanged={reloadProjects}
      />

      {/* Modal Tùy Chỉnh Bảng Màu Đọc */}
      <CustomThemeModal
        open={showCustomThemeModal}
        onClose={() => setShowCustomThemeModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <NotificationProvider>
          <AIConfigProvider>
            <ProjectProvider>
              <AppContent />
            </ProjectProvider>
          </AIConfigProvider>
        </NotificationProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
