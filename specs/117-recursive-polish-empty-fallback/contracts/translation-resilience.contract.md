# Contract: Translation Resilience & Recursive Polish

## Module: `src/services/directTranslationEngine.ts`

### `polishTranslationDirect`

```typescript
export async function polishTranslationDirect(
  params: DirectPolishTranslationParams
): Promise<DirectPolishTranslationResult>;
```

#### Pre-conditions
- `sourceText` and `rawTranslation` must be non-empty strings.
- `apiKeys` must contain at least one non-empty string.
- `roundIndex` is 1-indexed (1, 2, 3, ...).

#### Behavior
1. Calls the direct Gemini API via `callGeminiDirect`.
2. If `callGeminiDirect` throws an error matching `isSafetyOrEmptyErrorDirect`:
   - If `depth < 2` and text is split-able: splits `sourceText` and `rawTranslation` into 2 adaptive parts and executes `polishWithContentSplitDirect` recursively with `depth + 1`.
   - If `depth >= 2` or text cannot be split: falls back to returning the provided `rawTranslation` with `isPartial: true`.
3. Returns `DirectPolishTranslationResult` with combined text, discovered entities, and `successKeyIndex`.

---

## Module: `src/services/chapterTranslationService.ts`

### `executeSingleChapterTranslation`

```typescript
export async function executeSingleChapterTranslation(
  params: ExecuteSingleChapterTranslationParams
): Promise<SingleChapterResult>;
```

#### Multi-Round Polishing Error Recovery Contract
1. For round $j$ in $1 \dots \text{polishCycles}$:
   - If round $j$ succeeds: update `currentTextToPolish = polishData.polishedTranslation`, check convergence.
   - If round $j$ throws a quota/rate-limit error (`isOverload`): throw error immediately to pause queue.
   - If round $j$ throws an empty response / safety error that could not be resolved by internal divide & conquer:
     - If $j > 1$: Log warning, retain `currentTextToPolish` from round $j - 1$, and break polish loop.
     - If $j = 1$: Log warning, retain `firstDraft` (Phase 1 raw translation), and break polish loop.
2. The chapter transitions to Phase 3 (QA Critique) and is saved with `status: 'completed'`.
