import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export interface QaCritiquePanelProps {
  isMismatch: boolean;
  sourceParaCount: number;
  translationParaCount: number;
  isCheckingQa: boolean;
  enableAiQaCritique: boolean;
  qaIssues: any[];
}

export function QaCritiquePanel({
  isMismatch,
  sourceParaCount,
  translationParaCount,
  isCheckingQa,
  enableAiQaCritique,
  qaIssues,
}: QaCritiquePanelProps) {
  return (
    <>
      {/* Mismatch Warning Alert */}
      {isMismatch && (
        <div className="bg-amber-950/20 border border-amber-800/40 text-amber-300 p-3.5 rounded-[2px] flex items-start gap-2.5 text-xs animate-slideDown">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-300">Cảnh báo lệch đoạn văn bản:</p>
            <p className="leading-relaxed text-text-main">
              Số lượng đoạn của bản dịch đang không khớp với văn bản gốc (Gốc: <strong>{sourceParaCount}</strong> đoạn, Dịch: <strong>{translationParaCount}</strong> đoạn). 
              Vui lòng kiểm tra lại để tránh lệch dòng khi hiển thị song ngữ.
            </p>
          </div>
        </div>
      )}

      {/* AI Critique QA status */}
      {isCheckingQa && (
        <div className="bg-draft/15 border border-draft/30 text-text-main p-3.5 rounded-[2px] flex items-center gap-2.5 text-xs animate-pulse">
          <Loader2 className="w-4 h-4 text-draft animate-spin shrink-0" />
          <span>Đang tiến hành kiểm duyệt AI (QA Critique Phase) đối soát bản dịch...</span>
        </div>
      )}

      {/* QA Issues Found */}
      {enableAiQaCritique && !isCheckingQa && qaIssues.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/40 text-rose-300 p-3.5 rounded-[2px] space-y-2 text-xs animate-slideDown shadow-sm">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>AI Phát Hiện Lỗi Kiểm Duyệt QA ({qaIssues.length})</span>
          </div>
          <ul className="space-y-1.5 list-disc pl-4 leading-relaxed text-text-main">
            {qaIssues.map((issue, idx) => (
              <li key={idx}>
                <strong className="text-rose-400 font-bold">[{issue.type.toUpperCase()}] ({issue.severity}):</strong> {issue.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
