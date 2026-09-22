# Internal Contracts: AI Pipeline Strict Validation and Structural Integrity

**Feature**: `157-ai-pipeline-strict-validation`  
**Date**: 2026-09-22  
**Status**: Completed  

## 1. QA Critique Service Contracts

### `isQaCritiqueResponse`
```ts
/**
 * Type guard for AI QA Critique responses.
 * Strict contract: Requires BOTH boolean isValid and array issues.
 * Empty objects or payloads missing either property return false.
 */
export function isQaCritiqueResponse(data: unknown): data is QaCritiqueResponse;
```

### `isQaCritiqueIssue`
```ts
/**
 * Item validator for individual QA critique issues.
 * Requires:
 * - non-empty description
 * - string targetText (empty allowed for omissions)
 * - recognized type and severity enums
 */
export function isQaCritiqueIssue(item: unknown): item is QaCritiqueIssue;
```

### `qaCritiqueDirect`
```ts
export interface DirectQaCritiqueResult {
  isValid: boolean;
  issues: Array<{
    type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
    severity: 'critical' | 'warning' | 'info';
    targetText: string;
    description: string;
  }>;
  successKeyIndex: number;
}
```
**Contract Behavior**:
1. Invokes Gemini direct call with Phase 3 schema.
2. Parses structured response with `isQaCritiqueResponse`.
3. If response parses as schema-invalid, applies safe fallback `{ isValid: true, issues: [] }`.
4. Filters `rawIssues` using `isQaCritiqueIssue`: all non-conforming items dropped.
5. Returns sanitized `DirectQaCritiqueResult`.

---

## 2. Discovered Entity Validator Contract

### `validateDiscoveredEntity`
```ts
/**
 * Validates and normalizes discovered glossary entities according to Option A.
 * - Requires non-empty string `chinese`.
 * - Rejects entity (returns null) if `vietnamese`, `pinyin`, or `note` is present with non-string type.
 * - Defaults omitted optional strings to `""`.
 */
export function validateDiscoveredEntity(item: unknown): DiscoveredEntity | null;
```

---

## 3. Cumulative Deadline Transport Contract

### `callGeminiDirect` & `geminiClient`
```ts
export interface GeminiRequestOptions {
  apiKeys: string[];
  model: string;
  prompt: string;
  systemInstruction?: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  startKeyIndex?: number;
  signal?: AbortSignal;
  timeoutMs?: number; // Logical deadline, default 60_000ms
}
```
**Contract Behavior**:
1. Logical request deadline initialized to `options.timeoutMs ?? 60_000`.
2. Each key attempt computes `remainingMs = overallDeadlineMs - elapsedMs`.
3. If `remainingMs <= 50`: Request throws `TimeoutError` without initiating fetch.
4. Attempt timeout is `Math.min(remainingMs, 60_000)` with NO artificial floor.
5. Overall request strictly guarantees execution finishes within `overallDeadlineMs`.

---

## 4. Secondary Structured Parser Contracts

### `generateQuickTermDetailsDirect`
```ts
/**
 * Generates quick term details with runtime schema validation.
 */
export async function generateQuickTermDetailsDirect(
  options: GenerateQuickTermOptions
): Promise<QuickTermResult>;
```

### `extractGlossaryDirect` & `analyzeGuidelinesDirect`
```ts
/**
 * Direct glossary analysis and chapter alignment with runtime schema checks.
 */
export async function extractGlossaryDirect(
  params: ExtractGlossaryDirectParams
): Promise<ExtractGlossaryDirectResult>;

export async function alignChapterDirect(
  params: AlignChapterDirectParams
): Promise<AlignChapterDirectResult>;
```

### `runAiQualityScan` (Hako Quality Engine)
```ts
/**
 * Scans chapters for quality issues using structured parsing with array validation.
 */
export async function runAiQualityScan(
  options: HakoScanOptions
): Promise<HakoScanResult>;
```
