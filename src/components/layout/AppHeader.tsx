import { useState } from 'react';
import { 
  BookOpenText, Settings, History, Folder, Cpu, ShieldCheck,
  MoreHorizontal, X
} from 'lucide-react';
import { Seal } from '../ui/Seal';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { LanguageSelector } from '../common/LanguageSelector';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { GoogleUserButton } from '../google-sync/GoogleUserButton';
import { useTranslation } from '../../i18n/I18nContext';
import { StoryProject } from '../../types';

export interface AppHeaderProps {
  activeTab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker';
  onSwitchTab: (tab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker') => void;
  activeProject: StoryProject | null | undefined;
  apiKeys: string[];
  onOpenApiSettings: () => void;
  onOpenCustomThemeModal: () => void;
  onOpenGoogleSyncModal: () => void;
}

export function AppHeader({
  activeTab,
  onSwitchTab,
  activeProject,
  apiKeys,
  onOpenApiSettings,
  onOpenCustomThemeModal,
  onOpenGoogleSyncModal,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { key: 'translate' as const, icon: BookOpenText, label: t('nav.translate'), shortcut: 'Alt+1' },
    { key: 'auto-translate' as const, icon: Cpu, label: t('nav.autoTranslate'), shortcut: 'Alt+2' },
    { key: 'glossary' as const, icon: Settings, label: t('nav.glossary'), shortcut: 'Alt+3' },
    { key: 'history' as const, icon: History, label: t('nav.history'), shortcut: 'Alt+4' },
    { key: 'projects' as const, icon: Folder, label: t('nav.projects'), shortcut: 'Alt+5' },
    { key: 'hako-checker' as const, icon: ShieldCheck, label: t('nav.hakoChecker'), shortcut: 'Alt+6' },
  ];

  return (
    <>
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
            onClick={() => onSwitchTab('translate')}
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
          <ThemeSwitcher onOpenCustomModal={onOpenCustomThemeModal} />

          {/* Google Account & Drive Sync */}
          <GoogleUserButton onOpenSyncModal={onOpenGoogleSyncModal} />

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenApiSettings}
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
            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    onSwitchTab(tab.key);
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
    </>
  );
}
