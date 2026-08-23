import React from 'react';
import { Cpu } from 'lucide-react';

export interface TranslationQualitySectionProps {
  warningParagraphMismatch: boolean;
  setWarningParagraphMismatch: (b: boolean) => void;
  enableAiQaCritique: boolean;
  setEnableAiQaCritique: (b: boolean) => void;
  enableSegmentTranslation: boolean;
  setEnableSegmentTranslation: (b: boolean) => void;
}

export function TranslationQualitySection({
  warningParagraphMismatch,
  setWarningParagraphMismatch,
  enableAiQaCritique,
  setEnableAiQaCritique,
  enableSegmentTranslation,
  setEnableSegmentTranslation,
}: TranslationQualitySectionProps) {
  return (
    <div className="space-y-3 pt-3 border-t border-parchment-2">
      <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
        <Cpu className="w-3.5 h-3.5 text-polish" />
        Chất lượng &amp; Kiểm duyệt dịch thuật
      </label>

      {/* Mismatch Warning */}
      <div className="flex items-center justify-between py-1">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-text-main">Cảnh báo lệch đoạn (Phương án 1)</span>
          <span className="text-[10px] text-text-muted leading-relaxed">Hiện thông báo nếu số đoạn bản dịch khác bản gốc.</span>
        </div>
        <button
          type="button"
          onClick={() => setWarningParagraphMismatch(!warningParagraphMismatch)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${warningParagraphMismatch ? 'bg-polish' : 'bg-parchment-2'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${warningParagraphMismatch ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* AI Critique QA */}
      <div className="flex items-center justify-between py-1 border-t border-parchment-2 pt-2">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-text-main">AI tự động kiểm duyệt QA (Phương án 2)</span>
          <span className="text-[10px] text-text-muted leading-relaxed">Dùng AI rà soát lỗi bỏ sót/thêm thắt/lặp lại sau khi dịch.</span>
        </div>
        <button
          type="button"
          onClick={() => setEnableAiQaCritique(!enableAiQaCritique)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableAiQaCritique ? 'bg-polish' : 'bg-parchment-2'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableAiQaCritique ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Segment Translation */}
      <div className="flex items-center justify-between py-1 border-t border-parchment-2 pt-2">
        <div className="flex flex-col pr-2">
          <span className="text-xs font-bold text-text-main">Dịch phân đoạn nhỏ (Phương án 3)</span>
          <span className="text-[10px] text-text-muted leading-relaxed">Dịch riêng lẻ từng câu/đoạn để bảo đảm cấu trúc 1-1.</span>
        </div>
        <button
          type="button"
          onClick={() => setEnableSegmentTranslation(!enableSegmentTranslation)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enableSegmentTranslation ? 'bg-polish' : 'bg-parchment-2'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${enableSegmentTranslation ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  );
}
