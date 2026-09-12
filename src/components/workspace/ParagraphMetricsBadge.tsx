import React from 'react';
import { countParagraphs } from '../../lib/text';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ParagraphMetricsBadgeProps {
  text?: string;
  referenceText?: string;
  label?: string;
  className?: string;
  showWarning?: boolean;
}

export const ParagraphMetricsBadge: React.FC<ParagraphMetricsBadgeProps> = ({
  text = '',
  referenceText,
  label,
  className = '',
  showWarning = true,
}) => {
  const clean = (text || '').trim();
  const charCount = clean.length;
  const paraCount = countParagraphs(clean);

  let warningMessage: string | null = null;
  let isSevereDivergence = false;

  if (referenceText && showWarning && clean.length > 0) {
    const cleanRef = referenceText.trim();
    const refCharCount = cleanRef.length;
    const refParaCount = countParagraphs(cleanRef);

    if (refCharCount >= 300 && charCount < refCharCount * 0.8) {
      const dropPct = Math.round((1 - charCount / refCharCount) * 100);
      warningMessage = `Hụt ${dropPct}% ký tự so với bản thô (có dấu hiệu bị cắt cụt)`;
      isSevereDivergence = true;
    } else if (refParaCount >= 5) {
      const diff = Math.abs(paraCount - refParaCount);
      const ratio = diff / refParaCount;
      if (ratio > 0.15) {
        warningMessage = `Lệch ${diff} đoạn (${Math.round(ratio * 100)}%) so với bản gốc/bản thô`;
        isSevereDivergence = ratio > 0.25;
      }
    }
  }

  if (charCount === 0) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-mono ${className}`}>
      <span className="text-text-muted bg-parchment px-1.5 py-0.5 rounded-[2px] border border-parchment-2">
        {label ? `${label}: ` : ''}
        <strong className="text-text-main font-bold">{paraCount}</strong> đoạn •{' '}
        <strong className="text-text-main font-bold">{charCount.toLocaleString()}</strong> ký tự
      </span>

      {warningMessage && (
        <span
          title={warningMessage}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] font-sans font-semibold text-[10px] ${
            isSevereDivergence
              ? 'bg-rose-950/20 text-rose-400 border border-rose-800/40'
              : 'bg-amber-950/20 text-amber-300 border border-amber-800/40'
          }`}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{warningMessage}</span>
        </span>
      )}
    </div>
  );
};
