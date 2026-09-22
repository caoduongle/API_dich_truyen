# Internal Contracts: AI Pipeline Deep Hardening

**Feature**: `156-ai-pipeline-deep-hardening` | **Date**: 2026-09-22

> This project is a pure client-side SPA with no external API surface.
> Contracts below define **internal module boundaries** between the AI parsing layer, translation services, and workspace state consumers.

---

## Contract 1: Structured Parser ↔ Translation Services

### `parseGeminiStructuredResponse<T>` Enhanced Signature

```typescript
// Existing overload (backward compatible — no change)
function parseGeminiStructuredResponse<T>(
  text: string,
  options?: StructuredParserOptions<T>
): T;

// New overload (returns parse state for callers that need to distinguish)
function parseGeminiStructuredResponseWithState<T>(
  text: string,
  options: Omit<StructuredParserOptions<T>, 'fallback'>
): StructuredParseResult<T>;

interface StructuredParseResult<T> {
  data: T | null;
  state: 'VALID' | 'PARSE_FAILED' | 'SCHEMA_INVALID';
}
```

**Postconditions**:
- When `state === 'VALID'`: `data` is non-null and satisfies the validator.
- When `state === 'PARSE_FAILED'`: `data` is null; the input was not parseable as JSON.
- When `state === 'SCHEMA_INVALID'`: `data` is null; the input was valid JSON but failed the validator.

**Caller contract (rawTranslation, polishTranslation)**:
- Plain-text recovery (`response.text` as translation) is **only permitted** when `state === 'PARSE_FAILED'`.
- When `state === 'SCHEMA_INVALID'`: throw a structural error.

---

## Contract 2: Entity Validation ↔ Consumers

### `validateDiscoveredEntity` Function

```typescript
function validateDiscoveredEntity(item: unknown): DiscoveredEntity | null;
```

**Precondition**: `item` is an arbitrary value from an AI response array element.

**Postconditions**:
- Returns `null` if `item` is not an object or `chinese` is not a non-empty string.
- Returns a `DiscoveredEntity` with all string fields guaranteed non-null and trimmed.
- `type` normalized to valid `GlossaryType` or defaulted to `'other'`.

### Consumer contract (`useWorkspaceState`, `chapterTranslationService`):
- Must filter entity arrays through `validateDiscoveredEntity` before accessing `.trim()`.
- OR: Must use defensive patterns `(ent.field || '').trim()` at minimum.

---

## Contract 3: Prompt Builder ↔ AI Transport

### Sanitization Invariant

All `build*Payload` functions guarantee that **every** user-provided or project-level string interpolated into `systemInstruction` or `prompt` has been passed through `sanitizePromptInput()`.

**Covered fields per builder**:
| Builder | Fields that MUST be sanitized |
| :--- | :--- |
| `buildRawTranslationPayload` | `text`, `genre`, `tone`, `description`, glossary `chinese/vietnamese/pinyin/note/variants` |
| `buildPolishTranslationPayload` | `sourceText`, `rawTranslation`, `genre`, `tone`, `description`, `additionalInstructions`, glossary fields |
| `buildQaCritiquePayload` | `sourceText`, `translatedText`, `genre`, `tone`, `description`, glossary fields |
| `rewriteSentenceDirect` | `targetText`, `context`, `issueMessage`, `genre`, `tone` |

---

## Contract 4: Transport ↔ Client Orchestrator (Cumulative Deadline)

### `executeGeminiFetch` — Accepts `timeoutMs`

```typescript
function executeGeminiFetch(
  url: string,
  apiKey: string,
  payload: Record<string, any>,
  signal?: AbortSignal,
  timeoutMs?: number  // default 60_000
): Promise<Response>;
```

### `callGemini` — Enforces cumulative deadline

```typescript
interface CallGeminiOptions extends DirectGeminiRequestOptions {
  overallDeadlineMs?: number; // default 60_000
}
```

**Invariant**: The sum of all `timeoutMs` values passed to `executeGeminiFetch` across key rotation attempts never exceeds `overallDeadlineMs` from the first attempt's start time.

**Algorithm**:
```
logicalStart = Date.now()
for each key attempt:
  remainingMs = overallDeadlineMs - (Date.now() - logicalStart)
  if remainingMs <= 0: throw TimeoutError
  attemptTimeoutMs = max(remainingMs, minPerAttemptMs=5000)
  executeGeminiFetch(..., attemptTimeoutMs)
```
