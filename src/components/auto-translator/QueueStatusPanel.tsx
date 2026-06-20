import React from 'react';
import { ListOrdered, Check } from 'lucide-react';
import { ChapterMetadata } from '../../types';

export interface QueueStatusPanelProps {
  chaptersQueue: ChapterMetadata[];
  processedCount: number;
  currentChapterIndex: number;
  concurrency?: number;
}

export const QueueStatusPanel = React.memo(function QueueStatusPanel({
  chaptersQueue,
  processedCount,
  currentChapterIndex,
  concurrency = 1,
}: QueueStatusPanelProps) {
  if (chaptersQueue.length === 0) return null;

  const progressPercent = Math.round((processedCount / chaptersQueue.length) * 100);
  const effectiveBatchEnd = Math.min(currentChapterIndex + concurrency, chaptersQueue.length);

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <ListOrdered className="w-4 h-4 text-indigo-500" /> Trạng thái vận chuyển hàng đợi ({processedCount}/{chaptersQueue.length})
          {concurrency > 1 && currentChapterIndex >= 0 && currentChapterIndex < chaptersQueue.length && (
            <span className="text-[10px] font-normal text-indigo-600 ml-1">
              | Lô: chương {currentChapterIndex + 1}–{effectiveBatchEnd} ({concurrency} luồng)
            </span>
          )}
        </span>
        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-extrabold text-slate-700">{progressPercent}% Hoàn thành</span>
      </div>
      <div className="w-full bg-slate-150 rounded-full h-2 overflow-hidden">
        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-24 overflow-y-auto pt-1 text-[10px]">
        {chaptersQueue.map((chap, idx) => {
          const isCurrent = concurrency > 1
            ? (idx >= currentChapterIndex && idx < effectiveBatchEnd)
            : idx === currentChapterIndex;
          const isDone = idx < currentChapterIndex;
          return (
            <div key={chap.id} className={`p-1.5 rounded border flex items-center justify-between ${isCurrent ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold animate-pulse' : isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-slate-100 bg-slate-50/50 text-slate-400'}`}>
              <span className="truncate flex-1" title={chap.title}>{chap.title}</span>
              {isDone && <Check className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />}
              {isCurrent && <RefreshCwIcon className="w-2.5 h-2.5 animate-spin text-indigo-600 shrink-0 ml-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function RefreshCwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
