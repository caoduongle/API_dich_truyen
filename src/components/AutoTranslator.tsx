import React, { useState, useEffect } from 'react';
import { StoryProject } from '../types';
import { Cpu } from 'lucide-react';

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
}

export default function AutoTranslator({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
}: AutoTranslatorProps) {
  const totalChapters = activeProject.chapters.length || 0;

  // Local configs
  const [polishCycles, setPolishCycles] = useState<number>(1);
  const [autoTranslateMode, setAutoTranslateMode] = useState<'resume' | 'from_scratch'>('resume');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [isExtractionDuringTranslationEnabled, setIsExtractionDuringTranslationEnabled] = useState<boolean>(true);

  // Range selections
  const [rangeEnabled, setRangeEnabled] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(() => totalChapters || 1);

  const [applyGlossaryRangeEnabled, setApplyGlossaryRangeEnabled] = useState<boolean>(false);
  const [applyGlossaryRangeStart, setApplyGlossaryRangeStart] = useState<number>(1);
  const [applyGlossaryRangeEnd, setApplyGlossaryRangeEnd] = useState<number>(() => totalChapters || 1);

  const [scanRangeEnabled, setScanRangeEnabled] = useState<boolean>(false);
  const [scanRangeStart, setScanRangeStart] = useState<number>(1);
  const [scanRangeEnd, setScanRangeEnd] = useState<number>(() => totalChapters || 1);
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

  // Sync range bounds on chapter size change
  useEffect(() => {
    if (totalChapters > 0) {
      setRangeEnd(prev => prev >= totalChapters - 1 ? totalChapters : prev);
      setApplyGlossaryRangeEnd(prev => prev >= totalChapters - 1 ? totalChapters : prev);
      setScanRangeEnd(prev => prev >= totalChapters - 1 ? totalChapters : prev);
    }
  }, [totalChapters]);

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
  } = useAutoTranslationQueue({
    activeProject,
    onUpdateProject,
    apiKeys,
    selectedModel,
    polishCycles,
    autoTranslateMode,
    additionalInstructions,
    isExtractionDuringTranslationEnabled,
    rangeEnabled,
    rangeStart,
    rangeEnd,
    applyGlossaryRangeEnabled,
    applyGlossaryRangeStart,
    applyGlossaryRangeEnd,
    scanRangeEnabled,
    scanRangeStart,
    scanRangeEnd,
    extractionLoops,
    chaptersPerFile,
    exportScope,
    exportMode,
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

  // Open processing widget when queue starts
  useEffect(() => {
    if (isProcessing) {
      setIsDriveWidgetVisible(true);
      setIsDriveWidgetMinimized(false);
    }
  }, [isProcessing]);

  const totalUntranslatedChapters = activeProject.chapters.filter(
    c => !c.polishedTranslation.trim() && !c.rawTranslation.trim()
  ).length;

  const remainingChapters = Math.max(0, chaptersQueue.length - processedCount);
  const requestsPerChapter = 1 + polishCycles;
  const remainingRequests = Math.max(0, remainingChapters * requestsPerChapter);
  const hasProcessedChapters = activeProject.chapters.some(c => c.processedSourceText);

  return (
    <div id="auto-translator" className="space-y-6">
      {/* Banner tổng quan tham số */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/35 uppercase tracking-wider">HỆ THỐNG AUTOMATION SỈ</span>
          <h2 className="text-base font-bold tracking-tight mt-1 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400 animate-spin" />
            Biên Dịch &amp; Tự Động Thuật Ngữ Bộ Truyện
          </h2>
          <p className="text-slate-400 text-xs">Hệ thống kích hoạt dịch tuần tự song song, tự động bóc tách từ vựng mới nạp gối đầu cho các chương kế sau.</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-xs grid grid-cols-2 gap-x-4 gap-y-1.5 max-w-sm shrink-0">
          <div className="text-slate-400 font-semibold">Mô hình AI:</div>
          <div className="text-indigo-300 font-extrabold text-right">{selectedModel}</div>
          <div className="text-slate-400 font-semibold">Tông xưng hô:</div>
          <div className="text-indigo-300 font-extrabold text-right line-clamp-1">{activeProject.tone}</div>
          <div className="text-slate-400 font-semibold text-xs leading-none">Chương chưa dịch:</div>
          <div className="text-yellow-400 font-extrabold text-right text-xs leading-none">{totalUntranslatedChapters} / {totalChapters} chap</div>
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
            rangeEnabled={rangeEnabled}
            setRangeEnabled={setRangeEnabled}
            rangeStart={rangeStart}
            setRangeStart={setRangeStart}
            rangeEnd={rangeEnd}
            setRangeEnd={setRangeEnd}
            totalChapters={totalChapters}
            totalUntranslatedChapters={totalUntranslatedChapters}
            isProcessing={isProcessing}
            handleToggleProcessing={handleToggleProcessing}
            handleStopTranslation={handleStopTranslation}
            handleResetQueue={handleResetQueue}
            triggerExportDownload={triggerExportDownload}
          />

          <ApplyGlossaryPanel
            applyGlossaryRangeEnabled={applyGlossaryRangeEnabled}
            setApplyGlossaryRangeEnabled={setApplyGlossaryRangeEnabled}
            applyGlossaryRangeStart={applyGlossaryRangeStart}
            setApplyGlossaryRangeStart={setApplyGlossaryRangeStart}
            applyGlossaryRangeEnd={applyGlossaryRangeEnd}
            setApplyGlossaryRangeEnd={setApplyGlossaryRangeEnd}
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
            scanRangeEnabled={scanRangeEnabled}
            setScanRangeEnabled={setScanRangeEnabled}
            scanRangeStart={scanRangeStart}
            setScanRangeStart={setScanRangeStart}
            scanRangeEnd={scanRangeEnd}
            setScanRangeEnd={setScanRangeEnd}
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
        <DiffModal
          chapters={activeProject.chapters}
          glossary={activeProject.glossary}
          diffModalChapterIndex={diffModalChapterIndex}
          setDiffModalChapterIndex={setDiffModalChapterIndex}
          onClose={() => setIsDiffModalOpen(false)}
        />
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
        currentChapterTitle={chaptersQueue[currentChapterIndex]?.title}
        selectedModel={selectedModel}
        onStop={handleStopTranslation}
        onResume={handleToggleProcessing}
        onSaveBackup={triggerExportDownload}
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
        onToggleScan={handleAutoExtractGlossary}
      />
    </div>
  );
}
