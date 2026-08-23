import React from 'react';
import { StoryProject, Chapter } from '../types';
import { Edit3, AlertCircle } from 'lucide-react';

// Sub-components
import { ProjectMetadataModal } from './translator-workspace/ProjectMetadataModal';
import { ImportChaptersModal } from './translator-workspace/ImportChaptersModal';
import { BilingualEditor } from './translator-workspace/BilingualEditor';
import { GlossarySidebar } from './translator-workspace/GlossarySidebar';
import { SuggestionsDrawer } from './translator-workspace/SuggestionsDrawer';
import { useWorkspaceState } from './translator-workspace/useWorkspaceState';

export interface TranslatorWorkspaceProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  loadedChapter?: Chapter | null;
  onClearLoadedChapter?: () => void;
  warningParagraphMismatch: boolean;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
}

export default function TranslatorWorkspace({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  loadedChapter,
  onClearLoadedChapter,
  warningParagraphMismatch,
  enableAiQaCritique,
  enableSegmentTranslation,
}: TranslatorWorkspaceProps) {
  const {
    sourceText,
    setSourceText,
    originalSourceText,
    setOriginalSourceText,
    isGlossaryApplied,
    setIsGlossaryApplied,
    isExtractionEnabled,
    setIsExtractionEnabled,
    rawTranslation,
    setRawTranslation,
    polishedTranslation,
    setPolishedTranslation,
    additionalInstructions,
    setAdditionalInstructions,
    chapterTitle,
    setChapterTitle,
    qaIssues,
    isCheckingQa,
    glossarySearch,
    setGlossarySearch,
    onlyShowMatching,
    setOnlyShowMatching,
    isEditingMetadata,
    setIsEditingMetadata,
    editTitle,
    setEditTitle,
    editAuthor,
    setEditAuthor,
    editGenre,
    setEditGenre,
    editTone,
    setEditTone,
    editDescription,
    setEditDescription,
    importFileRef,
    importedFileName,
    parsedImportChapters,
    importMode,
    setImportMode,
    importSplitMethod,
    isParsingImportFile,
    isAnalyzing,
    isTranslating,
    isPolishing,
    copiedRaw,
    copiedPolished,
    errorMessage,
    autoDiscoveredTerms,
    isApplyingGlossaryToSource,
    applyGlossarySourceCount,
    suggestions,
    selectedSuggestions,
    setSelectedSuggestions,
    activeStage,
    setActiveStage,
    crdt,
    visibleGlossary,
    untranslatedChapters,
    handleOpenEditModal,
    handleImportRawFileChange,
    handleToggleImportSplitMethod,
    handleSaveMetadata,
    handleLoadExample,
    handleAnalyzeGlossary,
    handleImportSuggestions,
    handleTranslateRaw,
    handlePolishTranslation,
    handleSaveChapter,
    handleApplyGlossaryToSource,
    handleCopyText,
    toggleCheck,
    handleLoadChapterById,
  } = useWorkspaceState({
    activeProject,
    onUpdateProject,
    apiKeys,
    selectedModel,
    loadedChapter,
    onClearLoadedChapter,
    warningParagraphMismatch,
    enableAiQaCritique,
    enableSegmentTranslation,
  });

  return (
    <div id="translator-workspace" className="space-y-4">
      {/* Active Project Card info */}
      <div className="bg-parchment text-text-main rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-parchment-2 shadow-xs">
        <div
          id="project-workspace-info"
          onClick={handleOpenEditModal}
          className="space-y-1 cursor-pointer group/header hover:bg-ink/30 p-2 rounded-[2px] transition-colors duration-200 flex-1"
          title="Nhấp để chỉnh sửa thông tin truyện"
        >
          <div className="flex items-center gap-2">
            <span className="bg-polish/15 text-polish text-[10px] font-bold px-2 py-0.5 rounded-[2px] border border-polish/30 uppercase tracking-wider">
              Dự án: {activeProject.title}
            </span>
            <Edit3 className="w-3 h-3 text-polish opacity-0 group-hover/header:opacity-100 transition-opacity" />
          </div>
          <h2 className="text-base font-display font-bold tracking-tight mt-1 text-text-main">
            Bàn Biên Soạn Bản Thảo Song Ngữ
          </h2>
          <p className="text-text-muted text-xs">
            Hệ thống dịch thuật song ngữ, đối soát từ điển chuẩn xác và chuốt mịn văn phong chu sa.
          </p>
        </div>

        <div
          onClick={handleOpenEditModal}
          className="flex flex-wrap items-center gap-4 bg-ink/50 border border-parchment-2 p-2.5 rounded-[2px] max-w-md cursor-pointer hover:bg-ink/80 transition-all group/meta"
          title="Nhấp để chỉnh sửa thông tin truyện"
        >
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Thể loại</span>
            <span className="font-bold text-text-main">{activeProject.genre}</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Từ điển</span>
            <span className="font-bold text-polish">{activeProject.glossary.length} từ</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="text-xs">
            <span className="text-text-muted block font-medium text-[10px] uppercase tracking-wider">Tông giọng</span>
            <span className="font-bold text-text-main line-clamp-1">{activeProject.tone}</span>
          </div>
          <div className="h-6 w-[1px] bg-parchment-2"></div>
          <div className="flex items-center justify-center text-polish group-hover/meta:scale-110 transition-transform">
            <Edit3 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-polish/10 border border-polish/40 text-polish p-3.5 rounded-[2px] flex items-start gap-2.5 text-xs animate-slideUp">
          <AlertCircle className="w-4 h-4 text-polish mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-polish">Lưu ý hệ thống:</p>
            <p className="text-text-main mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Visual Workspace Editor */}
      <BilingualEditor
        sourceText={sourceText}
        setSourceText={setSourceText}
        originalSourceText={originalSourceText}
        setOriginalSourceText={setOriginalSourceText}
        isGlossaryApplied={isGlossaryApplied}
        setIsGlossaryApplied={setIsGlossaryApplied}
        isExtractionEnabled={isExtractionEnabled}
        setIsExtractionEnabled={setIsExtractionEnabled}
        rawTranslation={rawTranslation}
        setRawTranslation={setRawTranslation}
        polishedTranslation={polishedTranslation}
        setPolishedTranslation={setPolishedTranslation}
        crdtStatus={crdt.status}
        collaborators={crdt.collaborators}
        onFieldFocus={crdt.setActiveField}
        additionalInstructions={additionalInstructions}
        setAdditionalInstructions={setAdditionalInstructions}
        chapterTitle={chapterTitle}
        setChapterTitle={setChapterTitle}
        untranslatedChapters={untranslatedChapters}
        handleLoadChapterById={handleLoadChapterById}
        handleLoadExample={handleLoadExample}
        handleAnalyzeGlossary={handleAnalyzeGlossary}
        isAnalyzing={isAnalyzing}
        handleTranslateRaw={handleTranslateRaw}
        isTranslating={isTranslating}
        handlePolishTranslation={handlePolishTranslation}
        isPolishing={isPolishing}
        handleSaveChapter={handleSaveChapter}
        handleApplyGlossaryToSource={handleApplyGlossaryToSource}
        copiedRaw={copiedRaw}
        copiedPolished={copiedPolished}
        handleCopyText={handleCopyText}
        activeStage={activeStage}
        setActiveStage={setActiveStage}
        autoDiscoveredTerms={autoDiscoveredTerms}
        isApplyingGlossaryToSource={isApplyingGlossaryToSource}
        applyGlossarySourceCount={applyGlossarySourceCount}
        glossaryLength={activeProject.glossary.length}
        activeProject={activeProject}
        onUpdateProject={onUpdateProject}
        apiKeys={apiKeys}
        selectedModel={selectedModel}
        warningParagraphMismatch={warningParagraphMismatch}
        enableAiQaCritique={enableAiQaCritique}
        enableSegmentTranslation={enableSegmentTranslation}
        qaIssues={qaIssues}
        isCheckingQa={isCheckingQa}
      />

      <SuggestionsDrawer
        suggestions={suggestions}
        selectedSuggestions={selectedSuggestions}
        toggleCheck={toggleCheck}
        handleImportSuggestions={handleImportSuggestions}
        setSelectedSuggestions={setSelectedSuggestions}
      />

      <GlossarySidebar
        glossaryLength={activeProject.glossary.length}
        visibleGlossary={visibleGlossary}
        onlyShowMatching={onlyShowMatching}
        setOnlyShowMatching={setOnlyShowMatching}
        glossarySearch={glossarySearch}
        setGlossarySearch={setGlossarySearch}
      />

      {/* Editing metadata modal */}
      <ProjectMetadataModal
        isOpen={isEditingMetadata}
        onClose={() => setIsEditingMetadata(false)}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editAuthor={editAuthor}
        setEditAuthor={setEditAuthor}
        editGenre={editGenre}
        setEditGenre={setEditGenre}
        editTone={editTone}
        setEditTone={setEditTone}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        handleSaveMetadata={handleSaveMetadata}
        importSection={
          <ImportChaptersModal
            importedFileName={importedFileName}
            importFileRef={importFileRef}
            handleImportRawFileChange={handleImportRawFileChange}
            importMode={importMode}
            setImportMode={setImportMode}
            importSplitMethod={importSplitMethod}
            handleToggleImportSplitMethod={handleToggleImportSplitMethod}
            isParsingImportFile={isParsingImportFile}
            parsedChaptersLength={parsedImportChapters.length}
          />
        }
      />
    </div>
  );
}
