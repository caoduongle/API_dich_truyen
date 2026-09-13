# Quickstart: Text Cleaner & Storage Usage Verification

This guide outlines the commands and procedures to verify:
1. Stripping invisible characters (`\u200B`, `\uFEFF`, `\u200D`, `\u200C`) and NFC normalization in `cleanChineseText`.
2. Storage usage display in `ApiSettings` with null fallback.
3. Quality gates (`npm run lint`, `npm test`, `npm run build`).

---

## 1. Unit Test Verification for Text Cleaner

Run the targeted unit test suite:

```bash
npx vitest run src/utils/__tests__/textCleaner.test.ts
```

Expected Output:
- All assertions pass, confirming:
  - Zero-width space (`\u200B`), BOM (`\uFEFF`), ZWJ (`\u200D`), and ZWNJ (`\u200C`) are cleanly stripped.
  - Decomposed characters are normalized to NFC (`.normalize('NFC')`).
  - Chapter title separation and watermark ad-stripping remain 100% operational.

---

## 2. Unit Test Verification for Storage Usage Component

Run unit tests covering `estimateStorageUsage()` and settings components:

```bash
npx vitest run src/services/__tests__/db.test.ts
```

Expected Output:
- `estimateStorageUsage()` tests pass, confirming handling of storage calculation and permission errors.

---

## 3. Full Constitutional Quality Gate Verification

Run the mandatory quality gate commands in sequence:

```bash
npm run lint
npm test
npm run build
```

Expected Results:
- `npm run lint`: `tsc --noEmit` exits with 0 errors.
- `npm test`: 100% of test files and test cases pass.
- `npm run build`: `tsc && vite build` generates the production bundle without errors.
