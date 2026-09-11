import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpenText, Settings, History, Folder, Cpu, ShieldCheck,
  ChevronLeft, ChevronRight, MoreHorizontal, ChevronDown
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Kbd } from '../ui/Kbd';
import { useScrollOverflow } from '../../hooks/useScrollOverflow';
import { useTranslation } from '../../i18n/I18nContext';
import { StoryProject } from '../../types';

export interface AppTabBarProps {
  activeTab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker';
  onSwitchTab: (tab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker') => void;
  activeProject: StoryProject | null | undefined;
  projectsCount: number;
  isAutoTranslating: boolean;
}

const EMPTY_PENDING_GLOSSARY: never[] = [];

export function AppTabBar({
  activeTab,
  onSwitchTab,
  activeProject,
  projectsCount,
  isAutoTranslating,
}: AppTabBarProps) {
  const { t } = useTranslation();
  const [showMoreNavMenu, setShowMoreNavMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    containerRef: tabNavContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollToElement,
    scrollLeftAction,
    scrollRightAction,
  } = useScrollOverflow<HTMLDivElement>({ threshold: 2, scrollStep: 220 });

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

  // Tự động cuộn tab kích hoạt vào vùng nhìn thấy khi activeTab thay đổi
  useEffect(() => {
    scrollToElement(`tab-${activeTab}`, 'smooth');
  }, [activeTab, scrollToElement]);

  return (
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
                  onClick={() => onSwitchTab('translate')}
                  title={`${t('nav.translate')} (Alt+1)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'translate'
                      ? 'border-polish text-text-main bg-parchment-2/40'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                  }`}
                >
                  <BookOpenText className="w-3.5 h-3.5 shrink-0 text-polish" />
                  <span><span className="hidden 2xl:inline">Mặt Trận </span>Dịch Thuật</span>
                  <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+1</Kbd>
                </button>

                <button
                  id="tab-auto-translate"
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'auto-translate'}
                  aria-controls="panel-auto-translate"
                  tabIndex={0}
                  onClick={() => onSwitchTab('auto-translate')}
                  title={`${t('nav.autoTranslate')} (Alt+2)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                    activeTab === 'auto-translate'
                      ? 'border-polish text-text-main bg-parchment-2/40'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                  }`}
                >
                  <Cpu className={`w-3.5 h-3.5 shrink-0 ${isAutoTranslating ? 'text-polish animate-pulse' : 'text-text-muted'}`} />
                  <span>Dịch Tự Động<span className="hidden 2xl:inline"> Toàn Bộ</span></span>
                  <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+2</Kbd>
                </button>

                <button
                  id="tab-glossary"
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'glossary'}
                  aria-controls="panel-glossary"
                  tabIndex={0}
                  onClick={() => onSwitchTab('glossary')}
                  title={`${t('nav.glossary')} (Alt+3)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                    activeTab === 'glossary'
                      ? 'border-polish text-text-main bg-parchment-2/40'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  <span>Từ Điển<span className="hidden 2xl:inline"> Nhân Vật</span></span>
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
                  onClick={() => onSwitchTab('history')}
                  title={`${t('nav.history')} (Alt+4)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 relative ${
                    activeTab === 'history'
                      ? 'border-polish text-text-main bg-parchment-2/40'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                  }`}
                >
                  <History className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  <span>Lịch Sử<span className="hidden 2xl:inline"> Chương Dịch</span></span>
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
                  onClick={() => onSwitchTab('projects')}
                  title={`${t('nav.projects')} (Alt+5)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'projects'
                      ? 'border-polish text-text-main bg-parchment-2/40'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-parchment-2/20'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  <span><span className="hidden 2xl:inline">Quản Lý </span>Truyện</span>
                  <Kbd className="hidden 2xl:inline-block text-[9px]">Alt+5</Kbd>
                  <Badge tone="neutral" className="ml-0.5">
                    {projectsCount}
                  </Badge>
                </button>

                <button
                  id="tab-hako-checker"
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'hako-checker'}
                  aria-controls="panel-hako-checker"
                  tabIndex={0}
                  onClick={() => onSwitchTab('hako-checker')}
                  title={`${t('nav.hakoChecker')} (Alt+6)`}
                  className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 2xl:px-3 py-1.5 sm:py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
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
          <div className="relative shrink-0 hidden sm:flex 2xl:hidden items-center">
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
              <span className="hidden md:inline text-[11px]">Thêm</span>
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
                        {projectsCount}
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
                        onSwitchTab(tabItem.key);
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
              <span className="shrink-0 hidden 2xl:inline">{t('nav.currentBook')}: </span>
              <strong className="text-text-main font-display bg-ink border border-parchment-2 px-2 py-0.5 rounded-[2px] font-bold truncate max-w-[140px] md:max-w-[180px] lg:max-w-[220px] 2xl:max-w-[300px]">
                {activeProject.title}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
