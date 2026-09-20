import { useState, useEffect, useCallback, useTransition } from 'react';
import { Cpu } from 'lucide-react';
import { Chapter } from './types';
import type { HighlightIntent } from './types/audit';
import { NotificationProvider, useNotifications } from './components/NotificationSystem';
import { getChapterFromDB } from './services/db';
import { AIConfigProvider, useAIConfigContext } from './context/AIConfigContext';
import { ProjectProvider, useProjectContext } from './context/ProjectContext';
import { useHotkeys } from './hooks/useHotkeys';
import { I18nProvider } from './i18n/I18nContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotFoundPage } from './components/common/NotFoundPage';
import { useSeoMetadata } from './hooks/useSeoMetadata';
import { AppHeader } from './components/layout/AppHeader';
import { AppTabBar } from './components/layout/AppTabBar';
import { TabContent } from './components/layout/TabContent';
import { AppFooter } from './components/layout/AppFooter';
import { ApiSettingsModal } from './components/layout/ApiSettingsModal';
import { GoogleSyncSection } from './components/layout/GoogleSyncSection';
import { VALID_TABS, TabType, TAB_METADATA } from './config/tabMetadata';

function AppShell() {
  const { projects, activeProject, isLoading } = useProjectContext();
  const { apiKeys } = useAIConfigContext();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabType>('translate');
  const [isNotFound, setIsNotFound] = useState(false);
  const [, startTransition] = useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['translate']));
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showGoogleSyncModal, setShowGoogleSyncModal] = useState(false);
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const [pendingHighlightIntent, setPendingHighlightIntent] = useState<HighlightIntent | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window === 'undefined') return;
      const rawPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!rawPath) {
        setIsNotFound(false);
        return;
      }
      if (VALID_TABS.includes(rawPath as TabType)) {
        setIsNotFound(false);
        setActiveTab(rawPath as TabType);
        setVisitedTabs((prev) => (prev.has(rawPath) ? prev : new Set([...prev, rawPath])));
      } else {
        setIsNotFound(true);
      }
    };
    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const currentMeta = TAB_METADATA[activeTab] || TAB_METADATA['translate'];
  const pageTitle = activeProject?.title ? `${activeProject.title} — ${currentMeta.title}` : currentMeta.title;

  useSeoMetadata({
    title: isNotFound ? 'Bản Thảo Thất Lạc (404)' : pageTitle,
    description: isNotFound
      ? 'Trang bản thảo hoặc phân vùng bạn tìm kiếm tựa như mây khói hư ảo, không còn lưu vết trong tàng kinh các.'
      : currentMeta.desc,
    canonicalPath: isNotFound ? '/404' : (activeTab === 'translate' ? '' : `/${activeTab}`),
  });

  const switchTab = useCallback((tab: TabType) => {
    setIsNotFound(false);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set([...prev, tab])));
    startTransition(() => setActiveTab(tab));
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = tab === 'translate' ? '/' : `/${tab}`;
      if (window.location.pathname !== targetPath) window.history.pushState(null, '', targetPath);
    }
  }, []);

  const handleGoToTranslate = useCallback((chapter?: Chapter) => {
    setLoadedChapter(chapter || null);
    switchTab('translate');
  }, [switchTab]);

  const handleOpenChapterFromHakoChecker = useCallback(async (
    chapterId: string,
    options?: { snippet?: string; issueId?: string }
  ) => {
    try {
      const chapter = await getChapterFromDB(chapterId);
      if (!chapter) {
        showToast({ message: 'Không tìm thấy dữ liệu chương!', type: 'error' });
        return;
      }
      if (options?.snippet) {
        setPendingHighlightIntent({
          chapterId,
          snippet: options.snippet,
          issueId: options.issueId,
          timestamp: Date.now(),
        });
      } else {
        setPendingHighlightIntent(null);
      }
      handleGoToTranslate(chapter);
    } catch (err) {
      console.error('[AppShell] handleOpenChapterFromHakoChecker error:', err);
      showToast({
        message: 'Lỗi khi tải dữ liệu chương: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      });
    }
  }, [handleGoToTranslate, showToast]);

  useHotkeys('alt+1', () => switchTab('translate'));
  useHotkeys('alt+2', () => switchTab('auto-translate'));
  useHotkeys('alt+3', () => switchTab('glossary'));
  useHotkeys('alt+4', () => switchTab('history'));
  useHotkeys('alt+5', () => switchTab('projects'));
  useHotkeys('alt+6', () => switchTab('hako-checker'));
  useHotkeys('alt+,', () => setShowApiSettings((prev) => !prev));
  useHotkeys('escape', () => { if (showApiSettings) setShowApiSettings(false); });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center font-sans text-text-main">
        <Cpu className="w-10 h-10 text-polish animate-spin mb-4" />
        <p className="text-xs font-bold text-text-muted tracking-widest uppercase">
          Đang khởi tạo bản thảo &amp; cơ sở dữ liệu...
        </p>
      </div>
    );
  }

  return (
    <div id="ai-story-translator-app" className="min-h-screen w-full max-w-full overflow-x-clip bg-ink flex flex-col font-sans text-text-main selection:bg-polish/25 selection:text-text-main">
      {/* Skip to Content accessible link for keyboard / screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3.5 focus:py-1.5 focus:bg-polish focus:text-white focus:font-bold focus:rounded-[2px] focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Bỏ qua đến nội dung chính
      </a>

      <AppHeader
        activeTab={activeTab}
        onSwitchTab={switchTab}
        activeProject={activeProject}
        apiKeys={apiKeys}
        onOpenApiSettings={() => setShowApiSettings(true)}
        onOpenCustomThemeModal={() => setShowCustomThemeModal(true)}
        onOpenGoogleSyncModal={() => setShowGoogleSyncModal(true)}
      />
      <AppTabBar
        activeTab={activeTab}
        onSwitchTab={switchTab}
        activeProject={activeProject}
        projectsCount={projects.length}
        isAutoTranslating={isAutoTranslating}
      />
      {isNotFound ? (
        <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none">
          <NotFoundPage onGoHome={() => switchTab('translate')} />
        </main>
      ) : (
        <TabContent
          activeTab={activeTab}
          visitedTabs={visitedTabs}
          loadedChapter={loadedChapter}
          pendingHighlightIntent={pendingHighlightIntent}
          onClearHighlightIntent={() => setPendingHighlightIntent(null)}
          currentMetaTitle={currentMeta.title}
          onSwitchTab={switchTab}
          onClearLoadedChapter={() => setLoadedChapter(null)}
          onAutoTranslateProcessingChange={setIsAutoTranslating}
          onGoToTranslate={handleGoToTranslate}
          onOpenChapterFromHakoChecker={handleOpenChapterFromHakoChecker}
        />
      )}
      <AppFooter />
      <ApiSettingsModal isOpen={showApiSettings} onClose={() => setShowApiSettings(false)} />
      <GoogleSyncSection
        showGoogleSyncModal={showGoogleSyncModal}
        onCloseGoogleSyncModal={() => setShowGoogleSyncModal(false)}
        showCustomThemeModal={showCustomThemeModal}
        onCloseCustomThemeModal={() => setShowCustomThemeModal(false)}
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
              <AppShell />
            </ProjectProvider>
          </AIConfigProvider>
        </NotificationProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
