# Quickstart & Verification Guide: Translation Resilience Upgrade

**Feature**: [Translation Resilience Upgrade (Spec 162)](./spec.md)  
**Branch**: `162-translation-resilience-upgrade`  
**Date**: 2026-09-26  

---

## 1. Prerequisites & Environment

1. Repository root: `e:\tailieuhoctap\laptrinhnangcao\th\merged`
2. Dependencies installed: `npm install` / `npm ci`
3. Types check: `npm run lint` (`tsc --noEmit`)
4. Test runner: `vitest run`

---

## 2. Verification Scenarios

### Scenario 1: Permissive Safety Settings Injection
**Objective**: Prove that `geminiRequestBuilder.ts` attaches `safetySettings` with `BLOCK_NONE` on all 4 harm categories.
- **Run Command**:
  ```bash
  npx vitest run src/services/gemini/__tests__/geminiRequestBuilder.test.ts
  ```
- **Expected Outcome**:
  - `buildPayload` output contains `safetySettings` array with length 4.
  - Categories: `HARASSMENT`, `HATE_SPEECH`, `SEXUALLY_EXPLICIT`, `DANGEROUS_CONTENT`.
  - All thresholds: `BLOCK_NONE`.

### Scenario 2: 100% Monotonic Source Coverage & Protected Span Preservation
**Objective**: Prove that text partitioning never drops characters, handles single/double newlines, and does not cut across `[...]` protected entities.
- **Run Command**:
  ```bash
  npx vitest run src/services/translation/__tests__/bilingualSplit.test.ts src/lib/__tests__/text.test.ts
  ```
- **Expected Outcome**:
  - Concatenation of partitions exactly equals the source text length and characters.
  - Zero dropped characters; zero bracket mutilation.

### Scenario 3: Isolated Fault-Branch Recursion on CONTENT_BLOCKED
**Objective**: Prove that when chunk 1 succeeds and chunk 2 triggers `CONTENT_BLOCKED`:
1. Chunk 1 is translated once and never re-executed.
2. Chunk 2 splits or falls back to `fallbackSinoVietnameseLine` without rotating API keys.
3. Final output preserves both chunks and returns `isPartial: true`.
- **Run Command**:
  ```bash
  npx vitest run src/services/__tests__/directTranslationEngine.test.ts -t "CONTENT_BLOCKED"
  ```
- **Expected Outcome**:
  - API call count on Key 1 matches expected chunk count.
  - Zero calls made to Key 2 or Key 3.
  - Final translation contains translated chunk 1 + rescued chunk 2.

### Scenario 4: Bounded Concurrency & Abort Signal
**Objective**: Prove that multi-part splits run with max 2 concurrent workers and halt immediately upon abort.
- **Run Command**:
  ```bash
  npx vitest run src/lib/__tests__/concurrency.test.ts
  ```
- **Expected Outcome**:
  - Concurrency watermark $\le 2$.
  - Abort triggers instant task cancellation with `AbortError`.

---

## 3. Full Quality Gate Validation

Execute all three project quality gates sequentially:

```bash
npm run lint
npm test
npm run build
```

**Passing Criteria**:
- `npm run lint`: 0 errors, 0 warnings.
- `npm test`: All tests pass cleanly. Zero tests skipped, muted, or deleted.
- `npm run build`: Vite bundle generates successfully into `dist/`.
