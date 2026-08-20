# Quickstart: Pipeline Translation Fixes Validation (BUG 1 & BUG 2)

**Feature**: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry  
**Spec**: `specs/034-pipeline-translation-fixes/spec.md`  
**Date**: 2026-08-20

---

## 1. Quick Validation Commands

### Run Unit Tests for Text Utilities
```bash
npx vitest run server/utils/__tests__/text.test.ts
```

### Run Translation Controller Integration Tests
```bash
npx vitest run server/controllers/__tests__/translationController.test.ts
```

### Run Full Test Suite
```bash
npm test
```

---

## 2. Test Scenarios Covered

1. **Chapter Title Preservation**:
   - Phase 1 returns `Chương 1: Tiêu Đề\n\nNội dung`.
   - Phase 2 AI returns only `Nội dung đã chuốt` (dropped title).
   - Verify final output restores `Chương 1: Tiêu Đề\n\nNội dung đã chuốt`.
2. **Chinese Character Ratio Detection**:
   - AI returns text with 80% Chinese characters.
   - Verify `validateTranslationOutput` throws `UNTRANSLATED_CHINESE_LEFTOVER`.
   - Verify `isSafetyOrEmptyError` returns `true` and triggers Adaptive Split retry.
3. **Legitimate Vietnamese Text Validation**:
   - AI returns 100% Vietnamese text $\to$ passes validation smoothly with zero false positives.
