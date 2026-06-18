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
}: TranslationConfigPanelProps) {
  const safeStart = Math.max(1, Math.min(rangeStart, totalChapters));
  const safeEnd = Math.max(safeStart, Math.min(rangeEnd, totalChapters));

  return (
    <div className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
        <Sliders className="w-4 h-4 text-indigo-600" /> Tham số dịch tự động
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 block">Chế độ dịch tự động:</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAutoTranslateMode('resume')}
            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'resume' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <span className="text-[11px] flex items-center gap-1"><Play className="w-3 h-3 text-indigo-600 fill-indigo-600" /> Tiếp tục dịch</span>
            <span className="text-[9px] text-slate-400 font-normal mt-0.5">({totalUntranslatedChapters} chương)</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoTranslateMode('from_scratch')}
            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'from_scratch' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <span className="text-[11px] flex items-center gap-1"><RefreshCwIcon className="w-3 h-3 text-indigo-600" /> Dịch từ đầu</span>
            <span className="text-[9px] text-slate-400 font-normal mt-0.5">({totalChapters} chương)</span>
          </button>
        </div>
      </div>

      {/* Giới hạn phân đoạn vùng chương */}
      <div className="space-y-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-indigo-500" /> Giới hạn phạm vi chương</span>
            <span className="text-[10px] text-slate-400 font-normal mt-0.5">Dịch từ số thứ tự X đến Y trong danh sách</span>
          </div>
          <button
            type="button"
            onClick={() => setRangeEnabled(!rangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${rangeEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
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
                  className="w-full text-center text-sm font-extrabold border border-slate-250 rounded-lg bg-slate-50 py-1.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
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
                  className="w-full text-center text-sm font-extrabold border border-slate-250 rounded-lg bg-slate-50 py-1.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
            <div className="bg-indigo-55 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-[11px] text-indigo-900 flex items-center justify-between">
              <span>Hàng đợi phân phối:</span>
              <strong className="text-indigo-700 font-extrabold">{safeEnd - safeStart + 1} chương</strong>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs pt-1">
        <label className="font-bold text-slate-700 flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-indigo-500" /> Lượt chuốt văn văn học:</label>
        <span className="bg-indigo-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{polishCycles} vòng</span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setPolishCycles(n)}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${polishCycles === n ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-250 bg-slate-50 text-slate-700 font-semibold'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 pt-2">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Yêu cầu bổ sung khi biên tập:</label>
        <input
          type="text"
          placeholder="Ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
          value={additionalInstructions}
          onChange={(e) => setAdditionalInstructions(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-250 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
        />
      </div>

      <div className="pt-3 pb-1 flex items-center justify-between border-t border-slate-100 mt-2">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-slate-700">Rà soát từ mới khi dịch</span>
          <span className="text-[10px] text-slate-400 font-normal">Tự động đẩy vào kho từ vựng gối đầu</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExtractionDuringTranslationEnabled(!isExtractionDuringTranslationEnabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionDuringTranslationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionDuringTranslationEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="space-y-2 pt-4 border-t border-slate-100">
        {isProcessing ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleToggleProcessing} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white"><Pause className="w-3.5 h-3.5 fill-white" /> Tạm dừng</button>
            <button onClick={handleStopTranslation} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"><Square className="w-3.5 h-3.5 fill-white" /> Dừng &amp; Lưu</button>
          </div>
        ) : (
          <button onClick={handleToggleProcessing} className="w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"><Play className="w-4 h-4 fill-white" /> Kích hoạt Dịch Tự Động sỉ</button>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={handleResetQueue} className="flex-1 py-1.5 rounded-lg border border-slate-205 text-slate-600 hover:bg-slate-50 cursor-pointer text-xs font-bold">Reset hàng đợi</button>
          <button type="button" onClick={triggerExportDownload} className="flex-1 py-1.5 rounded-lg border border-slate-205 text-slate-600 hover:bg-slate-50 cursor-pointer text-xs font-bold flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Lưu cấu trúc truyện</button>
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
