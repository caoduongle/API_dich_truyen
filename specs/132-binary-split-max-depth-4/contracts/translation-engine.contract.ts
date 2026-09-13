/**
 * Contract: Translation Engine Binary Split & Isolated Sub-branch Recursion
 * Feature: 132-binary-split-max-depth-4
 */

export interface SplitRetryInfo {
  stage: 'raw' | 'polish';
  depth: number;
  partsCount: number;
  reason: string;
  tier: 'split' | 'sino-fallback';
}

export interface DirectRawTranslationParams {
  text: string;
  genre?: string;
  tone?: string;
  glossary?: any[];
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  onSplitRetry?: (info: SplitRetryInfo) => void;
  isRetry?: boolean;
}

export interface DirectRawTranslationResult {
  rawTranslation: string;
  discoveredEntities?: any[];
  successKeyIndex: number;
}

export interface DirectPolishTranslationParams {
  sourceText: string;
  rawTranslation: string;
  genre?: string;
  tone?: string;
  glossary?: any[];
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  isExtractionEnabled?: boolean;
  signal?: AbortSignal;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  onSplitRetry?: (info: SplitRetryInfo) => void;
}

export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities: any[];
  successKeyIndex: number;
  isPartial?: boolean;
}
