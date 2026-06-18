import React from 'react';
import { Maximize2, Minimize2, X, RefreshCw, Sparkles, Square, Check } from 'lucide-react';

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
                                   }: GlossaryScanWidgetProps) {
    if (!isVisible) return null;

    return (
        <div
            className={`fixed bottom-4 left-4 z-50 bg-white border border-amber-200 rounded-xl shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
                isMinimized ? 'w-72 sm:w-80 h-12' : 'w-80 sm:w-96 max-h-[400px] h-auto'
            }`}
        >
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
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
                <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500">Tiến trình quét:</span>
                            <span className="text-amber-600 font-extrabold">{scanningProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                            <div
                                className="bg-gradient-to-r from-amber-400 to-amber-600 h-full transition-all duration-500"
                                style={{ width: `${scanningProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-[11px]">
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                Vòng lặp:
              </span>
                            <strong className="text-slate-700 font-bold block">{currentExtractionLoop} / {extractionLoops}</strong>
                        </div>
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Từ mới tìm thấy:
              </span>
                            <strong className="text-amber-700 font-bold block">{scanFoundCount} thuật ngữ</strong>
                        </div>
                    </div>

                    {currentScanningChapterTitle && (
                        <div className="bg-amber-50/70 border border-amber-100 p-2.5 rounded-lg text-xs space-y-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                {isScanning ? 'Đang quét:' : 'Chương cuối:'}
              </span>
                            <p className="font-extrabold text-amber-950 truncate">{currentScanningChapterTitle}</p>
                            <p className="text-[10px] text-slate-400">Mô hình: {selectedModel}</p>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
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
                            <div className="text-center text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5 py-1">
                                <Check className="w-4 h-4" />
                                Quét hoàn tất — {scanFoundCount} thuật ngữ mới
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-4 h-12 flex items-center justify-between text-xs font-medium">
          <span className="truncate flex items-center gap-1.5 font-bold text-slate-800">
            {isScanning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            )}
              <span>Quét: {currentScanningChapterIndex}/{totalScanChapters} ({scanningProgress}%) · {scanFoundCount} từ</span>
          </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {isScanning && (
                            <button
                                onClick={onToggleScan}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-rose-600" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-amber-600 hover:text-amber-800 font-bold hover:underline ml-1 cursor-pointer"
                        >
                            Mở rộng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}