import React from 'react';
import { Maximize2, Minimize2, X, Clock, Zap, Square, Play, Save, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

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
            className={`fixed bottom-4 right-4 z-50 bg-parchment border border-parchment-2 rounded-md shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
                isMinimized ? 'w-72 sm:w-80 h-12' : 'w-[calc(100vw-2rem)] sm:w-96 max-h-[420px] h-auto'
            }`}
        >
            <div className="bg-ink border-b border-parchment-2 text-text-main px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 text-xs font-bold truncate">
                    {isProcessing ? (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-polish opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-polish"></span>
                        </span>
                    ) : (
                        <span className="h-2 w-2 rounded-full bg-text-muted font-bold"></span>
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
                            <span className="text-text-muted">Tiến trình chung:</span>
                            <span className="text-polish font-bold border border-polish/30 px-1.5 py-0.5 rounded-[2px] bg-ink">
                                {totalQueueLength > 0 ? Math.round((processedCount / totalQueueLength) * 100) : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-ink rounded-full h-2 overflow-hidden border border-parchment-2">
                            <div
                                className="bg-polish h-full transition-all duration-500"
                                style={{ width: `${totalQueueLength > 0 ? (processedCount / totalQueueLength) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-ink p-2.5 rounded-[2px] border border-parchment-2 text-[11px]">
                        <div className="space-y-0.5">
                            <span className="text-text-muted font-normal flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-polish" />
                                Còn lại dự kiến:
                            </span>
                            <strong className="text-text-main font-bold block truncate">
                                {isProcessing ? estTimeStr : '--'}
                            </strong>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-text-muted font-normal flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                Request còn lại:
                            </span>
                            <strong className="text-text-main font-bold block truncate">
                                {remainingRequests} calls
                            </strong>
                        </div>
                    </div>

                    {totalQueueLength > 0 && currentChapterTitle && (
                        <div className="bg-ink border border-parchment-2 p-2.5 rounded-[2px] text-xs space-y-1">
                            <span className="text-[10px] font-bold text-polish uppercase tracking-wider block">Chương hiện tại:</span>
                            <p className="font-bold text-text-main truncate">{currentChapterTitle}</p>
                            <p className="text-[10px] text-text-muted">Mô hình: {selectedModel} | {polishCycles} lần biên tập</p>
                        </div>
                    )}

                    <div className="pt-2 border-t border-parchment-2 flex items-center gap-2">
                        {isProcessing ? (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onStop}
                                icon={<Square className="w-3.5 h-3.5 fill-white" />}
                                className="flex-1 bg-polish hover:bg-[#A03522] text-white"
                            >
                                Dừng &amp; Lưu
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onResume}
                                icon={<Play className="w-3.5 h-3.5 fill-white" />}
                                className="flex-1"
                            >
                                Tiếp tục dịch
                            </Button>
                        )}

                        <button
                            onClick={onSaveBackup}
                            className="p-1.5 bg-ink hover:bg-parchment-2 text-text-main rounded-[2px] border border-parchment-2 cursor-pointer transition-colors"
                            title="Tải tệp lưu trữ backup cấu trúc truyện dạng .JSON"
                        >
                            <Save className="w-4 h-4 text-text-muted" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-4 h-12 flex items-center justify-between text-xs font-medium text-text-main">
                    <span className="truncate flex items-center gap-1.5 font-bold text-text-main">
                        {isProcessing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-polish" />
                        ) : (
                            <span className="w-2 h-2 rounded-full bg-text-muted font-bold"></span>
                        )}
                        <span>Dịch sỉ: {processedCount}/{totalQueueLength} ({totalQueueLength > 0 ? Math.round((processedCount / totalQueueLength) * 100) : 0}%)</span>
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                        {isProcessing && (
                            <button
                                onClick={onStop}
                                className="p-1 text-polish hover:bg-polish/10 rounded-[2px] transition-colors cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5 fill-polish" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="text-polish hover:underline ml-1 cursor-pointer font-bold"
                        >
                            Mở rộng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}