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
        <div className="bg-[#0b0f19] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[280px] shadow-lg shadow-indigo-950/5">
            <div className="bg-[#0e1424] text-slate-400 px-4 py-2.5 flex justify-between items-center text-xs border-b border-slate-800/80 shrink-0">
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <code className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse shadow-sm shadow-emerald-500/50"></code>
          Nhật Ký Tiến Trình Biên Dịch
        </span>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                    Xóa log
                </button>
            </div>

            <div
                ref={containerRef}
                className="p-4 overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed space-y-1.5 bg-[#070b13] scrollbar-none"
            >
                {logs.length === 0 ? (
                    <div className="text-slate-600 italic py-16 text-center">
                        Hệ thống log đang trống. Bấm nút bắt đầu để theo dõi tiến trình chạy nền.
                    </div>
                ) : (
                    logs.map((log, idx) => {
                        const typeColor = log.type === 'error'
                            ? 'text-rose-500 font-bold'
                            : log.type === 'success'
                                ? 'text-emerald-400 font-bold'
                                : log.type === 'warn'
                                    ? 'text-amber-400 font-semibold'
                                    : log.type === 'gemini'
                                        ? 'text-indigo-400'
                                        : 'text-slate-350';
                        return (
                            <div key={idx} className="flex gap-2 items-start hover:bg-white/[0.02] py-0.5 rounded px-1 transition-all">
                                <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                                <p className={`${typeColor} flex-1 whitespace-pre-wrap`}>{log.message}</p>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
});