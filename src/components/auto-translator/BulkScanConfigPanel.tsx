import React from 'react';
import { Database, ListOrdered, Square } from 'lucide-react';

export interface BulkScanConfigPanelProps {
  scanRangeEnabled: boolean;
  setScanRangeEnabled: (b: boolean) => void;
  scanRangeStart: number;
  setScanRangeStart: (n: number) => void;
  scanRangeEnd: number;
  setScanRangeEnd: (n: number) => void;
  totalChapters: number;
  isScanningGlossary: boolean;
  scanningProgress: number;
  extractionLoops: number;
  setExtractionLoops: (n: number) => void;
  handleAutoExtractGlossary: () => void;
}

export const BulkScanConfigPanel = React.memo(function BulkScanConfigPanel({
  scanRangeEnabled,
  setScanRangeEnabled,
  scanRangeStart,
  setScanRangeStart,
  scanRangeEnd,
  setScanRangeEnd,
  totalChapters,
  isScanningGlossary,
  scanningProgress,
  extractionLoops,
  setExtractionLoops,
  handleAutoExtractGlossary,
}: BulkScanConfigPanelProps) {
  return (
    <div id="bulk-glossary-extract-card" className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs">
      <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-parchment-2 pb-2">
        <Database className="w-4 h-4 text-amber-500" /> Rà soát &amp; Lọc thuật ngữ sỉ
      </h3>
      <p className="text-[11px] text-text-muted">Quét sỉ toàn tập truyện để tự động bóc tách, chuẩn hóa danh xưng danh riêng phương Tây/Trung Hoa cổ phong đưa thẳng vào bộ quy tắc.</p>

      {/* Phạm vi chương rà soát */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-main flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-400" /> Giới hạn phạm vi chương</span>
          <button
            type="button"
            disabled={isScanningGlossary}
            onClick={() => setScanRangeEnabled(!scanRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${scanRangeEnabled ? 'bg-amber-600' : 'bg-parchment-2'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${scanRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {scanRangeEnabled && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Từ chương</label>
              <input
                type="number" min={1} max={totalChapters}
                value={scanRangeStart}
                disabled={isScanningGlossary}
                onChange={e => {
                  const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                  setScanRangeStart(v);
                  if (v > scanRangeEnd) setScanRangeEnd(v);
                }}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Đến chương</label>
              <input
                type="number" min={scanRangeStart} max={totalChapters}
                value={scanRangeEnd}
                disabled={isScanningGlossary}
                onChange={e => setScanRangeEnd(Math.max(scanRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
            </div>
            <div className="col-span-2 bg-ink border border-parchment-2 rounded-[2px] px-3 py-1.5 text-[11px] text-amber-300 flex items-center justify-between">
              <span className="text-text-muted">Phạm vi quét:</span>
              <strong className="text-amber-400 font-bold">{scanRangeEnd - scanRangeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="font-bold text-text-main">Vòng lặp rà soát sâu:</label>
          <span className="bg-ink border border-parchment-2 text-amber-400 rounded-[2px] px-2.5 py-0.5 text-[10px] font-bold">{extractionLoops} vòng</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={isScanningGlossary}
              onClick={() => setExtractionLoops(n)}
              className={`flex-1 py-1.5 rounded-[2px] text-xs font-bold border cursor-pointer transition-colors ${extractionLoops === n ? 'bg-amber-600 border-amber-600 text-white shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main disabled:opacity-50'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => handleAutoExtractGlossary()} className={`w-full py-2.5 rounded-[2px] text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer ${isScanningGlossary ? 'bg-rose-600 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
        {isScanningGlossary ? <><Square className="w-3.5 h-3.5 fill-white" /> Dừng quét lọc ({scanningProgress}%)</> : <><Database className="w-3.5 h-3.5 fill-white" /> Kích hoạt quét lọc sỉ mới</>}
      </button>
    </div>
  );
});
