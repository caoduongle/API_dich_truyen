import React, { useState, useEffect } from 'react';
import { StoryProject, Chapter } from '../types';
import { Cpu } from 'lucide-react';
import { getChapterFromDB } from '../services/db';
import { useRangeState } from '../hooks/useRangeState';

// Hooks
import { useAutoTranslationQueue } from '../hooks/useAutoTranslationQueue';

// Sub-components
import { TranslationConfigPanel } from './auto-translator/TranslationConfigPanel';
import { ApplyGlossaryPanel } from './auto-translator/ApplyGlossaryPanel';
import { BulkScanConfigPanel } from './auto-translator/BulkScanConfigPanel';
import { ExportFilesPanel } from './auto-translator/ExportFilesPanel';
import { QueueStatusPanel } from './auto-translator/QueueStatusPanel';
import { DiscoveredTermsPanel } from './auto-translator/DiscoveredTermsPanel';
import { DiffModal } from './auto-translator/DiffModal';

// Existing sub-components
import { TerminalConsole } from './auto-translator/TerminalConsole';
import { DriveProgressWidget } from './auto-translator/DriveProgressWidget';
import { GlossaryScanWidget } from './auto-translator/GlossaryScanWidget';

interface AutoTranslatorProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  onProcessingChange?: (processing: boolean) => void;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
}

export default function AutoTranslator({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  onProcessingChange,
  enableAiQaCritique,
  enableSegmentTranslation,
}: AutoTranslatorProps) {
  const totalChapters = activeProject.chapters.length || 0;

  // Local configs
  const [polishCycles, setPolishCycles] = useState<number>(1);
  const [autoTranslateMode, setAutoTranslateMode] = useState<'resume' | 'from_scratch'>('resume');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [isExtractionDuringTranslationEnabled, setIsExtractionDuringTranslationEnabled] = useState<boolean>(true);
  const [skipFailedChapters, setSkipFailedChapters] = useState<boolean>(true);
  const [concurrency, setConcurrency] = useState<number>(1);

  // Sync skipFailedChapters setting from translationQueueState if available
  useEffect(() => {
    if (activeProject.translationQueueState?.skipFailedChapters !== undefined) {
      setSkipFailedChapters(activeProject.translationQueueState.skipFailedChapters);
    }
  }, [activeProject.id, activeProject.translationQueueState?.skipFailedChapters]);

  // Range selections using custom useRangeState hook
  const translationRange = useRangeState(totalChapters);
  const applyGlossaryRange = useRangeState(totalChapters);
  const scanRange = useRangeState(totalChapters);
  const exportRange = useRangeState(totalChapters);
  const [extractionLoops, setExtractionLoops] = useState<number>(1);

  // Export configs
  const [chaptersPerFile, setChaptersPerFile] = useState<number>(10);
  const [exportScope, setExportScope] = useState<'all' | 'translated'>('translated');
  const [exportMode, setExportMode] = useState<'web' | 'audio' | 'align_jsonl'>('web');

  // Modal and Widget visibility (UI states)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);
  const [diffModalChapterIndex, setDiffModalChapterIndex] = useState<number>(0);
  const [isDriveWidgetVisible, setIsDriveWidgetVisible] = useState<boolean>(false);
  const [isDriveWidgetMinimized, setIsDriveWidgetMinimized] = useState<boolean>(false);
  const [isScanWidgetVisible, setIsScanWidgetVisible] = useState<boolean>(false);
  const [isScanWidgetMinimized, setIsScanWidgetMinimized] = useState<boolean>(false);

  const [fullChaptersForDiff, setFullChaptersForDiff] = useState<Chapter[]>([]);
  const [isLoadingDiffChapters, setIsLoadingDiffChapters] = useState<boolean>(false);

  useEffect(() => {
    if (isDiffModalOpen) {
      setIsLoadingDiffChapters(true);
      const loadDiffChapters = async () => {
        const metadataList = activeProject.chapters;
        const loaded: Chapter[] = [];
        for (const meta of metadataList) {
          const chap = await getChapterFromDB(meta.id);
          if (chap && chap.processedSourceText) {
            loaded.push(chap);
          }
        }
        setFullChaptersForDiff(loaded);
        setIsLoadingDiffChapters(false);
      };
      loadDiffChapters();
    } else {
      setFullChaptersForDiff([]);
      setIsLoadingDiffChapters(false);
    }
  }, [isDiffModalOpen, activeProject.chapters]);

  // Hook handles translation queues, scanning loops, file exports
  const {
    isProcessing,
    currentChapterIndex,
    chaptersQueue,
    processedCount,
    logs,
    autoDiscoveredBatch,
    estTimeStr,
    isScanningGlossary,
    scanningProgress,
    currentExtractionLoop,
    currentScanningChapterTitle,
    currentScanningChapterIndex,
    totalScanChapters,
    scanFoundCount,
    isApplyingGlossary,
    applyGlossaryResult,
    isExportingTxt,
    setLogs,
    handleToggleProcessing,
    handleStopTranslation,
    handleExportTxt,
    handleExportAlignJsonl,
    handleApplyGlossaryToAllChapters,
    handleResetQueue,
    handleAutoExtractGlossary,
    triggerExportDownload,
    handleRetryFailedChapters,
    handleRetryFailedGlossaryChapters,
  } = useAutoTranslationQueue({
    activeProject,
    onUpdateProject,
    apiKeys,
    selectedModel,
    polishCycles,
    autoTranslateMode,
    additionalInstructions,
    isExtractionDuringTranslationEnabled,
    rangeEnabled: translationRange.enabled,
    rangeStart: translationRange.start,
    rangeEnd: translationRange.end,
    applyGlossaryRangeEnabled: applyGlossaryRange.enabled,
    applyGlossaryRangeStart: applyGlossaryRange.start,
    applyGlossaryRangeEnd: applyGlossaryRange.end,
    scanRangeEnabled: scanRange.enabled,
    scanRangeStart: scanRange.start,
    scanRangeEnd: scanRange.end,
    extractionLoops,
    chaptersPerFile,
    exportScope,
    exportMode,
    exportRangeEnabled: exportRange.enabled,
    exportRangeStart: exportRange.start,
    exportRangeEnd: exportRange.end,
    skipFailedChapters,
    concurrency,
    enableAiQaCritique,
    enableSegmentTranslation,
  });

  const handleExportModeChange = (mode: 'web' | 'audio' | 'align_jsonl') => {
    setExportMode(mode);
    if (mode === 'audio' && chaptersPerFile > 10) {
      setChaptersPerFile(10);
    }
  };

  // Open scanning widget when scanning starts
  useEffect(() => {
    if (isScanningGlossary) {
      setIsScanWidgetVisible(true);
      setIsScanWidgetMinimized(false);
    }
  }, [isScanningGlossary]);

  // Clear state when project changes
  useEffect(() => {
    setLogs([]);
  }, [activeProject.id]);

  // Notify parent of processing state
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing);
    }
  }, [isProcessing, onProcessingChange]);

  // Open processing widget when queue starts
  useEffect(() => {
    if (isProcessing) {
      setIsDriveWidgetVisible(true);
      setIsDriveWidgetMinimized(false);
    }
  }, [isProcessing]);
  const totalUntranslatedChapters = activeProject.chapters.filter(
    c => c.status !== 'completed'
  ).length;

  const remainingChapters = Math.max(0, chaptersQueue.length - processedCount);
  const requestsPerChapter = 1 + polishCycles;
  const remainingRequests = Math.max(0, remainingChapters * requestsPerChapter);
  const hasProcessedChapters = activeProject.chapters.some(c => c.status !== 'not_started');
  return (
    <div id="auto-translator" className="space-y-6">
      {/* Banner tổng quan tham số */}
      <div className="bg-parchment text-text-main rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-parchment-2 shadow-xs">
        <div className="space-y-1">
          <span className="bg-polish/15 text-polish text-[10px] font-bold px-2.5 py-0.5 rounded-[2px] border border-polish/30 uppercase tracking-wider">Hệ thống biên dịch hàng loạt</span>
          <h2 className="text-base font-display font-bold tracking-tight mt-1 flex items-center gap-2 text-text-main">
            <Cpu className="w-5 h-5 text-polish" />
            Biên Dịch Tự Động &amp; Trích Thuật Ngữ Sỉ
          </h2>
          <p className="text-text-muted text-xs">Hệ thống dịch tuần tự song song, tự động phát hiện và nạp từ điển gối đầu chuẩn xác.</p>
        </div>

        <div className="bg-ink/60 border border-parchment-2 p-3.5 rounded-[2px] text-xs grid grid-cols-2 gap-x-4 gap-y-2 max-w-sm shrink-0">
          <div className="text-text-muted font-medium">Mô hình AI</div>
          <div className="text-text-main font-bold text-right font-mono text-[11px]">{selectedModel}</div>
          <div className="text-text-muted font-medium">Tông xưng hô</div>
          <div className="text-text-main font-semibold text-right line-clamp-1">{activeProject.tone}</div>
          <div className="text-text-muted font-medium text-xs leading-none">Chương chưa dịch</div>
          <div className="text-amber-400 font-bold text-right text-xs leading-none">{totalUntranslatedChapters} / {totalChapters} chap</div>
        </div>
      </div>


      {/* Cấu hình tham số và bảng điều khiển */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <TranslationConfigPanel
            polishCycles={polishCycles}
            setPolishCycles={setPolishCycles}
            autoTranslateMode={autoTranslateMode}
            setAutoTranslateMode={setAutoTranslateMode}
            additionalInstructions={additionalInstructions}
            setAdditionalInstructions={setAdditionalInstructions}
            isExtractionDuringTranslationEnabled={isExtractionDuringTranslationEnabled}
            setIsExtractionDuringTranslationEnabled={setIsExtractionDuringTranslationEnabled}
            rangeEnabled={translationRange.enabled}
            setRangeEnabled={translationRange.setEnabled}
            rangeStart={translationRange.start}
            setRangeStart={translationRange.setStart}
            rangeEnd={translationRange.end}
            setRangeEnd={translationRange.setEnd}
            totalChapters={totalChapters}
            totalUntranslatedChapters={totalUntranslatedChapters}
            isProcessing={isProcessing}
            handleToggleProcessing={handleToggleProcessing}
            handleStopTranslation={handleStopTranslation}
            handleResetQueue={handleResetQueue}
            triggerExportDownload={triggerExportDownload}
            skipFailedChapters={skipFailedChapters}
            setSkipFailedChapters={setSkipFailedChapters}
            concurrency={concurrency}
            setConcurrency={setConcurrency}
          />

          {/* Failed chapters section */}
          {activeProject.translationQueueState?.failedIds && activeProject.translationQueueState.failedIds.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-md space-y-2.5 animate-in slide-in-from-top-2 duration-200 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Phát hiện {activeProject.translationQueueState.failedIds.length} chương lỗi
                </span>
              </div>
              <p className="text-[11px] text-rose-300 font-normal leading-relaxed max-h-24 overflow-y-auto bg-ink p-2.5 rounded-[2px] border border-rose-900/30 custom-scrollbar">
                {activeProject.translationQueueState.failedIds.map((fid) => {
                  const chap = activeProject.chapters.find(c => c.id === fid);
                  return chap ? chap.title : fid;
                }).join(', ')}
              </p>
              <button
                type="button"
                onClick={handleRetryFailedChapters}
                disabled={isProcessing}
                className={`w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[2px] text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                Dịch lại các chương lỗi này
              </button>
            </div>
          )}

          <ApplyGlossaryPanel
            applyGlossaryRangeEnabled={applyGlossaryRange.enabled}
            setApplyGlossaryRangeEnabled={applyGlossaryRange.setEnabled}
            applyGlossaryRangeStart={applyGlossaryRange.start}
            setApplyGlossaryRangeStart={applyGlossaryRange.setStart}
            applyGlossaryRangeEnd={applyGlossaryRange.end}
            setApplyGlossaryRangeEnd={applyGlossaryRange.setEnd}
            totalChapters={totalChapters}
            glossaryLength={activeProject.glossary.length}
            isApplyingGlossary={isApplyingGlossary}
            applyGlossaryResult={applyGlossaryResult}
            isProcessing={isProcessing}
            handleApplyGlossaryToAllChapters={handleApplyGlossaryToAllChapters}
            onViewDetails={() => { setDiffModalChapterIndex(0); setIsDiffModalOpen(true); }}
            hasProcessedChapters={hasProcessedChapters}
          />

          <BulkScanConfigPanel
            scanRangeEnabled={scanRange.enabled}
            setScanRangeEnabled={scanRange.setEnabled}
            scanRangeStart={scanRange.start}
            setScanRangeStart={scanRange.setStart}
            scanRangeEnd={scanRange.end}
            setScanRangeEnd={scanRange.setEnd}
            totalChapters={totalChapters}
            isScanningGlossary={isScanningGlossary}
            scanningProgress={scanningProgress}
            extractionLoops={extractionLoops}
            setExtractionLoops={setExtractionLoops}
            handleAutoExtractGlossary={handleAutoExtractGlossary}
          />

          <ExportFilesPanel
            exportMode={exportMode}
            handleExportModeChange={handleExportModeChange}
            chaptersPerFile={chaptersPerFile}
            setChaptersPerFile={setChaptersPerFile}
            exportScope={exportScope}
            setExportScope={setExportScope}
            isExportingTxt={isExportingTxt}
            handleExportTxt={handleExportTxt}
            handleExportAlignJsonl={handleExportAlignJsonl}
            exportRangeEnabled={exportRange.enabled}
            setExportRangeEnabled={exportRange.setEnabled}
            exportRangeStart={exportRange.start}
            setExportRangeStart={exportRange.setStart}
            exportRangeEnd={exportRange.end}
            setExportRangeEnd={exportRange.setEnd}
            totalChapters={totalChapters}
          />
        </div>

        {/* Cột theo dõi trạng thái và Console logs Terminal */}
        <div id="queue-and-discovered-view" className="lg:col-span-2 space-y-4">
          <QueueStatusPanel
            chaptersQueue={chaptersQueue}
            processedCount={processedCount}
            currentChapterIndex={currentChapterIndex}
          />

          <TerminalConsole logs={logs} onClear={() => setLogs([])} />

          <DiscoveredTermsPanel autoDiscoveredBatch={autoDiscoveredBatch} />
        </div>
      </div>

      {/* Modal xem chi tiết diff sourceText vs processedSourceText */}
      {isDiffModalOpen && (
        isLoadingDiffChapters ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-parchment border border-parchment-2 rounded-md p-6 text-center shadow-2xl max-w-sm w-full">
              <p className="text-xs font-bold text-polish animate-pulse">Đang tải dữ liệu so sánh từ IndexedDB...</p>
            </div>
          </div>
        ) : fullChaptersForDiff.length > 0 ? (
          <DiffModal
            chapters={fullChaptersForDiff}
            glossary={activeProject.glossary}
            diffModalChapterIndex={diffModalChapterIndex}
            setDiffModalChapterIndex={setDiffModalChapterIndex}
            onClose={() => setIsDiffModalOpen(false)}
          />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-parchment border border-parchment-2 rounded-md p-6 text-center shadow-2xl space-y-4 max-w-sm w-full">
              <p className="text-xs font-bold text-text-muted">Chưa có chương nào áp dụng từ điển để so sánh!</p>
              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="px-4 py-2 bg-polish hover:bg-[#A03522] text-white text-xs font-bold rounded-[2px] cursor-pointer transition-colors shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        )
      )}
      {/* Khối Floating Drive Progress Monitor Widget */}
      <DriveProgressWidget
        isVisible={isDriveWidgetVisible}
        isMinimized={isDriveWidgetMinimized}
        setIsMinimized={setIsDriveWidgetMinimized}
        setIsVisible={setIsDriveWidgetVisible}
        isProcessing={isProcessing}
        processedCount={processedCount}
        totalQueueLength={chaptersQueue.length}
        estTimeStr={estTimeStr}
        remainingRequests={remainingRequests}
        polishCycles={polishCycles}
        remainingChapters={remainingChapters}
        currentChapterTitle={
          concurrency > 1 && currentChapterIndex >= 0
            ? `Lô: Chương ${currentChapterIndex + 1}–${Math.min(currentChapterIndex + concurrency, chaptersQueue.length)}`
            : chaptersQueue[currentChapterIndex]?.title
        }
        selectedModel={selectedModel}
        onStop={handleStopTranslation}
        onResume={handleToggleProcessing}
        onSaveBackup={triggerExportDownload}
        concurrency={concurrency}
      />

      {/* Khối Floating Glossary Scan Progress Widget */}
      <GlossaryScanWidget
        isVisible={isScanWidgetVisible}
        isMinimized={isScanWidgetMinimized}
        setIsMinimized={setIsScanWidgetMinimized}
        setIsVisible={setIsScanWidgetVisible}
        isScanning={isScanningGlossary}
        currentScanningChapterIndex={currentScanningChapterIndex}
        totalScanChapters={totalScanChapters}
        scanningProgress={scanningProgress}
        currentExtractionLoop={currentExtractionLoop}
        extractionLoops={extractionLoops}
        scanFoundCount={scanFoundCount}
        currentScanningChapterTitle={currentScanningChapterTitle}
        selectedModel={selectedModel}
        onToggleScan={() => handleAutoExtractGlossary()}
        failedIds={activeProject.glossaryScanQueueState?.failedIds}
        onRetryFailedGlossaryChapters={handleRetryFailedGlossaryChapters}
        activeProject={activeProject}
      />
    </div>
  );
}
