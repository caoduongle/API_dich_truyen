# Quickstart & Verification Guide: Hako Quota Estimation & Advisory Warning

**Feature**: `098-hako-quota-estimation-warning`  
**Date**: 2026-09-10

## 1. Automated Verification

Run targeted Vitest tests:
```bash
npx vitest run src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx
```

All repository verification commands:
```bash
npm run lint    # tsc --noEmit (Must pass with 0 errors)
npm test        # vitest run (All tests must pass)
npm run build   # Production bundle must build cleanly
```

## 2. Test Scenarios Covered in `HakoChapterSelector.test.tsx`

1. **AI Call Estimation Display**:
   - Render component with `selectedChapterIds = ['chap-1', 'chap-2', 'chap-3']`.
   - Verify text `"~3 lượt gọi AI"` is rendered in the document.
   - Verify selecting 0 chapters hides the estimation text.

2. **Advisory Warning when Key Quota is Exhausted**:
   - Seed `localQuotaTracker` with a mock key marked `QuotaExhausted`.
   - Select 2 chapters.
   - Verify advisory container with text `"Quota khả dụng có thể không đủ cho toàn bộ 2 chương đã chọn"` is rendered.
   - Verify container has styling classes: `text-amber-300`, `bg-amber-950/30`, `border-amber-800/50`.

3. **Advisory Warning does NOT disable Start Button**:
   - In the quota exhausted state with 2 chapters selected, verify the Start button is NOT disabled (`disabled === false`).
   - Click the button; verify `onStartAnalysis` callback is invoked.

4. **Healthy Quota State**:
   - Reset `localQuotaTracker` with healthy key.
   - Verify advisory warning is not rendered.
