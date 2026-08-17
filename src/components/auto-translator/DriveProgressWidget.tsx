import React from 'react';
import { Maximize2, Minimize2, X, Clock, Zap, Square, Play, Save, RefreshCw } from 'lucide-react';

interface DriveProgressWidgetProps {
    isVisible: boolean;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    setIsVisible: (v: boolean) => void;
    isProcessing: boolean;
    processedCount: number;
    totalQueueLength: number;
    estTimeStr: string;
    remainingRequests: number;
    polishCycles: number;
    remainingChapters: number;
    currentChapterTitle: string | undefined;
    selectedModel: string;
    onStop: () => void;
    onResume: () => void;
    onSaveBackup: () => void;
    concurrency?: number;
}

export function DriveProgressWidget({
                                        isVisible,
                                        isMinimized,
                                        setIsMinimized,
                                        setIsVisible,
                                        isProcessing,
                                        processedCount,
                                        totalQueueLength,
                                        estTimeStr,
                                        remainingRequests,
                                        polishCycles,
                                        remainingChapters,
                                        currentChapterTitle,
                                        selectedModel,
                                        onStop,
                                        onResume,
                                        onSaveBackup,
                                        concurrency = 1,
                                    }: DriveProgressWidgetProps) {
    if (!isVisible) return null;

    return (
        <div
            id="google-drive-progress-widget"
            className={`fixed bottom-4 right-4 z-50 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl shadow-indigo-950/40 transition-all duration-300 overflow-hidden flex flex-col ${
                isMinimized ? 'w-72 sm:w-80 h-12' : 'w-80 sm:w-96 max-h-[420px] h-auto'
            }`}
        >
            <div className="bg-slate-950/60 border-b border-slate-800/60 text-white px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 text-xs font-bold truncate">
                    {isProcessing ? (
                        <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
                    ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-500 font-bold"></span>
                    )}
                    <span className="truncate">
            {isProcessing
                ? concurrency > 1
                    ? `Đang dịch sỉ: ${processedCount}/${totalQueueLength} chương (${concurrency} luồng)`
                    : `Đang dịch sỉ: ${processedCount}/${totalQueueLength} chương`
                : `Đã tạm dừng: ${processedCount}/${totalQueueLength} chương`}
          </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white cursor-pointer"
                    >
                        {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {!isMinimized ? (
                <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-200">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Tiến trình chung:</span>
                            <span className="text-indigo-400 font-extrabold border border-indigo-500/25 px-1.5 py-0.5 rounded bg-indigo-500/10">
                {totalQueueLength > 0 ? Math.round((processedCount / totalQueueLength) * 100) : 0}%
              </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-500"
                                style={{ width: `${totalQueueLength > 0 ? (processedCount / totalQueueLength) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-[11px]">
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Còn lại dự kiến:
              </span>
                            <strong className="text-slate-200 font-bold block truncate">
                                {isProcessing ? estTimeStr : '--'}
                            </strong>
                        </div>
                        <div className="space-y-0.5">
              <span className="text-slate-400 font-normal flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Request còn lại:
              </span>
                            <strong className="text-slate-200 font-bold block truncate">
                                {remainingRequests} calls
                            </strong>
                        </div>
                    </div>

                    {totalQueueLength > 0 && currentChapterTitle && (
                        <div className="bg-indigo-950/20 border border-indigo-800/40 p-2.5 rounded-lg text-xs space-y-1">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Chương hiện tại:</span>
                            <p className="font-extrabold text-slate-100 truncate">{currentChapterTitle}</p>
                            <p className="text-[10px] text-slate-400">Mô hình: {selectedModel} | {polishCycles} lần biên tập</p>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                        {isProcessing ? (
                            <button
                                onClick={onStop}
                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-white" />
                                Dừng &amp; Lưu
                            </button>
                        ) : (
                            <button
                                onClick={onResume}
                                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                Tiếp tục dịch
                            </button>
                        )}

                        <button
                            onClick={onSaveBackup}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
                            title="Tải tệp lưu trữ backup cấu trúc truyện dạng .JSON"
                        >
                            <Save className="w-4 h-4 text-slate-300" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-4 h-12 flex items-center justify-between text-xs font-medium text-slate-300">
          <span className="truncate flex items-center gap-1.5 font-bold text-slate-200">
            {isProcessing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500 font-bold"></span>
            )}
              <span>Dịch sỉ: {processedCount}/{totalQueueLength} ({totalQueueLength > 0 ? Math.round((processedCount / totalQueueLength) * 100) : 0}%)</span>
          </span>

                    <div className="flex items-center gap-2 shrink-0">
                        {isProcessing && (
                            <button
                                onClick={onStop}
                                className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-rose-500" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline ml-1 cursor-pointer"
                        >
                            Mở rộng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}