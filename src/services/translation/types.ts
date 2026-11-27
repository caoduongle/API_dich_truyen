/**
 * Shared Type Definitions for Translation Pipeline Modularization
 */

import { GlossaryItem, GlossaryType, QaIssueType } from '../../types';

export interface ContinuityContext {
  /** 1-2 đoạn văn tiếng Trung cuối cùng của phân đoạn hoặc chương liền trước (tối đa 350 ký tự) */
  previousSourceTail?: string;
  /** 1-2 đoạn văn tiếng Việt cuối cùng của phân đoạn hoặc chương liền trước (tối đa 500 ký tự) */
  previousTranslationTail?: string;
  /** Nhãn nguồn ngữ cảnh để ghi log/debug */
  sourceKind?: 'previous-chunk' | 'previous-chapter';
}

export interface PolishFidelityReport {
  isAcceptable: boolean;
  previousGlossaryViolations: number;
  candidateGlossaryViolations: number;
  ungroundedProperNouns: string[];
  paragraphCountDelta: number;
  rejectionReason?: string;
  previousStructurePenalty?: number;
  candidateStructurePenalty?: number;
  structureDiscrepancyCount?: number;
}

export interface ParagraphMergeReversion {
  paragraphIndex: number;
  reasons: string[];
}

export interface PolishParagraphMergeResult extends PolishFidelityReport {
  mergedPolishedText: string;
  acceptedParagraphCount: number;
  revertedParagraphs: ParagraphMergeReversion[];
  isCatastrophicRollback: boolean;
}

export interface QualityEvaluationMetrics {
  sampleId: string;
  glossaryComplianceRate: number;
  falseSubstitutionCount: number;
  chineseLeftoverRatio: number;
  paragraphParityPassed: boolean;
  pronounConsistencyRate: number;
  ungroundedProperNounCount: number;
  promptGlossaryCharCount: number;
}

export interface DiscoveredEntity {
  chinese: string;
  pinyin: string;
  vietnamese: string;
  type: GlossaryType;
  note: string;
  needsReview?: boolean;
}

export interface TranslationChunk {
  chunkIndex: number;
  totalChunks: number;
  sourceText: string;
  rawText: string;
  sourceParagraphRange: {
    start: number;
    end: number;
  };
  rawParagraphRange: {
    start: number;
    end: number;
  };
  estimatedTokens: number;
}

export interface BilingualSplitOptions {
  sourceText: string;
  rawText: string;
  targetParts?: number;
  /**
   * Ngưỡng token ước tính tối đa cho mỗi chunk (accumulative target packing heuristic).
   * LƯU Ý: Đây là heuristic đóng gói lũy kế mềm (soft target packing budget) nhằm giữ chunk ở quy mô hợp lý
   * mà KHÔNG cắt gãy giữa chừng đoạn văn (paragraph integrity).
   * Nếu một đoạn văn đơn lẻ vượt quá ngưỡng này, toàn bộ đoạn văn vẫn được giữ nguyên vẹn
   * và không bị chia cắt làm hỏng cấu trúc câu/nghĩa.
   */
  maxTokensPerChunk?: number;
}

export interface IBilingualSplitter {
  splitBilingualAdaptively(options: BilingualSplitOptions): TranslationChunk[];
  splitBilingualAdaptively(sourceText: string, rawText: string, targetParts?: number): TranslationChunk[];
  mapWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]>;
}

export interface SplitRetryEventInfo {
  stage: 'raw' | 'polish';
  depth: number;
  partsCount: number;
  reason: string;
  tier?: 'split' | 'line-by-line' | 'sino-fallback';
}

export type TranslationOutcomeType = 'SUCCESS' | 'PARTIAL' | 'RETRYABLE' | 'TERMINAL';

export interface SplitBranchTelemetry {
  totalSplits: number;
  retriedBranches: number;
  fallbackBranches: number;
  failedBranchKeys: string[];
  executionDurationMs: number;
  outcome: 'SUCCESS' | 'PARTIAL';
}

export interface MonotonicTextPartition {
  index: number;
  totalPartitions: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedTokens: number;
}

export interface SourceCoverageReport {
  isComplete: boolean;
  originalLength: number;
  concatenatedLength: number;
  isExactMatch: boolean;
  droppedCharsCount: number;
}

export interface DirectRawTranslationParams {
  text: string;
  rawSourceText?: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  useParagraphAnchors?: boolean;
  signal?: AbortSignal;
  continuity?: ContinuityContext;
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
  isRetry?: boolean;
  maxDepth?: number;
  concurrencyLimit?: number;
  cumulativeTimeoutMs?: number;
}

export interface DirectRawTranslationResult {
  rawTranslation: string;
  discoveredEntities: DiscoveredEntity[];
  successKeyIndex: number;
  isPartial?: boolean;
  telemetry?: SplitBranchTelemetry;
}

export interface DirectPolishTranslationParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  isExtractionEnabled?: boolean;
  enableSegmentTranslation?: boolean;
  useParagraphAnchors?: boolean;
  complianceIssuesToFix?: DirectQaCritiqueIssue[];
  signal?: AbortSignal;
  isRetry?: boolean;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  continuity?: ContinuityContext;
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
  maxDepth?: number;
  concurrencyLimit?: number;
  cumulativeTimeoutMs?: number;
}

export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities?: DiscoveredEntity[];
  successKeyIndex: number;
  isPartial?: boolean;
  telemetry?: SplitBranchTelemetry;
}

export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface DirectQaCritiqueIssue {
  type: QaIssueType;
  severity: 'critical' | 'warning' | 'info';
  targetText: string;
  description: string;
  paragraphIndex?: number;
  source?: 'deterministic' | 'ai_critique';
  expectedTerm?: { chinese: string; vietnamese: string };
  repaired?: boolean;
}

export interface DirectQaCritiqueResult {
  isValid: boolean;
  issues: DirectQaCritiqueIssue[];
  successKeyIndex: number;
}
