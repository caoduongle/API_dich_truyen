/**
 * Translation Stage Structured Payloads Contract
 */

export interface RawTranslationResponse {
  rawTranslation?: string;
  translation?: string;
  vietnamese?: string;
  discoveredEntities?: unknown[];
  [key: string]: unknown;
}

export function isRawTranslationResponse(data: unknown): data is RawTranslationResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const hasValidTranslation =
    (obj.rawTranslation === undefined || typeof obj.rawTranslation === 'string') &&
    (obj.translation === undefined || typeof obj.translation === 'string') &&
    (obj.vietnamese === undefined || typeof obj.vietnamese === 'string');
  const hasValidEntities =
    obj.discoveredEntities === undefined || Array.isArray(obj.discoveredEntities);
  return hasValidTranslation && hasValidEntities;
}

export interface PolishTranslationResponse {
  polishedTranslation?: string;
  translation?: string;
  vietnamese?: string;
  discoveredEntities?: unknown[];
  [key: string]: unknown;
}

export function isPolishTranslationResponse(data: unknown): data is PolishTranslationResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const hasValidTranslation =
    (obj.polishedTranslation === undefined || typeof obj.polishedTranslation === 'string') &&
    (obj.translation === undefined || typeof obj.translation === 'string') &&
    (obj.vietnamese === undefined || typeof obj.vietnamese === 'string');
  const hasValidEntities =
    obj.discoveredEntities === undefined || Array.isArray(obj.discoveredEntities);
  return hasValidTranslation && hasValidEntities;
}

export interface QaCritiqueResponse {
  isValid?: boolean;
  issues?: unknown[];
  [key: string]: unknown;
}

export function isQaCritiqueResponse(data: unknown): data is QaCritiqueResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const hasValidIssues = obj.issues === undefined || Array.isArray(obj.issues);
  const hasValidFlag = obj.isValid === undefined || typeof obj.isValid === 'boolean';
  return hasValidIssues && hasValidFlag;
}

export interface SentenceRewriteResponse {
  rewrittenSentence: string;
}

export function isSentenceRewriteResponse(data: unknown): data is SentenceRewriteResponse {
  return typeof data === 'object' && data !== null && typeof (data as any).rewrittenSentence === 'string';
}
