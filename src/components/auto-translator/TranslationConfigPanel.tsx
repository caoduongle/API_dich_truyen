import React from 'react';
import { Sliders, ListOrdered, Layers, Play, Pause, Square, Download } from 'lucide-react';

export interface TranslationConfigPanelProps {
  polishCycles: number;
  setPolishCycles: (n: number) => void;
  autoTranslateMode: 'resume' | 'from_scratch';
  setAutoTranslateMode: (mode: 'resume' | 'from_scratch') => void;
  additionalInstructions: string;
  setAdditionalInstructions: (s: string) => void;
  isExtractionDuringTranslationEnabled: boolean;
  setIsExtractionDuringTranslationEnabled: (b: boolean) => void;
  
  rangeEnabled: boolean;
  setRangeEnabled: (b: boolean) => void;
  rangeStart: number;
  setRangeStart: (n: number) => void;
  rangeEnd: number;
  setRangeEnd: (n: number) => void;
  
  totalChapters: number;
  totalUntranslatedChapters: number;
  isProcessing: boolean;
  handleToggleProcessing: () => void;
  handleStopTranslation: () => void;
  handleResetQueue: () => void;
  triggerExportDownload: () => void;

  // New props for smart retry
  skipFailedChapters: boolean;
  setSkipFailedChapters: (b: boolean) => void;

  // Concurrency
  concurrency: number;
  setConcurrency: (n: number) => void;
}

export const TranslationConfigPanel = React.memo(function TranslationConfigPanel({
  polishCycles,
  setPolishCycles,
  autoTranslateMode,
  setAutoTranslateMode,
  additionalInstructions,
  setAdditionalInstructions,
  isExtractionDuringTranslationEnabled,
  setIsExtractionDuringTranslationEnabled,
  rangeEnabled,
  setRangeEnabled,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  totalChapters,
  totalUntranslatedChapters,
  isProcessing,
  handleToggleProcessing,
  handleStopTranslation,
  handleResetQueue,
  triggerExportDownload,
  skipFailedChapters,
  setSkipFailedChapters,
  concurrency,
  setConcurrency,
}: TranslationConfigPanelProps) {
  const safeStart = Math.max(1, Math.min(rangeStart, totalChapters));
  const safeEnd = Math.max(safeStart, Math.min(rangeEnd, totalChapters));

  return (
    <div className="space-y-4 bg-[#0f1524] border border-slate-800/80 p-5 rounded-2xl shadow-xl animate-fadeIn">
      <h3 className="text-xs font-extrabold text-slate-350 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/60 pb-3">
        <Sliders className="w-4 h-4 text-indigo-400" /> Tham số dịch tự động
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-450 text-slate-400 block">Chế độ dịch tự động</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAutoTranslateMode('resume')}
            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'resume' ? 'border-indigo-600/65 bg-indigo-950/40 text-indigo-300 font-extrabold shadow-md' : 'border-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800/30'}`}
          >
            <span className="text-[11px] flex items-center gap-1"><Play className="w-3 h-3 text-indigo-400 fill-indigo-400" /> Dịch tiếp tục</span>
            <span className="text-[9px] text-slate-500 font-normal mt-0.5">({totalUntranslatedChapters} chương)</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoTranslateMode('from_scratch')}
            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'from_scratch' ? 'border-indigo-600/65 bg-indigo-950/40 text-indigo-300 font-extrabold shadow-md' : 'border-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800/30'}`}
          >
            <span className="text-[11px] flex items-center gap-1"><RefreshCwIcon className="w-3 h-3 text-indigo-400" /> Dịch từ đầu</span>
            <span className="text-[9px] text-slate-500 font-normal mt-0.5">({totalChapters} chương)</span>
          </button>
        </div>
      </div>

      {/* Giới hạn phân đoạn vùng chương */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-indigo-400" /> Giới hạn phạm vi chương</span>
            <span className="text-[10px] text-slate-550 text-slate-500 font-normal mt-0.5">Dịch một phân khúc chương nhất định</span>
          </div>
          <button
            type="button"
            onClick={() => setRangeEnabled(!rangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-205 focus:outline-none ${rangeEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${rangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {rangeEnabled && (
          <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Từ số</label>
                <input
                  type="number"
                  min={1}
                  max={totalChapters}
                  value={rangeStart}
                  onChange={e => {
                    const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                    setRangeStart(v);
                    if (v > rangeEnd) setRangeEnd(v);
                  }}
                  className="w-full text-center text-sm font-extrabold border border-slate-800 rounded-lg bg-[#161f30] py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Đến số</label>
                <input
                  type="number"
                  min={rangeStart}
                  max={totalChapters}
                  value={rangeEnd}
                  onChange={e => setRangeEnd(Math.max(rangeStart, Math.min(totalChapters, Number(e.target.value))))}
                  className="w-full text-center text-sm font-extrabold border border-slate-800 rounded-lg bg-[#161f30] py-1.5 text-slate-105 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-lg px-3 py-2 text-[11px] text-indigo-300 flex items-center justify-between">
              <span>Hàng đợi phân phối:</span>
              <strong className="text-indigo-400 font-extrabold">{safeEnd - safeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs pt-1">
        <label className="font-bold text-slate-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-indigo-400" /> Lượt chuốt văn học:</label>
        <span className="bg-indigo-950/80 border border-indigo-850 border-indigo-800/40 text-indigo-300 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{polishCycles} vòng</span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setPolishCycles(n)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${polishCycles === n ? 'bg-indigo-650 border-indigo-650 text-white' : 'border-slate-800 bg-[#161f30] text-slate-400 hover:text-slate-200'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 pt-2.5 border-t border-slate-800/60">
        <div className="flex justify-between items-center text-xs">
          <div className="flex flex-col">
            <span className="font-bold text-slate-300 flex items-center gap-1">⚡ Dịch song song:</span>
            <span className="text-[10px] text-slate-500 font-normal mt-0.5">Số chương dịch cùng lúc (1 = tuần tự)</span>
          </div>
          <span className="bg-indigo-950/80 border border-indigo-805 border-indigo-800/40 text-indigo-300 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{concurrency} luồng</span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setConcurrency(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${concurrency === n ? 'bg-indigo-650 border-indigo-650 text-white' : 'border-slate-800 bg-[#161f30] text-slate-400 hover:text-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
        {concurrency > 1 && (
          <p className="text-[10px] text-amber-300 bg-amber-955/20 border border-amber-900/50 rounded px-2.5 py-2 leading-relaxed">
            ⚠️ Dịch song song đẩy nhanh tiến độ nhưng có thể làm giảm nhất quán của từ điển giữa các chương dịch song hành. Khuyên dùng 2-3 luồng.
          </p>
        )}
      </div>

      <div className="space-y-1.5 pt-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Yêu cầu bổ sung khi biên tập:</label>
        <input
          type="text"
          placeholder="Ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
          value={additionalInstructions}
          onChange={(e) => setAdditionalInstructions(e.target.value)}
          className="w-full text-xs bg-[#161f30] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 focus:bg-[#19243a] transition-all"
        />
      </div>

      <div className="pt-3 pb-1 flex items-center justify-between border-t border-slate-800/60 mt-2">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-slate-300">Tự động bỏ qua chương lỗi</span>
          <span className="text-[10px] text-slate-550 text-slate-500 font-normal">Bỏ qua chương lỗi và tiếp tục tiến trình</span>
        </div>
        <button
          type="button"
          onClick={() => setSkipFailedChapters(!skipFailedChapters)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${skipFailedChapters ? 'bg-indigo-600' : 'bg-slate-800'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${skipFailedChapters ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="pt-3 pb-1 flex items-center justify-between border-t border-slate-800/60 mt-1">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-slate-300">Rà soát từ mới khi dịch</span>
          <span className="text-[10px] text-slate-550 text-slate-500 font-normal">Tự động bóc tách từ vựng gối đầu</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExtractionDuringTranslationEnabled(!isExtractionDuringTranslationEnabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionDuringTranslationEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionDuringTranslationEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="space-y-2 pt-4 border-t border-slate-800/60">
        {isProcessing ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleToggleProcessing} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"><Pause className="w-3.5 h-3.5 fill-white" /> Tạm dừng</button>
            <button onClick={handleStopTranslation} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"><Square className="w-3.5 h-3.5 fill-white" /> Dừng &amp; Lưu</button>
          </div>
        ) : (
          <button onClick={handleToggleProcessing} className="w-full py-2.5 rounded-lg text-xs font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.01] transition-transform"><Play className="w-4 h-4 fill-white animate-pulse" /> Kích hoạt Dịch Tự Động sỉ</button>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={handleResetQueue} className="flex-1 py-1.5 rounded-lg border border-slate-750 text-slate-300 hover:bg-slate-800/40 cursor-pointer text-xs font-bold transition-colors">Reset hàng đợi</button>
          <button type="button" onClick={triggerExportDownload} className="flex-1 py-1.5 rounded-lg border border-slate-750 text-slate-300 hover:bg-slate-800/40 cursor-pointer text-xs font-bold flex items-center justify-center gap-1 transition-colors"><Download className="w-3.5 h-3.5" /> Sao lưu JSON</button>
        </div>
      </div>
    </div>
  );
});



// Helper component for Refresh icon
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
