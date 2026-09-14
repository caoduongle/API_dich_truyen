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
