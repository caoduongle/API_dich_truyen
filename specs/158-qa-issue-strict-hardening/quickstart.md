# Quickstart: Validating Strict QA Issue Validation & Secondary Pipeline Hardening

**Feature**: `158-qa-issue-strict-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

---

## 1. Prerequisites

Ensure dependencies are installed and test environment is operational:
```bash
npm run lint
npm test
```

---

## 2. Automated Verification Scenarios

### Scenario A: Strict QA Issue Validation
Verify that incomplete issue payloads (missing `type`, missing `severity`, missing `targetText`) return `false` in `isQaCritiqueIssue`:
```bash
npx vitest run src/lib/__tests__/text.test.ts -t "isQaCritiqueIssue"
```
**Expected Outcome**: All tests pass asserting that `{ description: "Lỗi" }`, `{ type: "omission", description: "Thiếu" }`, and malformed items return `false`.

### Scenario B: QA Critique Service Issue Filtering
Verify that `qaCritiqueDirect` drops incomplete issues:
```bash
npx vitest run src/services/translation/__tests__/qaCritique.test.ts
```
**Expected Outcome**: Tests confirm that only fully-formed issues appear in `DirectQaCritiqueResult.issues`.

### Scenario C: Hako AI Quality Scan Item-Level Validation
Verify that Hako scan parser discards corrupt issue items:
```bash
npx vitest run src/services/__tests__/hakoQualityEngine.test.ts
```
**Expected Outcome**: Tests verify that items with non-string explanation or invalid category/severity are filtered out.

### Scenario D: Prompt Sanitization Verification
Verify that `quickTranslateTermDirect` and Hako scanner sanitize genre, chapter title, and project title:
```bash
npx vitest run src/services/__tests__/directTranslationEngine.test.ts
```
**Expected Outcome**: Prompt tests verify that malicious injection tokens are sanitized.

---

## 3. Full Quality Gate Verification

Execute all mandatory Constitution gates:
```bash
npm run lint    # TypeScript check - MUST be 0 errors
npm test        # Vitest suite - MUST pass 100%
npm run build   # Production build - MUST succeed cleanly
```
