# Quickstart Validation Guide: AI Pipeline Deep Hardening

**Feature**: `156-ai-pipeline-deep-hardening` | **Date**: 2026-09-22

## Prerequisites

- Node.js 18+ installed
- Repository cloned with `npm install` completed
- All changes from this feature applied

## Validation 1: Schema-Invalid JSON Bypass Prevention

### Automated tests
```bash
npm test -- --run src/lib/__tests__/text.test.ts
```

**Expected**: New tests pass for:
- `parseGeminiStructuredResponseWithState` returns `PARSE_FAILED` for non-JSON input
- `parseGeminiStructuredResponseWithState` returns `SCHEMA_INVALID` for valid JSON with wrong keys
- `parseGeminiStructuredResponseWithState` returns `VALID` for correct schema
- `isRawTranslationResponse` rejects `{}` (empty object with no translation keys)
- `isRawTranslationResponse` rejects `{ "foo": "bar" }` (only unknown keys)
- `isPolishTranslationResponse` same tightening tests

### Automated tests (service-level)
```bash
npm test -- --run src/services/translation/__tests__/rawTranslation.test.ts
npm test -- --run src/services/translation/__tests__/polishTranslation.test.ts
```

**Expected**: New/modified tests confirm that when AI returns schema-invalid JSON, the service throws a structural error rather than passing raw JSON as translated text.

---

## Validation 2: Entity Item-Level Validation

### Automated tests
```bash
npm test -- --run src/lib/__tests__/text.test.ts
```

**Expected**: New `validateDiscoveredEntity` tests pass for:
- Entity with all fields → returns validated entity
- Entity missing `pinyin` → defaults pinyin to `''`
- Entity with non-string `note` → defaults note to `''`
- Entity with invalid `type` → defaults to `'other'`
- Entity missing `chinese` → returns `null` (filtered)
- Non-object item → returns `null`

### Manual validation
Open the app, trigger a translation, and verify that discovered entities display correctly in the glossary panel even when AI omits optional fields.

---

## Validation 3: Prompt Sanitization Completeness

### Automated tests
```bash
npm test -- --run src/services/ai/__tests__/prompts.test.ts
```

**Expected**: Tests confirm that prompts built with genre/tone/description/additionalInstructions containing zero-width characters produce sanitized output without those characters.

---

## Validation 4: Cumulative Request Deadline

### Automated tests
```bash
npm test -- --run src/services/gemini/__tests__/geminiClient.test.ts
```

**Expected**: New tests confirm:
- With 3 keys, cumulative deadline of 60s is enforced (not 3×60s)
- Remaining time decreases across attempts
- Individual attempt timeout ≥ 5s minimum

---

## Validation 5: Documentation, Labels, Dependencies

### Vitest version
```bash
npx vitest --version
```
**Expected**: `>= 4.1.11`

### Dependency audit
```bash
npm audit
```
**Expected**: 0 moderate vulnerabilities in vitest/`@vitest/mocker`.

### Model label check
```bash
npm run lint
```
**Expected**: Clean typecheck. Review `src/config/models.ts` to confirm:
- `Gemini 2.5 Pro (Preset cao cấp)` label
- `lastVerifiedAt` updated to `2026-09-22`

---

## Full Verification (End-to-End)

Run the complete quality gate suite:

```bash
npm run lint    # tsc --noEmit — must pass clean
npm test        # vitest run — all tests must pass
npm run build   # tsc && vite build — must succeed
```

**Expected**: All three commands complete with zero errors and zero regressions.
