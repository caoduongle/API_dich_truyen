# Research & Technical Decisions: Translation Resilience Upgrade

**Feature**: [Translation Resilience Upgrade (Spec 162)](./spec.md)  
**Branch**: `162-translation-resilience-upgrade`  
**Date**: 2026-09-26  

---

## Research Question 1: Structured Outcome Classification vs String Matching

### Context
`translationValidation.ts` currently determines if an error is retryable via `isAdaptiveSplitRetryableError(err)` by checking substrings: `msg.includes('bộ lọc an toàn')`, `msg.includes('SAFETY')`, `msg.includes('UNTRANSLATED_CHINESE_LEFTOVER')`, `msg.includes('POLISH_TRUNCATION_DETECTED')`, etc. This breaks when upstream changes error messages or when structured `GeminiRequestError` instances are thrown.

### Decision
Define a strongly-typed `TranslationOutcomeType` enum and evaluation helper `classifyTranslationError(err: unknown): ClassifiedTranslationOutcome`.
```typescript
export type TranslationOutcomeType = 
  | 'SUCCESS'     // Hoàn tất 100% qua AI mà không cần fallback
  | 'PARTIAL'     // Hoàn tất nhưng có ít nhất 1 nhánh chuyển sang cứu nguy lossless
  | 'RETRYABLE'   // Lỗi tạm thời (503, 429, Network timeout) có thể retry
  | 'TERMINAL';   // Lỗi vĩnh viễn (Auth 401/403, Bad Request 400, Abort, hoặc CONTENT_BLOCKED ở nút lá)
```
The helper inspects:
1. `err instanceof GeminiRequestError` $\rightarrow$ inspects `err.code` and `err.category`.
2. Validation error types (e.g. `UntranslatedChineseError`, `PolishTruncationError`, `ParagraphParityError`) via custom error class or structured code property.
3. Fallback to message regex only for untyped third-party errors.

### Rationale
- Eliminates fragile text matching that breaks across localization or Gemini SDK updates.
- Distinguishes clearly between transient errors (which can be retried across keys or with backoff) and deterministic content errors (which must NOT rotate keys).
- Enables precise tracking of branch outcomes for telemetry.
- **Architectural Boundary**: `classifyGeminiError(httpStatus, responseBody, rawError)` in `geminiErrorClassifier.ts` operates strictly at the transport layer to construct and throw `GeminiRequestError`. The translation layer helper `classifyTranslationError(err)` consumes `GeminiRequestError` instances (inspecting `.category`, `.code`, `.isRetryable`) directly and does NOT invoke `classifyGeminiError()`.

### Alternatives Considered
- *Keep string matching with more keywords*: Rejected because message formats change across model versions (e.g., Gemini 2.0 Flash vs 2.5 vs 1.5 Pro) and language headers.
- *Throw HTTP codes only*: Rejected because translation validation errors (e.g., untranslated Chinese left in raw output, paragraph structure divergence) are domain-level semantic errors, not HTTP network status codes.

---

## Research Question 2: Permissive Safety Configuration for Literary Fiction

### Context
`geminiRequestBuilder.ts` does not inject `safetySettings` in request payloads. Gemini defaults to standard thresholds, resulting in high false-positive block rates on action, martial arts, and cultivation web novels (e.g. scenes with sword fights, injuries, battles).

### Decision
Implement `getPermissiveSafetySettings()` in `geminiRequestBuilder.ts` and inject into `buildPayload`:
```typescript
export function getPermissiveSafetySettings(): GeminiSafetySetting[] {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];
}
```
Allow per-request override if caller supplies custom `safetySettings`.

### Rationale
- Official Google Gemini API feature explicitly designed for creative writing, fiction, and gaming contexts to avoid false-positive moderation.
- Fully compliant with provider terms of service; does not use jailbreaks, adversarial prompting, or reframing.
- Drastically reduces unnecessary recursive splits triggered by false-positive blocks.

### Alternatives Considered
- *Prompt reframing / jailbreak tricks ("You are an actor...", "This is purely hypothetical...")*: **STRICTLY REJECTED** per architectural constraints and project directives. Reframing violates provider safety boundaries and degrades translation fidelity.
- *Calling Gemini via different system prompts on retry*: Rejected for safety blocks; if official `BLOCK_NONE` still blocks the content, the content is deemed genuinely prohibited by the provider and must be handled via deterministic lossless fallback.

---

## Research Question 3: Deterministic Handling of CONTENT_BLOCKED

### Context
When Gemini flags content as `CONTENT_BLOCKED`, rotating keys burns other API keys pointlessly because content moderation is deterministic per prompt. Retrying the identical prompt on the same key also wastes quota.

### Decision
1. In `geminiClient.ts`: Already halts without key rotation (Spec 160).
2. In `rawTranslation.ts` & `polishTranslation.ts`:
   - If an error is `CONTENT_BLOCKED`, verify if `depth < maxDepth`.
   - If `depth < maxDepth`: Split the text block into smaller sub-segments ($K=2$). A sub-segment that does *not* contain the trigger phrase will succeed.
   - For the sub-segment that *does* contain the trigger phrase: If it fails again and cannot be split further (length $\le 1$ sentence or `depth >= maxDepth`), immediately execute **lossless fallback**:
     - Raw: `fallbackSinoVietnameseLine(leafText, glossary)`
     - Polish: Preserve `leafRawText`
   - Mark `isPartial: true`.
   - **NEVER** rotate keys on that branch; **NEVER** re-send the exact same prompt with the exact same range.

### Rationale
- Isolate the toxic/triggering phrase to the smallest possible sub-unit (often a single sentence or clause) while translating 95%+ of the chapter with AI.
- Zero extra API calls once a leaf is isolated.
- Zero key exhaustion across configured keys.

### Alternatives Considered
- *Drop the blocked paragraph*: Rejected. Dropping text violates the 100% Source Coverage Invariant and corrupts novel continuity.
- *Abort the entire chapter*: Rejected. Wastes all successful work done on prior paragraphs.

---

## Research Question 4: Monotonic Boundary Selection & 100% Source Coverage

### Context
Existing `splitTextAdaptively` and `splitBilingualAdaptively` use `text.substring().trim()`. Trimming borders causes loss of leading/trailing indentation, newline characters, or boundary markers. Furthermore, `bilingualSplit.ts` can produce overlapping or inverted paragraph ranges if integer rounding is unconstrained.

### Decision
1. **Monotonic Non-Overlapping Partition Model**:
   A text partition of string $S$ with length $N$ is defined by strictly increasing integer cut points $0 = c_0 < c_1 < c_2 < \dots < c_k = N$.
   Each chunk $i$ is $S[c_i \dots c_{i+1})$.
   Concatenation $\sum_{i=0}^{k-1} \text{chunk}_i \equiv S$ unconditionally holds ($100\%$ character-exact coverage).
2. **Boundary Hierarchy**:
   - Level 1: Scene breaks (`\n\n***\n\n`, `\n\n---\n\n`)
   - Level 2: Paragraph breaks (`\n{2,}`)
   - Level 3: Line breaks (`\n`)
   - Level 4: Chinese / Vietnamese sentence terminators (`。`, `！`, `？`, `……`, `.`, `!`, `?`)
   - Level 5: Clause punctuation (`,`, `，`, `;`, `；`)
3. **Protected Entity Guard**:
   Check if candidate cut index $c$ falls inside an open protected span `[...]` or placeholder `__GLOSSARY_x__`. If yes, back up $c$ to immediately before the opening bracket.

### Rationale
- Guarantees mathematical invariance: no character or whitespace is dropped between chunks.
- Prevents cutting named entities, character names, or locked glossary terms in half.

### Alternatives Considered
- *Word boundary tokenization via Intl.Segmenter*: Good for languages with spaces, but Chinese has no spaces between words. Punctuation hierarchy is much more reliable and aligns with literary sentence structure.

---

## Research Question 5: Bounded Concurrency across Recursive Split Branches

### Context
`rawTranslation.ts` processes chunks sequentially in a loop:
```ts
for (let i = 0; i < chunks.length; i++) {
  const res = await rawWithContentSplitDirect(...);
}
```
If a chapter pre-splits into 4 chunks, processing sequentially takes $4 \times T_{\text{req}}$.
Conversely, `Promise.all` would fire all chunks simultaneously, causing RPM bursts and rate limit 429 errors.

### Decision
Standardize on `mapWithConcurrencyLimit` (from `src/lib/concurrency.ts`) with `concurrencyLimit = 2` for both Phase 1 (`rawTranslation.ts`) and Phase 2 (`polishTranslation.ts`).
Each worker processes a branch independently. When a branch encounters a split, its sub-chunks are processed with the same bounded worker limit.

### Rationale
- Balances throughput (2x speedup over sequential) while respecting the 60s sliding window RPM limits tracked by `localQuotaTracker`.
- Reuses existing utility `src/lib/concurrency.ts` without new dependencies.

### Alternatives Considered
- *Dynamic concurrency based on key count*: Could spawn too many concurrent calls when user has 5+ keys, triggering browser HTTP connection limits and confusing the rate limiter. Concurrency of 2 is the tested stable sweet spot for client-side Gemini requests.

---

## Research Question 6: Cumulative Operation Timeout & Cooperative Cancellation

### Context
While `geminiClient.ts` has a 60s timeout for a single logical request, a recursive split tree with 4-8 sub-calls could take $8 \times 30s = 240s$. If the user navigates away or cancels, background tasks keep burning quota unless cancelled.

### Decision
1. Introduce `cumulativeTimeoutMs` (default: 120_000ms = 2 minutes) passed in translation options.
2. Track `deadline = Date.now() + cumulativeTimeoutMs`.
3. Before dispatching any chunk or recursive sub-call:
   ```ts
   if (signal?.aborted) throw new AbortError('Tác vụ dịch đã bị hủy bởi người dùng.');
   const remainingMs = deadline - Date.now();
   if (remainingMs <= 1000) {
     // Exceeded cumulative deadline: fallback immediately
     return executeLosslessFallback(chunk);
   }
   ```
4. Pass `timeoutMs: Math.min(remainingMs, 60_000)` into `callGeminiDirect()`.

### Rationale
- Prevents infinite recursion or runaway latency.
- Guarantees prompt response to `AbortSignal`.
- Ensures user always receives a combined result before tab freeze or timeout.

---

## Research Question 7: Telemetry & Result Contract Extension

### Context
Downstream consumers (e.g. `useTranslationProcess.ts`, UI badges) need to know if a translation was 100% AI-generated or partially rescued via fallback, how many splits occurred, and whether any branch timed out or was blocked.

### Decision
Extend `DirectRawTranslationResult` and `DirectPolishTranslationResult`:
```typescript
export interface SplitBranchTelemetry {
  totalSplits: number;
  retriedBranches: number;
  fallbackBranches: number;
  failedBranchKeys: string[];
  executionDurationMs: number;
  outcome: 'SUCCESS' | 'PARTIAL';
}
```
Expose `telemetry?: SplitBranchTelemetry` and `isPartial?: boolean` on both results.

### Rationale
- Full observability without altering `src/types.ts` (kept internal to `src/services/translation/types.ts`).
- Backward compatible with existing callers that only read `rawTranslation` / `polishedTranslation`.
