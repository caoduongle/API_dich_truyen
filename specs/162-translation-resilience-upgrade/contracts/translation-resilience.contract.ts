/**
 * Contract: Translation Resilience & Adaptive Split Pipeline
 * File: specs/162-translation-resilience-upgrade/contracts/translation-resilience.contract.ts
 */

import { GlossaryItem, GlossaryType } from '../../../src/types';

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
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  maxDepth?: number;
  concurrencyLimit?: number;
  cumulativeTimeoutMs?: number;
  onSplitRetry?: (info: {
    stage: 'raw' | 'polish';
    depth: number;
    partsCount: number;
    reason: string;
    tier?: 'split' | 'line-by-line' | 'sino-fallback';
  }) => void;
  isRetry?: boolean;
}

export interface DirectRawTranslationResult {
  rawTranslation: string;
  discoveredEntities: Array<{
    chinese: string;
    pinyin: string;
    vietnamese: string;
    type: GlossaryType;
    note: string;
    needsReview?: boolean;
  }>;
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
  signal?: AbortSignal;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  maxDepth?: number;
  concurrencyLimit?: number;
  cumulativeTimeoutMs?: number;
  onSplitRetry?: (info: {
    stage: 'raw' | 'polish';
    depth: number;
    partsCount: number;
    reason: string;
    tier?: 'split' | 'line-by-line' | 'sino-fallback';
  }) => void;
}

export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities?: Array<{
    chinese: string;
    pinyin: string;
    vietnamese: string;
    type: GlossaryType;
    note: string;
    needsReview?: boolean;
  }>;
  successKeyIndex: number;
  isPartial?: boolean;
  telemetry?: SplitBranchTelemetry;
}
