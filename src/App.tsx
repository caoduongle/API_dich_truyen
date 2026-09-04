import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  BookOpenText, Settings, History, Folder, Cpu, Languages, Lock, Unlock, ShieldCheck,
  ChevronLeft, ChevronRight, MoreHorizontal, ChevronDown, X, Phone, Mail
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
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Kbd } from './components/ui/Kbd';
import { Seal } from './components/ui/Seal';

// Code splitting các tab nặng & modals qua React.lazy để tối ưu hóa initial bundle parse time
const TranslatorWorkspace = React.lazy(() => import('./components/TranslatorWorkspace'));
const AutoTranslator = React.lazy(() => import('./components/AutoTranslator'));
const GlossaryManager = React.lazy(() => import('./components/GlossaryManager'));
const ProjectList = React.lazy(() => import('./components/ProjectList'));
const ChapterHistoryPanel = React.lazy(() => import('./components/ChapterHistoryPanel'));
const ApiSettings = React.lazy(() => import('./components/ApiSettings'));
const HakoCheckerWorkspace = React.lazy(() => import('./components/hako-checker/HakoCheckerWorkspace'));
const AuthModal = React.lazy(() => import('./components/AuthModal'));
const GoogleSyncModal = React.lazy(() => import('./components/google-sync/GoogleSyncModal').then(m => ({ default: m.GoogleSyncModal })));
const CustomThemeModal = React.lazy(() => import('./components/common/CustomThemeModal').then(m => ({ default: m.CustomThemeModal })));
import { GoogleUserButton } from './components/google-sync/GoogleUserButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/common/NotFoundPage';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { useSeoMetadata } from './hooks/useSeoMetadata';

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

  const VALID_TABS = React.useMemo(() => ['translate', 'auto-translate', 'glossary', 'history', 'projects', 'hako-checker'], []);
  const [activeTab, setActiveTab] = useState<'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker'>('translate');
  const [isNotFound, setIsNotFound] = useState(false);
  const [, startTransition] = useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['translate']));

  // Đồng bộ pathname URL khi nạp ứng dụng và khi bấm Back/Forward trình duyệt
  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window === 'undefined') return;
      const rawPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!rawPath) {
        setIsNotFound(false);
        return;
      }
      if (VALID_TABS.includes(rawPath)) {
        setIsNotFound(false);
        setActiveTab(rawPath as any);
        setVisitedTabs((prev) => new Set([...prev, rawPath]));
      } else {
        setIsNotFound(true);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [VALID_TABS]);

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showGoogleSyncModal, setShowGoogleSyncModal] = useState(false);
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);

  const {
    containerRef: tabNavContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollToElement,
    scrollLeftAction,
    scrollRightAction,
  } = useScrollOverflow<HTMLDivElement>({ threshold: 2, scrollStep: 220 });

  const [showMoreNavMenu, setShowMoreNavMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement | null>(null);

  // Đóng More Menu khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    if (!showMoreNavMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreNavMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMoreNavMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreNavMenu]);

  // Cấu hình metadata On-Page SEO động theo thời gian thực (Page Title, Meta Description, Canonical URL)
  const tabMetadata: Record<string, { title: string; desc: string }> = React.useMemo(() => ({
    'translate': {
      title: 'Bàn Dịch Thuật',
      desc: 'Không gian dịch thuật song ngữ Trung - Việt gióng hàng thời gian thực, tích hợp tra cứu từ điển và đối chiếu ngữ cảnh AI.',
    },
    'auto-translate': {
      title: 'Dịch Tự Động Toàn Bộ',
      desc: 'Quy trình dịch thuật tự động 2 pha (dịch thô & mài giũa) xử lý hàng loạt chương tiểu thuyết với độ nhất quán cao.',
    },
    'glossary': {
      title: 'Từ Điển Nhân Vật & Thuật Ngữ',
      desc: 'Quản lý kho từ vựng, tên nhân vật, địa danh và thuật ngữ chuyên ngành tiếng Hán cho tác phẩm.',
    },
    'history': {
      title: 'Lịch Sử Chương Dịch',
      desc: 'Theo dõi tiến trình phiên bản, đối chiếu bản thảo trước sau và khôi phục các phân đoạn dịch.',
    },
    'projects': {
      title: 'Quản Lý Tiểu Thuyết',
      desc: 'Danh sách và thông tin các bộ truyện, thống kê tiến độ chương và thiết lập cấu hình riêng cho từng tác phẩm.',
    },
    'hako-checker': {
      title: 'Kiểm Định Chất Lượng Hako',
      desc: 'Công cụ rà soát lỗi chính tả, từ cấm, định dạng đoạn văn theo tiêu chuẩn biên tập tiểu thuyết mạng Hako.',
    },
  }), []);

  const currentMeta = tabMetadata[activeTab] || tabMetadata['translate'];
  const pageTitle = activeProject?.title ? `${activeProject.title} — ${currentMeta.title}` : currentMeta.title;

  useSeoMetadata({
    title: isNotFound ? 'Bản Thảo Thất Lạc (404)' : pageTitle,
    description: isNotFound
      ? 'Trang bản thảo hoặc phân vùng bạn tìm kiếm tựa như mây khói hư ảo, không còn lưu vết trong tàng kinh các.'
      : currentMeta.desc,
    canonicalPath: isNotFound ? '/404' : (activeTab === 'translate' ? '' : `/${activeTab}`),
  });

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
    setIsNotFound(false);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    startTransition(() => {
      setActiveTab(tab);
    });
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = tab === 'translate' ? '/' : `/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
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
    <div id="ai-story-translator-app" className="min-h-screen w-full max-w-full overflow-x-clip bg-ink flex flex-col font-sans text-text-main selection:bg-polish/25 selection:text-text-main">

      {/* Platform Header — z-30 ladder rule */}
      <header className="sticky top-0 z-30 h-14 bg-parchment/95 backdrop-blur-xs border-b border-parchment-2 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Nút Mobile Hamburger Menu */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={isMobileMenuOpen}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-[2px] bg-ink/60 border border-parchment-2 text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4 text-polish" /> : <MoreHorizontal className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => switchTab('translate')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group focus:outline-none text-left"
            title="Quay lại Bàn Dịch chính"
          >
            <Seal character="譯" className="text-[13px] group-hover:scale-105 transition-transform" />
            <div>
              <h1 className="text-xs sm:text-sm font-display font-semibold tracking-wide text-text-main flex items-center gap-1.5 leading-none">
                {t('common.appTitle')}
                <span className="text-[9px] font-mono text-text-muted bg-parchment-2 px-1.5 py-0.5 rounded-[2px] border border-parchment-2">v2.4.0</span>
              </h1>
            </div>
          </button>
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

      {/* Mobile Drawer Navigation Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 top-14 z-40 bg-ink/80 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-parchment border-b border-parchment-2 shadow-xl p-4 space-y-1.5 animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-parchment-2 mb-2 flex items-center justify-between">
              <span>Phân vùng làm việc</span>
              <span className="text-[9px] text-polish font-mono">6 Phân Vùng</span>
            </div>
            {[
              { key: 'translate', icon: BookOpenText, label: t('nav.translate'), shortcut: 'Alt+1' },
              { key: 'auto-translate', icon: Cpu, label: t('nav.autoTranslate'), shortcut: 'Alt+2' },
              { key: 'glossary', icon: Settings, label: t('nav.glossary'), shortcut: 'Alt+3' },
              { key: 'history', icon: History, label: t('nav.history'), shortcut: 'Alt+4' },
              { key: 'projects', icon: Folder, label: t('nav.projects'), shortcut: 'Alt+5' },
              { key: 'hako-checker', icon: ShieldCheck, label: t('nav.hakoChecker'), shortcut: 'Alt+6' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    switchTab(tab.key as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-parchment-2 text-text-main border-l-2 border-polish font-bold'
                      : 'text-text-muted hover:text-text-main hover:bg-parchment-2/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-polish' : 'text-text-muted'}`} />
                    <span>{tab.label}</span>
                  </div>
                  <Kbd className="text-[9px]">{tab.shortcut}</Kbd>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Navigation — z-30 ladder rule */}
      <div className="bg-parchment border-b border-parchment-2 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 py-0.5">
            {/* Scrollable Tab Navigation Area with Chevrons & Fade Overlays */}
            <div className="relative flex-1 min-w-0 overflow-hidden">
              {/* Left Chevron Button */}
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={scrollLeftAction}
                  aria-label="Cuộn các tab sang trái"
                  title="Cuộn các tab sang trái"
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-ink/90 border border-parchment-2 text-text-muted hover:text-text-main shadow-xs transition-all hover:bg-parchment-2/80 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Left Fade Overlay */}
              {canScrollLeft && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-parchment to-transparent z-10"
                />
              )}

              {/* Scrollable Tabs Row */}
              <div
                ref={tabNavContainerRef}
                className="overflow-x-auto scrollbar-none scroll-smooth"
              >
                <nav role="tablist" aria-label="Phân vùng làm việc chính" className="flex space-x-1 min-w-max">
                  <button
                    id="tab-translate"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'translate'}
                    aria-controls="panel-translate"
                    tabIndex={0}
                    onClick={() => switchTab('translate')}
                    title={`${t('nav.translate')} (Alt+1)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                      activeTab === 'translate'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <BookOpenText className="w-3.5 h-3.5 shrink-0 text-polish" />
                    <span>{t('nav.translate')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+1</Kbd>
                  </button>

                  <button
                    id="tab-auto-translate"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'auto-translate'}
                    aria-controls="panel-auto-translate"
                    tabIndex={0}
                    onClick={() => switchTab('auto-translate')}
                    title={`${t('nav.autoTranslate')} (Alt+2)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                      activeTab === 'auto-translate'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Cpu className={`w-3.5 h-3.5 shrink-0 ${isAutoTranslating ? 'text-polish animate-pulse' : 'text-text-muted'}`} />
                    <span>{t('nav.autoTranslate')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+2</Kbd>
                  </button>

                  <button
                    id="tab-glossary"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'glossary'}
                    aria-controls="panel-glossary"
                    tabIndex={0}
                    onClick={() => switchTab('glossary')}
                    title={`${t('nav.glossary')} (Alt+3)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                      activeTab === 'glossary'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.glossary')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+3</Kbd>
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
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'history'}
                    aria-controls="panel-history"
                    tabIndex={0}
                    onClick={() => switchTab('history')}
                    title={`${t('nav.history')} (Alt+4)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                      activeTab === 'history'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.history')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+4</Kbd>
                    {activeProject && activeProject.chapters.length > 0 && (
                      <Badge tone="neutral" className="ml-0.5">
                        {activeProject.chapters.length}
                      </Badge>
                    )}
                  </button>

                  <button
                    id="tab-projects"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'projects'}
                    aria-controls="panel-projects"
                    tabIndex={0}
                    onClick={() => switchTab('projects')}
                    title={`${t('nav.projects')} (Alt+5)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                      activeTab === 'projects'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                    <span>{t('nav.projects')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+5</Kbd>
                    <Badge tone="neutral" className="ml-0.5">
                      {projects.length}
                    </Badge>
                  </button>

                  <button
                    id="tab-hako-checker"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'hako-checker'}
                    aria-controls="panel-hako-checker"
                    tabIndex={0}
                    onClick={() => switchTab('hako-checker')}
                    title={`${t('nav.hakoChecker')} (Alt+6)`}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                      activeTab === 'hako-checker'
                        ? 'border-polish text-text-main bg-parchment-2/40'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-polish" />
                    <span>{t('nav.hakoChecker')}</span>
                    <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+6</Kbd>
                  </button>
                </nav>
              </div>

              {/* Right Fade Overlay */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-parchment to-transparent z-10"
                />
              )}

              {/* Right Chevron Button */}
              {canScrollRight && (
                <button
                  type="button"
                  onClick={scrollRightAction}
                  aria-label="Cuộn các tab sang phải"
                  title="Cuộn các tab sang phải"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-ink/90 border border-parchment-2 text-text-muted hover:text-text-main shadow-xs transition-all hover:bg-parchment-2/80 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* More Tabs Popover Dropdown Menu */}
            <div className="relative shrink-0 hidden sm:flex xl:hidden items-center">
              <button
                id="nav-more-menu-btn"
                type="button"
                onClick={() => setShowMoreNavMenu((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={showMoreNavMenu}
                title="Danh sách tất cả phân vùng làm việc"
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                  showMoreNavMenu
                    ? 'bg-parchment-2 border-polish/50 text-text-main'
                    : 'bg-ink/40 border-parchment-2/80 text-text-muted hover:text-text-main hover:bg-parchment-2/30'
                }`}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Thêm</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showMoreNavMenu ? 'rotate-180' : ''}`} />
              </button>

              {showMoreNavMenu && (
                <div
                  ref={moreMenuRef}
                  role="menu"
                  aria-label="Danh sách tất cả phân vùng làm việc"
                  className="absolute right-0 top-full mt-1.5 w-64 bg-parchment border border-parchment-2 rounded-md shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-parchment-2/60 mb-1">
                    Chuyển nhanh phân vùng
                  </div>
                  {[
                    {
                      key: 'translate' as const,
                      icon: BookOpenText,
                      label: t('nav.translate'),
                      shortcut: 'Alt+1',
                      badge: null,
                    },
                    {
                      key: 'auto-translate' as const,
                      icon: Cpu,
                      label: t('nav.autoTranslate'),
                      shortcut: 'Alt+2',
                      badge: null,
                    },
                    {
                      key: 'glossary' as const,
                      icon: Settings,
                      label: t('nav.glossary'),
                      shortcut: 'Alt+3',
                      badge: activeProject && activeProject.glossary.length > 0 ? (
                        <Badge tone="neutral" className="ml-0.5">
                          {activeProject.glossary.length}
                        </Badge>
                      ) : null,
                    },
                    {
                      key: 'history' as const,
                      icon: History,
                      label: t('nav.history'),
                      shortcut: 'Alt+4',
                      badge: activeProject && activeProject.chapters.length > 0 ? (
                        <Badge tone="neutral" className="ml-0.5">
                          {activeProject.chapters.length}
                        </Badge>
                      ) : null,
                    },
                    {
                      key: 'projects' as const,
                      icon: Folder,
                      label: t('nav.projects'),
                      shortcut: 'Alt+5',
                      badge: (
                        <Badge tone="neutral" className="ml-0.5">
                          {projects.length}
                        </Badge>
                      ),
                    },
                    {
                      key: 'hako-checker' as const,
                      icon: ShieldCheck,
                      label: t('nav.hakoChecker'),
                      shortcut: 'Alt+6',
                      badge: null,
                    },
                  ].map((tabItem) => {
                    const ItemIcon = tabItem.icon;
                    const isItemActive = activeTab === tabItem.key;
                    return (
                      <button
                        key={tabItem.key}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          switchTab(tabItem.key);
                          setShowMoreNavMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                          isItemActive
                            ? 'bg-parchment-2/60 text-text-main font-bold border-l-2 border-polish'
                            : 'text-text-muted hover:text-text-main hover:bg-parchment-2/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${isItemActive ? 'text-polish' : 'text-text-muted'}`} />
                          <span className="truncate">{tabItem.label}</span>
                          {tabItem.badge}
                        </div>
                        <Kbd className="text-[9px] shrink-0 ml-2">{tabItem.shortcut}</Kbd>
                      </button>
                    );
                  })}
                </div>
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
        {isNotFound ? (
          <NotFoundPage
            onGoHome={() => {
              setIsNotFound(false);
              switchTab('translate');
            }}
          />
        ) : (
          <>
            {/* Breadcrumbs điều hướng phân cấp ngữ nghĩa */}
            <Breadcrumbs
              items={[
                ...(activeProject ? [{ label: activeProject.title, onClick: () => switchTab('projects') }] : []),
                { label: currentMeta.title, current: true },
              ]}
              className="mb-3"
            />
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-parchment border-t border-parchment-2 text-text-muted py-8 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-parchment-2/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[2px] bg-ink flex items-center justify-center border border-parchment-2">
                <Languages className="w-3.5 h-3.5 text-polish" />
              </div>
              <div>
                <span className="font-display font-semibold text-text-main tracking-wider uppercase text-[11px] block">
                  ZHONG-VIET AI TRANSLATOR
                </span>
                <span className="text-[10px] text-text-muted">
                  Bàn Biên Tập Bản Thảo Chu Sa &bull; Tối ưu dịch thuật tiên hiệp, kiếm hiệp
                </span>
              </div>
            </div>

            {/* Links, Policy & Contact */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-muted font-medium justify-center md:justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-polish transition-colors cursor-pointer"
              >
                Chính sách bảo mật
              </button>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-polish transition-colors cursor-pointer"
              >
                Điều khoản sử dụng
              </button>
              <a
                href="https://github.com/caoduongle/API_dich_truyen"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
              >
                Mã nguồn GitHub
              </a>
              <a
                href="mailto:hotro@dichtruyen.ai"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
                title="Gửi email hỗ trợ kỹ thuật"
              >
                <Mail className="w-3.5 h-3.5 text-polish" />
                <span>hotro@dichtruyen.ai</span>
              </a>
              <a
                href="tel:+84988000111"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
                title="Gọi đường dây nóng hỗ trợ"
              >
                <Phone className="w-3.5 h-3.5 text-polish" />
                <span>+84 988 000 111</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <p className="text-text-muted">
              &copy; {new Date().getFullYear()} ZHONG-VIET AI TRANSLATOR. Giữ toàn quyền bảo lưu.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-ink px-2 py-0.5 rounded-[2px] text-[10px] text-text-main border border-parchment-2">
                IndexedDB Persistent Storage
              </span>
              <span className="bg-ink px-2 py-0.5 rounded-[2px] text-[10px] text-text-main border border-parchment-2">
                Gemini 2.5 Pro &amp; Flash Ready
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Chính Sách Bảo Mật & Quyền Riêng Tư */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-parchment border border-parchment-2 rounded-md max-w-lg w-full p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-parchment-2 mb-4">
              <div className="flex items-center gap-2">
                <Seal character="隱" size="sm" tone="polish" />
                <h3 id="privacy-modal-title" className="font-display font-bold text-text-main text-base">
                  Chính Sách Bảo Mật &amp; Điều Khoản
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-sm cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>
                <strong className="text-text-main">1. Lưu Trữ Cục Bộ (IndexedDB):</strong> Toàn bộ dữ liệu tác phẩm, các chương truyện dịch và từ điển thuật ngữ được lưu trữ 100% trong trình duyệt của bạn (IndexedDB client-side). Không có dữ liệu truyện nào bị gửi hay thu thập trái phép lên máy chủ từ xa.
              </p>
              <p>
                <strong className="text-text-main">2. Bảo Mật Khóa API:</strong> Khóa Gemini API Key của bạn được lưu an toàn tại localStorage trình duyệt của bạn, chỉ được dùng để gửi yêu cầu dịch thuật trực tiếp đến Google AI.
              </p>
              <p>
                <strong className="text-text-main">3. Quyền Sở Hữu Bản Quyền:</strong> Toàn bộ bản dịch thuộc quyền sở hữu của người dùng. Hệ thống cung cấp công cụ xuất file TXT/EPUB để bạn toàn quyền sao lưu và quản lý.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowPrivacyModal(false)}>
                Đã hiểu và đồng ý
              </Button>
            </div>
          </div>
        </div>
      )}

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
      {showAuthModal && (
        <React.Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            canDismiss={isAuthenticated}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setIsAuthenticated(true);
              setShowAuthModal(false);
            }}
          />
        </React.Suspense>
      )}

      {/* Modal Đồng Bộ Google Drive */}
      {showGoogleSyncModal && (
        <React.Suspense fallback={null}>
          <GoogleSyncModal
            isOpen={showGoogleSyncModal}
            onClose={() => setShowGoogleSyncModal(false)}
            onDataChanged={reloadProjects}
          />
        </React.Suspense>
      )}

      {/* Modal Tùy Chỉnh Bảng Màu Đọc */}
      {showCustomThemeModal && (
        <React.Suspense fallback={null}>
          <CustomThemeModal
            open={showCustomThemeModal}
            onClose={() => setShowCustomThemeModal(false)}
          />
        </React.Suspense>
      )}
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
