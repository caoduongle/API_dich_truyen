import React, { useEffect, useRef } from 'react';

export interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'warn' | 'error' | 'gemini';
    message: string;
}

interface TerminalConsoleProps {
    logs: LogEntry[];
    onClear: () => void;
}

export const TerminalConsole = React.memo(function TerminalConsole({ logs, onClear }: TerminalConsoleProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="bg-ink rounded-md border border-parchment-2 overflow-hidden flex flex-col h-[280px] shadow-xs">
            <div className="bg-parchment text-text-main px-4 py-2.5 flex justify-between items-center text-xs border-b border-parchment-2 shrink-0">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <code className="w-2 h-2 rounded-full bg-polish block animate-pulse shadow-xs"></code>
                    Nhật Ký Tiến Trình Bản Thảo
                </span>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[10px] font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                    Xóa log
                </button>
            </div>

            <div
                ref={containerRef}
                className="p-4 overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed space-y-1.5 bg-ink scrollbar-none"
            >
                {logs.length === 0 ? (
                    <div className="text-text-muted italic py-16 text-center">
                        Hệ thống log đang trống. Bấm nút bắt đầu để theo dõi tiến trình chạy nền.
                    </div>
                ) : (
                    logs.map((log, idx) => {
                        const typeColor = log.type === 'error'
                            ? 'text-polish font-bold'
                            : log.type === 'success'
                                ? 'text-polish font-bold'
                                : log.type === 'warn'
                                    ? 'text-amber-400 font-semibold'
                                    : log.type === 'gemini'
                                        ? 'text-text-main font-semibold'
                                        : 'text-text-muted';
                        return (
                            <div key={idx} className="flex gap-2 items-start hover:bg-parchment/40 py-0.5 rounded-[2px] px-1 transition-all">
                                <span className="text-text-muted shrink-0 select-none">[{log.timestamp}]</span>
                                <p className={`${typeColor} flex-1 whitespace-pre-wrap`}>{log.message}</p>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
});

export default TerminalConsole;