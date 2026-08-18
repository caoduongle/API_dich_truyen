import React from 'react';
import { ListOrdered, Check, RefreshCw } from 'lucide-react';
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
    <div className="bg-parchment border border-parchment-2 p-4 rounded-md shadow-xs space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5 font-display">
          <ListOrdered className="w-4 h-4 text-polish" /> Trạng thái vận chuyển hàng đợi ({processedCount}/{chaptersQueue.length})
          {concurrency > 1 && currentChapterIndex >= 0 && currentChapterIndex < chaptersQueue.length && (
            <span className="text-[10px] font-normal text-polish ml-1">
              | Lô: chương {currentChapterIndex + 1}–{effectiveBatchEnd} ({concurrency} luồng)
            </span>
          )}
        </span>
        <span className="text-[10px] bg-ink border border-parchment-2 px-2 py-0.5 rounded-[2px] font-bold text-text-main">{progressPercent}% Hoàn thành</span>
      </div>
      <div className="w-full bg-ink rounded-full h-2 overflow-hidden border border-parchment-2">
        <div className="bg-polish h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-24 overflow-y-auto pt-1 text-[10px]">
        {chaptersQueue.map((chap, idx) => {
          const isCurrent = concurrency > 1
            ? (idx >= currentChapterIndex && idx < effectiveBatchEnd)
            : idx === currentChapterIndex;
          const isDone = idx < currentChapterIndex;
          return (
            <div key={chap.id} className={`p-1.5 rounded-[2px] border flex items-center justify-between ${isCurrent ? 'border-polish bg-polish/15 text-polish font-bold animate-pulse' : isDone ? 'border-parchment-2 bg-ink text-text-muted' : 'border-parchment-2 bg-ink/40 text-text-muted opacity-60'}`}>
              <span className="truncate flex-1" title={chap.title}>{chap.title}</span>
              {isDone && <Check className="w-3 h-3 text-polish shrink-0 ml-1" />}
              {isCurrent && <RefreshCw className="w-2.5 h-2.5 animate-spin text-polish shrink-0 ml-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default QueueStatusPanel;
