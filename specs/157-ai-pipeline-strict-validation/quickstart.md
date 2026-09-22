# Quickstart & Verification Guide: Strict AI Pipeline Validation

**Feature**: `157-ai-pipeline-strict-validation`  
**Date**: 2026-09-22  
**Status**: Ready for Validation  

## Overview
This guide provides the exact verification steps to prove that:
1. `isQaCritiqueResponse({})` returns `false` and empty payloads are rejected.
2. Individual QA critique issues are strictly filtered (dropping malformed items).
3. `validateDiscoveredEntity` strictly rejects non-string types for entity fields while allowing omitted fields (Option A).
4. Cumulative request deadlines act as a hard cap without trailing overshoot.
5. Secondary structured endpoints (`directGeminiClient`, `directGlossaryEngine`, `hakoQualityEngine`) validate structured schemas.

---

## 1. Automated Test Commands

### Run Full Test Suite
```bash
npm test
```

### Run Targeted Unit Tests
```bash
# Text library & schema guard tests
npx vitest run src/lib/__tests__/text.test.ts

# Translation services & QA critique tests
npx vitest run src/services/translation/__tests__/

# Gemini transport & cumulative deadline tests
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts

# Secondary service tests
npx vitest run src/services/__tests__/directGlossaryEngine.test.ts
npx vitest run src/services/__tests__/hakoQualityEngine.test.ts
```

### Run Static Analysis & Production Build
```bash
npm run lint
npm run build
```

---

## 2. Key Verification Scenarios & Expected Results

### Scenario 1: QA Critique Schema Guard
- **Input**: `isQaCritiqueResponse({})`
- **Expected Result**: `false`
- **Input**: `isQaCritiqueResponse({ isValid: true })`
- **Expected Result**: `false`
- **Input**: `isQaCritiqueResponse({ isValid: true, issues: [] })`
- **Expected Result**: `true`

### Scenario 2: QA Issue Filtering
- **Input**: `issues: [ 123, {}, { severity: false }, { type: "omission", severity: "warning", targetText: "", description: "Thiếu câu kết" } ]`
- **Expected Result**: Only the 4th item is retained. The first 3 malformed items are filtered out, creating 0 empty warning cards.

### Scenario 3: Entity Type Validation (Option A)
- **Input**: `{ chinese: "张三", pinyin: 123, vietnamese: null }`
- **Expected Result**: `null` (rejected due to non-string fields).
- **Input**: `{ chinese: "李四" }`
- **Expected Result**: `{ chinese: "李四", pinyin: "", vietnamese: "", note: "", type: "other", needsReview: false }` (omitted fields default to `""`).

### Scenario 4: Hard Cumulative Deadline
- **Input**: Multi-key request with remaining balance = 200ms.
- **Expected Result**: Attempt timeout is bounded to 200ms (NOT raised to 1000ms).
- **Input**: Multi-key request with remaining balance <= 50ms.
- **Expected Result**: Throws `TimeoutError` immediately without opening network connection.
