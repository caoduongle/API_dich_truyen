# Research: AI Pipeline Deep Hardening

**Date**: 2026-09-22 | **Feature**: `156-ai-pipeline-deep-hardening`

## R1: Structured Parser Bypass (Schema-Invalid JSON → Plain-Text Fallback)

### Decision
Refactor `parseGeminiStructuredResponse` to return a tri-state result (`VALID`, `PARSE_FAILED`, `SCHEMA_INVALID`) so callers can differentiate between "not JSON at all" (safe for plain-text fallback) and "valid JSON but wrong schema" (must throw, never fallback).

### Rationale
- `rawTranslation.ts` and `polishTranslation.ts` both call `parseGeminiStructuredResponse` with `fallback: {}`. When the validator rejects the JSON, it returns `{}`. The downstream code then finds no translation field and falls through to a heuristic check: `response.text.trim().length > 30 && !response.text.includes('"rawTranslation"')`. This can accept the raw JSON string as translated text.
- Example: AI returns `{"content": "一段很长的中文内容..."}` → parses as JSON → validator says `true` (because `isRawTranslationResponse` allows any object with valid-typed keys) → `parsed.rawTranslation` is `undefined` → secondary fallback picks up `response.text` → raw JSON string displayed as chapter translation.
- Even `{ "foo": "bar..." }` can pass `isRawTranslationResponse` because the guard only checks that _known_ keys have correct types; it doesn't require _any_ known key to be _present_.

### Alternatives Considered
1. **Add `hasAtLeastOneKnownKey` check to validators**: Simpler but doesn't address the fundamental issue of using `response.text` as fallback when the response _is_ JSON. The plain-text fallback should only fire when the response is genuinely plain text (non-JSON prose).
2. **Remove plain-text fallback entirely**: Too aggressive — some smaller models (Gemma) don't support structured output and return plain Vietnamese text without JSON wrapping.

### Resolution
- **Parser changes**: `parseGeminiStructuredResponse` gains an optional `returnsParseState` mode returning `{ data: T | null; state: 'VALID' | 'PARSE_FAILED' | 'SCHEMA_INVALID' }`.
- **Caller changes in `rawTranslation.ts` and `polishTranslation.ts`**: Use the state to gate the `response.text` fallback — only allow plain-text recovery when `state === 'PARSE_FAILED'`.
- **Validator tightening**: `isRawTranslationResponse` must require at least one known translation key to be a non-empty string. Same for `isPolishTranslationResponse`.

---

## R2: Entity Item-Level Validation

### Decision
Create a `validateDiscoveredEntity` function that normalizes each entity item, ensuring all required string fields (`chinese`, `pinyin`, `vietnamese`, `note`) default to `''` when missing/non-string and `type` defaults to `'other'`.

### Rationale
- `useWorkspaceState.ts` at lines 636-640 and 742-746 calls `.trim()` directly on `ent.chinese`, `ent.pinyin`, `ent.vietnamese`, `ent.note` without null-checks. If AI omits `pinyin`, `ent.pinyin.trim()` throws `TypeError`.
- `chapterTranslationService.ts` at lines 207-210 does have partial guarding (`(ent.pinyin || '').trim()`) but inconsistently.
- `validateAndSnapBackEntities` in `sinoNormalize.ts` only checks `typeof item.chinese === 'string'` and does Hanzi normalization — it does not validate other fields.

### Alternatives Considered
1. **Patch only `useWorkspaceState.ts` with optional chaining**: Doesn't solve the root cause; entities remain `any[]` and other consumers may crash too.
2. **Use Zod runtime validation**: Adds a new dependency (violates Constitution Principle II).

### Resolution
- Add `validateDiscoveredEntity(item: unknown): DiscoveredEntity | null` to `src/lib/text.ts` alongside existing validators.
- Define `DiscoveredEntity` interface in `src/services/translation/types.ts` replacing `any[]`.
- Apply validation in `rawTranslation.ts` and `polishTranslation.ts` immediately after `validateAndSnapBackEntities`, filtering out invalid entries.
- Defensive defaults in `useWorkspaceState.ts` and `chapterTranslationService.ts` as safety net.

---

## R3: Universal Prompt Sanitization

### Decision
Apply `sanitizePromptInput` to all user-provided and project-level text inputs before prompt interpolation: `genre`, `tone`, `description`, `additionalInstructions`, and all glossary item string fields.

### Rationale
- The research confirmed that in `prompts.ts`:
  - `buildRawTranslationPayload`: `genre` (L124, L156), `tone` (L157), `description` (L130, L158), `glossary` fields (L60-62, L99, L109) are unsanitized. Also `text` raw form at L145/L152 leaks unsanitized.
  - `buildPolishTranslationPayload`: `genre` (L288, L293, L312), `tone` (L294, L313), `description` (L289, L295), `additionalInstructions` (L297), `glossary` fields (L265, L306-309) are unsanitized.
  - `buildQaCritiquePayload`: `genre` (L378), `tone` (L379), `description` (L380-382), `glossary` (L370) are unsanitized.
  - `sentenceRewrite.ts`: `genre` (L61), `tone` (L62) are unsanitized.
- These fields accept user free-text input (especially `description` and `additionalInstructions`) and glossary terms imported from external files.

### Alternatives Considered
1. **Sanitize at the UI layer when saving**: Doesn't protect against data already in IndexedDB or imported files.
2. **Sanitize only `description` and `additionalInstructions`**: Insufficient — glossary imports can contain zero-width characters from source manuscripts.

### Resolution
- Sanitize at prompt construction time (defense-in-depth at the boundary).
- In each `build*Payload` function, wrap all user-provided inputs with `sanitizePromptInput()`.
- Also fix the raw `text` leak in `buildRawTranslationPayload` at L145/L152.

---

## R4: Cumulative Request Deadline Across Key Rotations

### Decision
Implement a cumulative deadline in `geminiClient.ts` that tracks elapsed time across key rotation attempts and passes decreasing `timeoutMs` to each `executeGeminiFetch` call.

### Rationale
- Currently `executeGeminiFetch` is called at L59 of `geminiClient.ts` without a `timeoutMs` argument, defaulting to 60s for every attempt.
- With N keys, worst case is N × 60s total wait. With 5 keys = 300s (5 minutes).
- The spec promises "all generation requests terminate within 60 seconds."

### Alternatives Considered
1. **Reduce per-key timeout**: E.g., 60/N seconds per key. Too aggressive for small N — with 2 keys, each gets only 30s which may be insufficient for large chapters.
2. **Keep per-key 60s, fix spec language**: Weakens the user experience guarantee.

### Resolution
- Add `overallDeadlineMs` parameter to `callGemini` options (default 60_000).
- At each iteration, compute `remainingMs = overallDeadlineMs - (Date.now() - logicalStartTime)`.
- Pass `Math.max(remainingMs, 5000)` as `timeoutMs` to `executeGeminiFetch` (minimum 5s per attempt to avoid spurious aborts).
- When `remainingMs <= 0`, throw timeout error immediately without attempting next key.

---

## R5: Quota Documentation, Model Labels, Vitest, Privacy

### Decision
- Rename quota language from "Hạn mức mặc định" to "Hạn mức cục bộ mặc định (Local scheduler defaults)" in `models.ts`, `docs/model-system.md`, and relevant UI copy.
- Update `Gemini 2.5 Pro (Mạnh nhất)` → `Gemini 2.5 Pro (Preset cao cấp)`.
- Update `lastVerifiedAt` timestamps to `2026-09-22`.
- Bump `vitest` to `^4.1.11` in `package.json`.
- Replace privacy policy date placeholder.

### Rationale
- Google rate limits are per-project, not per-key. Multiple keys in the same project do not multiply quota.
- "Mạnh nhất" is outdated given Gemini 3.x models now exist.
- Vitest `<4.1.11` has path-traversal vulnerability (GHSA-82fw-gwwq-j7x9).

### Resolution
Straightforward text/config changes across documentation, source config, and `package.json`.
