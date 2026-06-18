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
        <div className="bg-slate-900 rounded-xl border border-slate-850 overflow-hidden flex flex-col h-[280px] shadow-md">
            <div className="bg-slate-950 text-slate-400 px-4 py-2 flex justify-between items-center text-xs border-b border-white/5 shrink-0">
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <code className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse"></code>
          Hệ điều hành logs máy chủ dịch thuật
        </span>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                    Clear terminal
                </button>
            </div>

            <div
                ref={containerRef}
                className="p-4 overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed space-y-1 bg-slate-950"
            >
                {logs.length === 0 ? (
                    <div className="text-slate-600 italic py-16 text-center">
                        Nhấn nút &quot;Kích hoạt Dịch Tự Động&quot; để chứng kiến hệ điều hành dịch và trích lọc từ vựng sỉ hoạt động.
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