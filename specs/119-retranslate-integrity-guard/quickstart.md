# Quickstart: Retranslate Integrity Guard and Safe Draft Preservation

## Prerequisites

- Node.js 18+ installed.
- Working directory: repository root.

## Automated Verification

```bash
# 1. Typecheck and linting
npm run lint

# 2. Run unit tests for chapter translation service and draft lifecycle
npm test -- src/services/__tests__/chapterTranslationService.test.ts
npm test -- src/components/__tests__/ChapterHistoryPanel.test.tsx

# 3. Run full test suite
npm test

# 4. Production build verification
npm run build
```

## Validation Scenarios

### Scenario 1: True Re-translation Under `from_scratch` Mode
1. Set up a chapter with existing truncated `rawTranslation` and `polishedTranslation`.
2. Execute `executeSingleChapterTranslation` with `autoTranslateMode = 'from_scratch'`.
3. Verify:
   - `translateRawDirect` is called with full `sourceText`.
   - The saved chapter in IndexedDB contains a full `rawTranslation` and full `polishedTranslation`.

### Scenario 2: Integrity Guard Truncation Detection
1. Set up a chapter with 800 characters of Chinese `sourceText` and 50 characters of `rawTranslation`.
2. Execute `executeSingleChapterTranslation` under `repolish` mode.
3. Verify:
   - `isDraftTruncated` evaluates to `true`.
   - A warning log `[Cảnh báo toàn vẹn]` is emitted.
   - The engine automatically invokes `translateRawDirect` to produce a fresh raw draft.

### Scenario 3: Granular Draft Actions in Chapter History
1. Open Chapter History with a chapter having both raw and polished text.
2. Click "Xóa bản biên tập":
   - Verify `polishedTranslation` is cleared, `rawTranslation` remains intact, tab switches to "Dịch thô".
3. Click "Chuyển thành bản thô":
   - Verify `rawTranslation` receives the polished text, `polishedTranslation` is reset, ready for re-polishing.
4. Click "Xóa bản dịch thô":
   - Verify `rawTranslation` is cleared, tab switches to "Bản gốc".
