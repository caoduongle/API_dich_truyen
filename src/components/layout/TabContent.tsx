import React from 'react';
import { Chapter, StoryProject, GlossaryItem, PendingGlossaryItem } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';
import { useAIConfigContext } from '../../context/AIConfigContext';
import { TabSkeleton } from '../common/Skeleton';
import { ErrorBoundary } from '../ErrorBoundary';
import { Breadcrumbs } from '../common/Breadcrumbs';

// Code splitting các tab nặng qua React.lazy
const TranslatorWorkspace = React.lazy(() => import('../TranslatorWorkspace'));
const AutoTranslator = React.lazy(() => import('../AutoTranslator'));
const GlossaryManager = React.lazy(() => import('../GlossaryManager'));
const ProjectList = React.lazy(() => import('../ProjectList'));
const ChapterHistoryPanel = React.lazy(() => import('../ChapterHistoryPanel'));
const HakoCheckerWorkspace = React.lazy(() => import('../hako-checker/HakoCheckerWorkspace'));

const MemoTranslatorWorkspace = React.memo(TranslatorWorkspace);
const MemoAutoTranslator = React.memo(AutoTranslator);
const MemoGlossaryManager = React.memo(GlossaryManager);
const MemoProjectList = React.memo(ProjectList);
const MemoChapterHistoryPanel = React.memo(ChapterHistoryPanel);
const MemoHakoCheckerWorkspace = React.memo(HakoCheckerWorkspace);

const EMPTY_PENDING_GLOSSARY: never[] = [];

export interface TabContentProps {
  activeTab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker';
  visitedTabs: Set<string>;
  loadedChapter: Chapter | null;
  pendingHighlightSnippet?: string | null;
  onClearHighlightSnippet?: () => void;
  currentMetaTitle: string;
  onSwitchTab: (tab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker') => void;
  onClearLoadedChapter: () => void;
  onAutoTranslateProcessingChange: (processing: boolean) => void;
  onGoToTranslate: (chapter?: Chapter) => void;
  onOpenChapterFromHakoChecker: (chapterId: string, options?: { snippet?: string; issueId?: string }) => void;
}

export function TabContent({
  activeTab,
  visitedTabs,
  loadedChapter,
  pendingHighlightSnippet,
  onClearHighlightSnippet,
  currentMetaTitle,
  onSwitchTab,
  onClearLoadedChapter,
  onAutoTranslateProcessingChange,
  onGoToTranslate,
  onOpenChapterFromHakoChecker,
}: TabContentProps) {
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
  } = useAIConfigContext();

  const handleSelectProjectAndSwitch = (id: string) => {
    handleSelectProject(id);
    onSwitchTab('translate');
  };

  const handleCreateProjectAndSwitch = (project: Omit<StoryProject, 'id' | 'createdAt'>) => {
    handleCreateProject(project);
    onSwitchTab('translate');
  };

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none">
      {/* Breadcrumbs điều hướng phân cấp ngữ nghĩa */}
      <Breadcrumbs
        items={[
          ...(activeProject ? [{ label: activeProject.title, onClick: () => onSwitchTab('projects') }] : []),
          { label: currentMetaTitle, current: true },
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
                    onClearLoadedChapter={onClearLoadedChapter}
                    initialHighlightSnippet={pendingHighlightSnippet}
                    onClearHighlightSnippet={onClearHighlightSnippet}
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
                    onProcessingChange={onAutoTranslateProcessingChange}
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
                    onGoToTranslate={onGoToTranslate}
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
                onOpenInTranslator={onOpenChapterFromHakoChecker}
              />
            </ErrorBoundary>
          )}
        </div>
      </React.Suspense>
    </main>
  );
}
