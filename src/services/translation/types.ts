/**
 * Shared Type Definitions for Translation Pipeline Modularization
 */

import { GlossaryItem } from '../../types';

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

export interface DirectRawTranslationParams {
  text: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
  isRetry?: boolean;
}

export interface DirectRawTranslationResult {
  rawTranslation: string;
  discoveredEntities: any[];
  successKeyIndex: number;
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
  signal?: AbortSignal;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
}

export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities?: any[];
  successKeyIndex: number;
  isPartial?: boolean;
}

export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: any[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface DirectQaCritiqueIssue {
  type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
  severity: 'critical' | 'warning' | 'info';
  targetText: string;
  description: string;
}

export interface DirectQaCritiqueResult {
  isValid: boolean;
  issues: DirectQaCritiqueIssue[];
  successKeyIndex: number;
}
