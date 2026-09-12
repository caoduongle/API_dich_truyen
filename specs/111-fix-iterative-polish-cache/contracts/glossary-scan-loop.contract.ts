/**
 * Contract: Progressive Glossary Scan Loop
 * Location: specs/111-fix-iterative-polish-cache/contracts/glossary-scan-loop.contract.ts
 */

export interface AnalyzeGlossaryDirectOptions {
  text: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  sourceChapterId?: string;
  signal?: AbortSignal;
  /** Danh sách thuật ngữ đã tìm thấy từ các vòng trước cần loại trừ để tìm thuật ngữ mới */
  knownChineseTerms?: string[];
  /** Chỉ số vòng lặp quét hiện tại (1..N) */
  loopIndex?: number;
  /** Tổng số vòng lặp quét dự kiến */
  totalLoops?: number;
}

export interface AnalyzeGlossaryDirectOutput {
  suggestions: Array<{
    chinese: string;
    pinyin: string;
    vietnamese: string;
    type: string;
    note: string;
    needsReview?: boolean;
    sourceChapterId?: string;
  }>;
  successKeyIndex: number;
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
}
