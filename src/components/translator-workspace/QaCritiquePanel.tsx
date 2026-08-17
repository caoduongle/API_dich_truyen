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
        <div className="bg-amber-950/20 border border-amber-900/45 text-amber-300 p-3.5 rounded-xl flex items-start gap-2.5 text-xs animate-slideDown">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-400">Cảnh báo lệch đoạn văn bản:</p>
            <p className="leading-relaxed text-slate-300">
              Số lượng đoạn của bản dịch đang không khớp với văn bản gốc (Gốc: <strong>{sourceParaCount}</strong> đoạn, Dịch: <strong>{translationParaCount}</strong> đoạn). 
              Vui lòng kiểm tra lại để tránh lệch dòng khi hiển thị song ngữ.
            </p>
          </div>
        </div>
      )}

      {/* AI Critique QA status */}
      {isCheckingQa && (
        <div className="bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 p-3.5 rounded-xl flex items-center gap-2.5 text-xs animate-pulse">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          <span>Đang tiến hành kiểm duyệt AI (QA Critique Phase) đối soát bản dịch...</span>
        </div>
      )}

      {/* QA Issues Found */}
      {enableAiQaCritique && !isCheckingQa && qaIssues.length > 0 && (
        <div className="bg-[#1c0e12]/80 border border-rose-900/45 text-rose-300 p-3.5 rounded-xl space-y-2 text-xs animate-slideDown shadow-lg">
          <div className="flex items-center gap-1.5 font-extrabold text-rose-400">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>AI Phát Hiện Lỗi Kiểm Duyệt QA ({qaIssues.length})</span>
          </div>
          <ul className="space-y-1.5 list-disc pl-4 leading-relaxed text-slate-300">
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
