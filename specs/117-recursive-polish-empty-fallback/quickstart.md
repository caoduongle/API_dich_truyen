# Quickstart: Translation Resilience & Recursive Polish

## Prerequisites

- Node.js 18+ installed.
- Working directory: repository root.

## Automated Verification

Run existing and new automated test suites:

```bash
# 1. Typecheck and linting
npm run lint

# 2. Run unit tests for direct translation engine and chapter translation service
npm test -- src/services/__tests__/directTranslationEngine.test.ts
npm test -- src/services/__tests__/chapterTranslationService.test.ts

# 3. Run full test suite
npm test

# 4. Production build verification
npm run build
```

## Validation Scenarios

### Scenario 1: Recursive Polish on Empty Response
1. Call `polishTranslationDirect` with a mock where full text throws `Error('AI trả về phản hồi rỗng.')` but split segments return valid polished text.
2. Verify that `polishTranslationDirect` performs recursive splitting (`depth = 1`), combines results, and returns complete polished translation.

### Scenario 2: Preservation of Prior Round in Iterative Polish
1. Execute `executeSingleChapterTranslation` with `polishCycles = 3`.
2. Mock Round 1 and Round 2 to return valid distinct text.
3. Mock Round 3 to throw `Error('AI trả về phản hồi rỗng.')`.
4. Verify:
   - The chapter translation finishes with `success = true`.
   - The saved chapter contains the text produced by Round 2.
   - An informative warning log is emitted: `"Bảo lưu kết quả đã chuốt từ Lượt 2 để tiếp tục"`.
