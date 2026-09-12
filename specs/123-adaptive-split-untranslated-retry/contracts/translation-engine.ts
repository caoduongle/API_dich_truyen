/**
 * Contract: Direct Translation Engine Adaptive Split Retry Interface
 * Feature: 123-adaptive-split-untranslated-retry
 */

import type { GlossaryItem } from '../../../src/types';

export interface SplitRetryEventInfo {
  stage: 'raw' | 'polish';
  depth: number;
  partsCount: number;
  reason: string;
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

/**
 * Predicate kiểm tra xem lỗi có thuộc diện có thể tự động cứu nguy phân đoạn (Adaptive Split Retry) hay không.
 * Bao gồm:
 * - Sót chữ Hán chưa dịch (UNTRANSLATED_CHINESE_LEFTOVER)
 * - Phản hồi rỗng / kết quả trả về trống
 * - Vi phạm bộ lọc an toàn AI (SAFETY)
 */
export type IsAdaptiveSplitRetryableErrorFn = (err: any) => boolean;

/**
 * Giai đoạn 1: Dịch thô trực tiếp có cơ chế đệ quy cứu nguy phân đoạn
 */
export type TranslateRawDirectFn = (
  params: DirectRawTranslationParams
) => Promise<DirectRawTranslationResult>;

/**
 * Giai đoạn 2: Chuốt văn phong trực tiếp có cơ chế đệ quy cứu nguy phân đoạn
 */
export type PolishTranslationDirectFn = (
  params: DirectPolishTranslationParams
) => Promise<DirectPolishTranslationResult>;
