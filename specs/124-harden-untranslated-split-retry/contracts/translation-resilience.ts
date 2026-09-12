/**
 * Contract: Enhanced Split Retry Resilience & Multi-tier Fallback
 * Feature: 124-harden-untranslated-split-retry
 */

import type { GlossaryItem } from '../../../src/types';

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
