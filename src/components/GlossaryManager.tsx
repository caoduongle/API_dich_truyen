import React, { useCallback } from 'react';
import { Search, Filter, Calendar } from 'lucide-react';
import { GlossaryItem, GlossaryType, PendingGlossaryItem, ChapterMetadata, StoryProject } from '../types';
import { computeDuplicateGroups, computeMergeHanGroups } from '../hooks/useGlossaryDuplicates';

// Re-export duplicate helper functions for backward compatibility
export { computeDuplicateGroups, computeMergeHanGroups };

// Sub-components
import { GlossaryHeader } from './glossary-manager/GlossaryHeader';
import { AddGlossaryForm } from './glossary-manager/AddGlossaryForm';
import { ImportGuidelinesModal } from './glossary-manager/ImportGuidelinesModal';
import { ReviewQueuePanel } from './glossary-manager/ReviewQueuePanel';
import { DuplicatePanel } from './glossary-manager/DuplicatePanel';
import { GlossaryTable } from './glossary-manager/GlossaryTable';
import { GlossaryDetailSidebar } from './glossary-manager/GlossaryDetailSidebar';
import { MergeHanPanel } from './glossary-manager/MergeHanPanel';
import { Badge } from './ui/Badge';
import { useGlossaryState } from './glossary-manager/useGlossaryState';

interface GlossaryManagerProps {
  projectId: string;
  glossary: GlossaryItem[];
  pendingGlossary?: PendingGlossaryItem[];
  chapters?: ChapterMetadata[];
  apiKeys?: string[];
  selectedModel?: string;
  onAddGlossaryItem: (item: Omit<GlossaryItem, 'id'>, force?: boolean) => void;
  onAddGlossaryItems?: (items: Omit<GlossaryItem, 'id'>[]) => void;
  onUpdateGlossaryItem: (id: string, item: GlossaryItem) => void;
  onDeleteGlossaryItem: (id: string) => void;
  onMergeGlossaryItems?: (primaryId: string, mergedPayload: Partial<GlossaryItem>, idsToDelete: string[]) => void;
  onAddToPending?: (item: PendingGlossaryItem) => void;
  onConfirmPending?: (pendingId: string, override?: Partial<GlossaryItem>) => void;
  onDiscardPending?: (pendingId: string) => void;
  activeProject?: StoryProject;
  onUpdateProject?: (updated: StoryProject) => void;
}

function GlossaryManager({
  projectId,
  glossary,
  pendingGlossary = [],
  chapters = [],
  apiKeys = [],
  selectedModel = 'gemini-2.5-flash',
  onAddGlossaryItem,
  onAddGlossaryItems,
  onUpdateGlossaryItem,
  onDeleteGlossaryItem,
  onMergeGlossaryItems,
  onConfirmPending,
  onDiscardPending,
  activeProject,
  onUpdateProject,
}: GlossaryManagerProps) {
  const {
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    selectedOrigin,
    setSelectedOrigin,
    searchDate,
    setSearchDate,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    isAdding,
    setIsAdding,
    isImporting,
    setIsImporting,
    mdFileName,
    isAnalyzingMd,
    selectedItem,
    setSelectedItem,
    editingId,
    mdInputRef,
    reviewQueue,
    setReviewQueue,
    showDuplicatePanel,
    setShowDuplicatePanel,
    duplicateGroups,
    setDuplicateGroups,
    showMergeHanPanel,
    setShowMergeHanPanel,
    mergeHanGroups,
    setMergeHanGroups,
    handleOpenDuplicatePanel,
    handleOpenMergeHanPanel,
    handleConfirmMergeHan,
    handleUpdateDupItem,
    handleConfirmDupGroup,
    handleIgnoreDupGroup,
    handleDeleteDupItem,
    handleSelectItem,
    handleDetailSave,
    handleAddFormSave,
    handleMdImportFileChange,
    handleAcceptReviewItem,
    handleDiscardReviewItem,
    handleUpdateReviewItem,
    exportGlossaryToMd,
    startEdit,
    cancelEdit,
    saveEdit,
    filteredGlossary,
    filteredMatches,
    highlightWordInText,
    searchContextMatches,
    contextFilterType,
    setContextFilterType,
    findLiveContext,
  } = useGlossaryState({
    projectId,
    glossary,
    pendingGlossary,
    chapters,
    apiKeys,
    selectedModel,
    onAddGlossaryItem,
    onAddGlossaryItems,
    onUpdateGlossaryItem,
    onDeleteGlossaryItem,
    onMergeGlossaryItems,
    onConfirmPending,
    onDiscardPending,
    activeProject,
    onUpdateProject,
  });

  const getOriginBadge = useCallback((origin?: string) => {
    switch (origin) {
      case 'guideline': return <Badge tone="polish">Cẩm nang</Badge>;
      case 'scanned':  return <Badge tone="warning">AI Quét</Badge>;
      default:         return <Badge tone="neutral">Thủ công</Badge>;
    }
  }, []);

  const getBadgeColor = useCallback((type: GlossaryType) => {
    switch (type) {
      case 'character': return 'bg-polish/15 text-polish border-polish/30';
      case 'location':  return 'bg-draft/20 text-draft border-draft/30';
      case 'term':      return 'bg-amber-950/30 text-amber-400 border-amber-900/40';
      case 'phrase':    return 'bg-amber-950/20 text-amber-300 border-amber-800/30';
      default:          return 'bg-ink text-text-muted border-parchment-2';
    }
  }, []);

  const getTypeName = useCallback((type: GlossaryType) => {
    switch (type) {
      case 'character': return 'Nhân vật';
      case 'location':  return 'Địa danh';
      case 'term':      return 'Bí kíp/Vật phẩm';
      case 'phrase':    return 'Thành ngữ';
      default:          return 'Khác';
    }
  }, []);

  return (
    <div id="glossary-manager-root" className="space-y-4 animate-fadeIn">
      <GlossaryHeader
        exportGlossaryToMd={exportGlossaryToMd}
        glossaryLength={glossary.length}
        showDuplicatePanel={showDuplicatePanel}
        duplicateGroupsLength={duplicateGroups.length}
        handleOpenDuplicatePanel={handleOpenDuplicatePanel}
        showMergeHanPanel={showMergeHanPanel}
        mergeGroupsLength={mergeHanGroups.length}
        handleOpenMergeHanPanel={handleOpenMergeHanPanel}
        isImporting={isImporting}
        setIsImporting={setIsImporting}
        isAdding={isAdding}
        setIsAdding={setIsAdding}
      />

      <ImportGuidelinesModal
        isImporting={isImporting}
        setIsImporting={setIsImporting}
        mdFileName={mdFileName}
        isAnalyzingMd={isAnalyzingMd}
        mdInputRef={mdInputRef}
        handleMdImportFileChange={handleMdImportFileChange}
      />

      {isAdding && (
        <AddGlossaryForm
          glossary={glossary}
          onSave={handleAddFormSave}
          onCancel={() => setIsAdding(false)}
          onSelectExistingItem={(item) => {
            handleSelectItem(item);
            setIsAdding(false);
          }}
        />
      )}

      <ReviewQueuePanel
        reviewQueue={reviewQueue}
        setReviewQueue={setReviewQueue}
        handleAcceptReviewItem={handleAcceptReviewItem}
        handleDiscardReviewItem={handleDiscardReviewItem}
        handleUpdateReviewItem={handleUpdateReviewItem}
      />

      <DuplicatePanel
        showDuplicatePanel={showDuplicatePanel}
        setShowDuplicatePanel={setShowDuplicatePanel}
        duplicateGroups={duplicateGroups}
        setDuplicateGroups={setDuplicateGroups}
        handleUpdateDupItem={handleUpdateDupItem}
        handleConfirmDupGroup={handleConfirmDupGroup}
        handleIgnoreDupGroup={handleIgnoreDupGroup}
        handleDeleteDupItem={handleDeleteDupItem}
        findLiveContext={findLiveContext}
        getOriginBadge={getOriginBadge}
      />

      <MergeHanPanel
        show={showMergeHanPanel}
        setShow={setShowMergeHanPanel}
        groups={mergeHanGroups}
        setGroups={setMergeHanGroups}
        onConfirmMerge={handleConfirmMergeHan}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selectedItem ? "lg:col-span-7 space-y-3" : "lg:col-span-12 space-y-3"}>
          {/* Thanh tìm kiếm và bộ lọc */}
          <div className="bg-parchment border border-parchment-2 p-3 rounded-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tra cứu chữ Hán, Pinyin, nghĩa Việt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-ink border border-parchment-2 rounded-[2px] pl-8 pr-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-polish placeholder:text-text-muted transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
                >
                  <option value="all" className="bg-parchment text-text-main">Mọi phân loại</option>
                  <option value="character" className="bg-parchment text-text-main">Nhân vật</option>
                  <option value="location" className="bg-parchment text-text-main">Địa danh</option>
                  <option value="term" className="bg-parchment text-text-main">Bí kíp/Vật phẩm</option>
                  <option value="phrase" className="bg-parchment text-text-main">Thành ngữ</option>
                  <option value="other" className="bg-parchment text-text-main">Khác</option>
                </select>
              </div>

              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
              >
                <option value="all" className="bg-parchment text-text-main">Mọi nguồn gốc</option>
                <option value="manual" className="bg-parchment text-text-main">Thủ công</option>
                <option value="guideline" className="bg-parchment text-text-main">Cẩm nang (.md)</option>
                <option value="scanned" className="bg-parchment text-text-main">AI Quét</option>
              </select>

              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1 focus:outline-none focus:border-polish cursor-pointer"
                  title="Lọc theo ngày thêm từ"
                />
                {searchDate && (
                  <button
                    onClick={() => setSearchDate('')}
                    className="text-text-muted hover:text-text-main text-[10px] underline cursor-pointer"
                  >
                    Xóa ngày
                  </button>
                )}
              </div>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-ink border border-parchment-2 text-text-main text-xs rounded-[2px] px-2 py-1.5 focus:outline-none focus:border-polish cursor-pointer"
              >
                <option value={20} className="bg-parchment text-text-main">20 / trang</option>
                <option value={50} className="bg-parchment text-text-main">50 / trang</option>
                <option value={100} className="bg-parchment text-text-main">100 / trang</option>
                <option value="all" className="bg-parchment text-text-main">Tất cả (Cuộn)</option>
              </select>
            </div>
          </div>

          <GlossaryTable
            filteredGlossary={filteredGlossary}
            selectedItem={selectedItem}
            handleSelectItem={handleSelectItem}
            editingId={editingId}
            startEdit={startEdit}
            cancelEdit={cancelEdit}
            saveEdit={saveEdit}
            onDeleteGlossaryItem={onDeleteGlossaryItem}
            getOriginBadge={getOriginBadge}
            getBadgeColor={getBadgeColor}
            getTypeName={getTypeName}
            pageSize={pageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </div>

        {selectedItem && (
          <GlossaryDetailSidebar
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            handleDetailSave={handleDetailSave}
            searchContextMatches={searchContextMatches}
            contextFilterType={contextFilterType}
            setContextFilterType={setContextFilterType}
            filteredMatches={filteredMatches}
            highlightWordInText={highlightWordInText}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(GlossaryManager);
