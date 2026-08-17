import React from 'react';
import { Maximize2, Minimize2, X, RefreshCw, Sparkles, Square, Check } from 'lucide-react';
import { StoryProject } from '../../types';

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
            className={`fixed bottom-4 left-4 z-50 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl shadow-amber-950/20 transition-all duration-300 overflow-hidden flex flex-col ${
                isMinimized ? 'w-72 sm:w-80 h-12' : 'w-80 sm:w-96 max-h-[400px] h-auto'
            }`}
        >
            <div className="bg-amber-600/90 border-b border-amber-500/30 text-white px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 text-xs font-bold truncate">
                    {isScanning ? (
                        <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
                    ) : (
                        <span className="h-2 w-2 rounded-full bg-amber-200"></span>
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
                        className="p-1 hover:bg-amber-700 rounded transition-colors text-amber-100 hover:text-white cursor-pointer"
                    >
                        {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-amber-700 rounded transition-colors text-amber-100 hover:text-rose-300 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {!isMinimized ? (
                <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-200">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Tiến trình quét:</span>
                            <span className="text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{scanningProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                            <div
                                className="bg-gradient-to-r from-amber-400 to-amber-600 h-full transition-all duration-500"
                                style={{ width: `${scanningProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-[11px]">
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                Vòng lặp:
              </span>
                            <strong className="text-slate-200 font-bold block">{currentExtractionLoop} / {extractionLoops}</strong>
                        </div>
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Từ mới tìm thấy:
              </span>
                            <strong className="text-amber-400 font-bold block">{scanFoundCount} thuật ngữ</strong>
                        </div>
                    </div>

                    {currentScanningChapterTitle && (
                        <div className="bg-amber-950/10 border border-amber-800/40 p-2.5 rounded-lg text-xs space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                {isScanning ? 'Đang quét:' : 'Chương cuối:'}
              </span>
                            <p className="font-extrabold text-slate-100 truncate">{currentScanningChapterTitle}</p>
                            <p className="text-[10px] text-slate-400">Mô hình: {selectedModel}</p>
                        </div>
                    )}

                    {failedIds && failedIds.length > 0 && (
                        <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 relative shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                                    Phát hiện {failedIds.length} chương lỗi khi quét
                                </span>
                            </div>
                            <p className="text-[10px] text-rose-300/90 font-normal leading-normal max-h-16 overflow-y-auto bg-slate-950/40 p-2 rounded border border-rose-900/30 custom-scrollbar">
                                {failedIds.map((fid) => {
                                    const chap = activeProject.chapters.find(c => c.id === fid);
                                    return chap ? chap.title : fid;
                                }).join(', ')}
                            </p>
                            <button
                                type="button"
                                onClick={onRetryFailedGlossaryChapters}
                                disabled={isScanning}
                                className={`w-full py-1.5 bg-rose-600 hover:bg-rose-600 text-white rounded-lg text-[11px] font-extrabold shadow-sm flex items-center justify-center gap-1 transition-all ${
                                    isScanning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                            >
                                Quét lại các chương lỗi này
                            </button>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-800">
                        {isScanning ? (
                            <button
                                type="button"
                                onClick={onToggleScan}
                                className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none"
                            >
                                <Square className="w-3.5 h-3.5 fill-white" />
                                Dừng quét ngay
                            </button>
                        ) : (
                            <div className="text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5 py-1">
                                <Check className="w-4 h-4" />
                                Quét hoàn tất — {scanFoundCount} thuật ngữ mới
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-4 h-12 flex items-center justify-between text-xs font-medium">
          <span className="truncate flex items-center gap-1.5 font-bold text-slate-200">
            {isScanning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
            ) : (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            )}
              <span>Quét: {currentScanningChapterIndex}/{totalScanChapters} ({scanningProgress}%) · {scanFoundCount} từ</span>
          </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {isScanning && (
                            <button
                                onClick={onToggleScan}
                                className="p-1 text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-rose-500" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-amber-400 hover:text-amber-300 font-bold hover:underline ml-1 cursor-pointer"
                        >
                            Mở rộng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}