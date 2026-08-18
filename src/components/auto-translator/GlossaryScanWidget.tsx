import React from 'react';
import { Maximize2, Minimize2, X, RefreshCw, Sparkles, Square, Check } from 'lucide-react';
import { StoryProject } from '../../types';
import { Button } from '../ui/Button';

interface GlossaryScanWidgetProps {
    isVisible: boolean;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    setIsVisible: (v: boolean) => void;
    isScanning: boolean;
    currentScanningChapterIndex: number;
    totalScanChapters: number;
    scanningProgress: number;
    currentExtractionLoop: number;
    extractionLoops: number;
    scanFoundCount: number;
    currentScanningChapterTitle: string;
    selectedModel: string;
    onToggleScan: () => void;
    failedIds?: string[];
    onRetryFailedGlossaryChapters?: () => void;
    activeProject: StoryProject;
}

export function GlossaryScanWidget({
    isVisible,
    isMinimized,
    setIsMinimized,
    setIsVisible,
    isScanning,
    currentScanningChapterIndex,
    totalScanChapters,
    scanningProgress,
    currentExtractionLoop,
    extractionLoops,
    scanFoundCount,
    currentScanningChapterTitle,
    selectedModel,
    onToggleScan,
    failedIds,
    onRetryFailedGlossaryChapters,
    activeProject,
}: GlossaryScanWidgetProps) {
    if (!isVisible) return null;

    return (
        <div
            className={`fixed bottom-4 left-4 z-50 bg-parchment border border-parchment-2 rounded-md shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
                isMinimized ? 'w-72 sm:w-80 h-12' : 'w-[calc(100vw-2rem)] sm:w-96 max-h-[400px] h-auto'
            }`}
        >
            <div className="bg-ink border-b border-parchment-2 text-text-main px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 text-xs font-bold truncate">
                    {isScanning ? (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                    ) : (
                        <span className="h-2 w-2 rounded-full bg-text-muted"></span>
                    )}
                    <span className="truncate">
                        {isScanning
                            ? `Đang quét: ${currentScanningChapterIndex}/${totalScanChapters} chương`
                            : `Hoàn tất: ${currentScanningChapterIndex}/${totalScanChapters} chương`}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 hover:bg-parchment-2 rounded-[2px] transition-colors text-text-muted hover:text-text-main cursor-pointer"
                    >
                        {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-parchment-2 rounded-[2px] transition-colors text-text-muted hover:text-polish cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {!isMinimized ? (
                <div className="p-4 space-y-4 overflow-y-auto flex-1 text-text-main">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-text-muted">Tiến trình quét:</span>
                            <span className="text-amber-400 font-bold bg-ink border border-parchment-2 px-1.5 py-0.5 rounded-[2px]">{scanningProgress}%</span>
                        </div>
                        <div className="w-full bg-ink rounded-full h-2 overflow-hidden border border-parchment-2">
                            <div
                                className="bg-amber-500 h-full transition-all duration-500"
                                style={{ width: `${scanningProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-ink p-2.5 rounded-[2px] border border-parchment-2 text-[11px]">
                        <div className="space-y-0.5">
                            <span className="text-text-muted font-normal flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                                Vòng lặp:
                            </span>
                            <strong className="text-text-main font-bold block">{currentExtractionLoop} / {extractionLoops}</strong>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-text-muted font-normal flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                Từ mới tìm thấy:
                            </span>
                            <strong className="text-amber-400 font-bold block">{scanFoundCount} thuật ngữ</strong>
                        </div>
                    </div>

                    {currentScanningChapterTitle && (
                        <div className="bg-ink border border-parchment-2 p-2.5 rounded-[2px] text-xs space-y-1">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                                {isScanning ? 'Đang quét:' : 'Chương cuối:'}
                            </span>
                            <p className="font-bold text-text-main truncate">{currentScanningChapterTitle}</p>
                            <p className="text-[10px] text-text-muted">Mô hình: {selectedModel}</p>
                        </div>
                    )}

                    {failedIds && failedIds.length > 0 && (
                        <div className="bg-polish/10 border border-polish/40 p-3 rounded-[2px] space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 relative shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-polish opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-polish"></span>
                                </span>
                                <span className="text-[10px] font-bold text-polish uppercase tracking-wider">
                                    Phát hiện {failedIds.length} chương lỗi khi quét
                                </span>
                            </div>
                            <p className="text-[10px] text-text-main font-normal leading-normal max-h-16 overflow-y-auto bg-ink p-2 rounded-[2px] border border-parchment-2 custom-scrollbar">
                                {failedIds.map((fid) => {
                                    const chap = activeProject.chapters.find(c => c.id === fid);
                                    return chap ? chap.title : fid;
                                }).join(', ')}
                            </p>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={onRetryFailedGlossaryChapters}
                                disabled={isScanning}
                                className="w-full py-1 text-[11px]"
                            >
                                Quét lại các chương lỗi này
                            </Button>
                        </div>
                    )}

                    <div className="pt-2 border-t border-parchment-2">
                        {isScanning ? (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={onToggleScan}
                                icon={<Square className="w-3.5 h-3.5 fill-white" />}
                                className="w-full py-2 bg-polish hover:bg-[#A03522] text-white"
                            >
                                Dừng quét ngay
                            </Button>
                        ) : (
                            <div className="text-center text-xs font-bold text-polish flex items-center justify-center gap-1.5 py-1">
                                <Check className="w-4 h-4 text-polish" />
                                Quét hoàn tất — {scanFoundCount} thuật ngữ mới
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-4 h-12 flex items-center justify-between text-xs font-medium text-text-main">
                    <span className="truncate flex items-center gap-1.5 font-bold text-text-main">
                        {isScanning ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        ) : (
                            <Check className="w-3.5 h-3.5 text-polish" />
                        )}
                        <span>Quét: {currentScanningChapterIndex}/{totalScanChapters} ({scanningProgress}%) · {scanFoundCount} từ</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {isScanning && (
                            <button
                                onClick={onToggleScan}
                                className="p-1 text-polish hover:bg-polish/10 rounded-[2px] transition-colors cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-polish" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-amber-400 hover:underline ml-1 cursor-pointer font-bold"
                        >
                            Mở rộng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GlossaryScanWidget;