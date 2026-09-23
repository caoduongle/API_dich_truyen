# Quickstart: Validating Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature**: `159-glossary-strict-validation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

---

## 1. Prerequisites

Ensure dependencies are installed and test environment is operational:
```bash
npm run lint
npm test
```

---

## 2. Automated Verification Scenarios

### Scenario A: Strict Glossary Item Validation
Verify that malformed or empty items (missing `chinese`, empty `chinese: ""`, `chinese: 123`, `vietnamese: null`, invalid `type`) return `false` in `isGlossarySuggestionItem`:
```bash
npx vitest run src/lib/__tests__/text.test.ts -t "isGlossarySuggestionItem"
```
**Expected Outcome**: All assertions pass; malformed inputs return `false`, valid items return `true`.

### Scenario B: AI Pipeline Malformed Item Dropping
Verify that `analyzeGlossaryDirect` and `extractGlossaryDirect` discard malformed items from AI responses:
```bash
npx vitest run src/services/__tests__/directGlossaryEngine.test.ts
```
**Expected Outcome**: Tests confirm that response payloads containing `{}` or non-string fields produce clean suggestion lists without empty `{ chinese: "" }` phantom objects.

### Scenario C: Empty String Snap-Back Guard
Verify that `validateAndSnapBackEntities` filters out entities with empty or missing `chinese` strings without matching `rawText.includes("")`:
```bash
npx vitest run src/lib/__tests__/sinoNormalize.test.ts
```
**Expected Outcome**: Entities with `chinese: ""` or whitespace are excluded from the output.

### Scenario D: Type Safety & Zero `any[]` Verification
Verify that `directGlossaryEngine.ts`, `chapterTranslationService.ts`, and `translation/types.ts` compile cleanly with zero type errors:
```bash
npm run lint
```
**Expected Outcome**: `tsc --noEmit` exits with code 0 and 0 errors.

---

## 3. Full Quality Gate Verification

Execute all mandatory Constitution gates:
```bash
npm run lint    # TypeScript check - MUST be 0 errors
npm test        # Vitest suite - MUST pass 100%
npm run build   # Production build - MUST succeed cleanly
```
