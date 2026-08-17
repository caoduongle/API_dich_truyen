import React, { useState, useEffect, startTransition, useCallback, memo } from 'react';
import { Chapter } from './types';
import { NotificationProvider } from './components/NotificationSystem';
import ProjectList from './components/ProjectList';
import GlossaryManager from './components/GlossaryManager';
import TranslatorWorkspace from './components/TranslatorWorkspace';
import AutoTranslator from './components/AutoTranslator';
import ChapterHistoryPanel from './components/ChapterHistoryPanel';
import ApiSettings from './components/ApiSettings';
import AuthModal from './components/AuthModal';
import { useProjects } from './hooks/useProjects';
import { useAIConfig } from './hooks/useAIConfig';
import { checkAuthStatus, logoutAuth, onAuthRequired } from './utils/apiClient';
import {
  Languages, BookOpenText, Folder, Settings, Cpu, History, Sparkles, Lock, Unlock
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

// Bọc các tab nặng trong React.memo để tránh re-render khi chỉ activeTab thay đổi.
// GlossaryManager tự bọc memo ở export, ChapterHistoryPanel nhẹ nên không cần.
const MemoTranslatorWorkspace = memo(TranslatorWorkspace);
const MemoAutoTranslator      = memo(AutoTranslator);
const MemoProjectList         = memo(ProjectList);
const MemoChapterHistoryPanel = memo(ChapterHistoryPanel);

export function AppContent() {
  const [activeTab, setActiveTab] = useState<'translate' | 'glossary' | 'projects' | 'history' | 'auto-translate'>('translate');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['translate']));

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
    handleMergeGlossaryItems,
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
    handleImportClipboardKeys,
    warningParagraphMismatch,
    setWarningParagraphMismatch,
    enableAiQaCritique,
    setEnableAiQaCritique,
    enableSegmentTranslation,
    setEnableSegmentTranslation
  } = useAIConfig();

  const [loadedChapter, setLoadedChapter] = useState<Chapter | null>(null);
  const [isAutoTranslating, setIsAutoTranslating] = useState<boolean>(false);

  // Authentication State
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  useEffect(() => {
    checkAuthStatus().then((status) => {
      setAuthRequired(status.authRequired);
      setIsAuthenticated(status.authenticated);
      if (status.authRequired && !status.authenticated) {
        setShowAuthModal(true);
      }
    });

    const unsubscribe = onAuthRequired(() => {
      setAuthRequired(true);
      setIsAuthenticated(false);
      setShowAuthModal(true);
    });

    return unsubscribe;
  }, []);

  // Dùng startTransition: React ưu tiên giữ UI responsive, render tab mới như "background work"
  const switchTab = useCallback((tab: typeof activeTab) => {
    startTransition(() => {
      setActiveTab(tab);
      setVisitedTabs(prev => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    });
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
      <div className="min-h-screen bg-[#080c16] flex flex-col items-center justify-center font-sans">
        <Cpu className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-xs font-bold text-indigo-300 tracking-wide uppercase">Đang khởi tạo IndexedDB...</p>
      </div>
    );
  }

  return (
    <div id="ai-story-translator-app" className="min-h-screen bg-[#080c16] flex flex-col font-sans text-slate-200 selection:bg-indigo-500/20 selection:text-indigo-200">

      {/* Platform Header */}
      <header className="sticky top-0 z-55 h-14 bg-[#0e1424]/85 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-900/30">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
              ZHONG-VIET AI TRANSLATOR
              <span className="text-[9px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700/50">v2.4.0</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeProject && (
            <div className="hidden sm:flex items-center bg-slate-900/60 rounded-lg px-2.5 py-1 gap-1.5 border border-slate-800/80">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ngữ điệu:</span>
              <span className="text-xs font-semibold text-indigo-400">{activeProject.genre} / {activeProject.tone}</span>
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
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                isAuthenticated
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40 animate-pulse'
              }`}
              title={isAuthenticated ? "Máy chủ đã xác thực. Bấm để đăng xuất" : "Yêu cầu đăng nhập máy chủ"}
            >
              {isAuthenticated ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isAuthenticated ? 'Đã khóa máy chủ' : 'Chưa đăng nhập'}</span>
            </button>
          )}

          <button
            onClick={() => setShowApiSettings(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-900/20 hover:scale-[1.02]"
          >
            <Settings className="w-3.5 h-3.5" />
            Cấu hình AI ({apiKeys.filter(k => k.trim()).length ? `${apiKeys.filter(k => k.trim()).length} Keys` : 'Hệ thống'})
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-[#0b101f] border-b border-slate-800/80 sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto scrollbar-none py-0.5">
            <nav className="flex space-x-1 min-w-max">
              <button
                onClick={() => switchTab('translate')}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'translate' ? 'border-indigo-500 text-white font-extrabold glow-shadow' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpenText className="w-3.5 h-3.5 shrink-0" />
                Mặt Trận Dịch Thuật
              </button>

              <button
                onClick={() => switchTab('auto-translate')}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'auto-translate' ? 'border-indigo-500 text-white font-extrabold glow-shadow' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className={`w-3.5 h-3.5 shrink-0 text-indigo-400 ${isAutoTranslating ? 'animate-pulse' : ''}`} />
                Dịch Tự Động Toàn Bộ
              </button>

              <button
                onClick={() => switchTab('glossary')}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'glossary' ? 'border-indigo-500 text-white font-extrabold glow-shadow' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                Từ Điển Nhân Vật
                {activeProject && activeProject.glossary.length > 0 && (
                  <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {activeProject.glossary.length}
                  </span>
                )}
                {activeProject && (activeProject.pendingGlossary || []).length > 0 && (
                  <span className="bg-amber-950/80 text-amber-300 border border-amber-800/50 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {(activeProject.pendingGlossary || []).length} chờ
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('history')}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
                  activeTab === 'history' ? 'border-indigo-500 text-white font-extrabold glow-shadow' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                Lịch Sử Chương Dịch
                {activeProject && activeProject.chapters.length > 0 && (
                  <span className="bg-slate-900 bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {activeProject.chapters.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => switchTab('projects')}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'projects' ? 'border-indigo-500 text-white font-extrabold glow-shadow' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Folder className="w-3.5 h-3.5 shrink-0" />
                Quản Lý Truyện ({projects.length})
              </button>
            </nav>

            {activeProject && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                <span>Bộ đang dịch: </span>
                <strong className="text-white bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded font-extrabold">
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
              {/* GlossaryManager tự bọc React.memo ở phần export */}
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
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0b0e17] border-t border-slate-800/85 text-slate-400 py-8 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-indigo-950 flex items-center justify-center border border-indigo-800/40">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="font-extrabold text-slate-300 tracking-wider uppercase text-[11px]">ZHONG-VIET AI TRANSLATOR</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-400 font-medium justify-center md:justify-end">
            <span>Dịch Giản &amp; Phồn thể</span>
            <span>Glossary Manager v2.4</span>
            <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] text-indigo-400 border border-slate-800">IndexedDB Persistent Storage</span>
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
      <AppContent />
    </NotificationProvider>
  );
}
