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
    <div id="bulk-glossary-extract-card" className="space-y-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-xl shadow-xs">
      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
        <Database className="w-4 h-4 text-amber-555" /> Rà soát &amp; Lọc thuật ngữ sỉ
      </h3>
      <p className="text-[11px] text-slate-450">Quét sỉ toàn tập truyện để tự động bóc tách, chuẩn hóa danh xưng danh riêng phương Tây/Trung Hoa cổ phong đưa thẳng vào bộ quy tắc.</p>

      {/* Phạm vi chương rà soát */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-400" /> Giới hạn phạm vi chương</span>
          <button
            type="button"
            disabled={isScanningGlossary}
            onClick={() => setScanRangeEnabled(!scanRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${scanRangeEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${scanRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {scanRangeEnabled && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">Từ chương</label>
              <input
                type="number" min={1} max={totalChapters}
                value={scanRangeStart}
                disabled={isScanningGlossary}
                onChange={e => {
                  const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                  setScanRangeStart(v);
                  if (v > scanRangeEnd) setScanRangeEnd(v);
                }}
                className="w-full text-center text-sm font-extrabold border border-slate-700/60 rounded-lg bg-slate-950 py-1.5 text-amber-400 focus:outline-none focus:border-amber-550 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">Đến chương</label>
              <input
                type="number" min={scanRangeStart} max={totalChapters}
                value={scanRangeEnd}
                disabled={isScanningGlossary}
                onChange={e => setScanRangeEnd(Math.max(scanRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                className="w-full text-center text-sm font-extrabold border border-slate-700/60 rounded-lg bg-slate-950 py-1.5 text-amber-400 focus:outline-none focus:border-amber-555 disabled:opacity-50"
              />
            </div>
            <div className="col-span-2 bg-amber-950/10 border border-amber-800/20 rounded-lg px-3 py-1.5 text-[11px] text-amber-300 flex items-center justify-between">
              <span>Phạm vi quét:</span>
              <strong className="text-amber-400 font-extrabold">{scanRangeEnd - scanRangeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <label className="font-bold text-slate-300">Vòng lặp rà soát sâu:</label>
          <span className="bg-amber-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{extractionLoops} vòng</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={isScanningGlossary}
              onClick={() => setExtractionLoops(n)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${extractionLoops === n ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-850 hover:text-slate-200 disabled:opacity-50'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={handleAutoExtractGlossary} className={`w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer ${isScanningGlossary ? 'bg-rose-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
        {isScanningGlossary ? <><Square className="w-3.5 h-3.5 fill-white" /> Dừng quét lọc ({scanningProgress}%)</> : <><Database className="w-3.5 h-3.5 fill-white" /> Kích hoạt quét lọc sỉ mới</>}
      </button>
    </div>
  );
});
