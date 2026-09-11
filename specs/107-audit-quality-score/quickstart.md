# Quickstart & Verification Guide: Translation Quality Audit Score (0-100)

## 1. Prerequisites
Ensure repository is installed and dependencies are ready:
```bash
npm install
```

---

## 2. Unit Testing `calculateAuditScore` and `getAuditScoreTier`

Run the test suite specifically for `auditBridgeService`:
```bash
npx vitest run src/services/__tests__/auditBridgeService.test.ts
```

### Verified Test Cases:
1. **Empty issue list**: returns `100`, tier is "Xuất sắc" (`polish`).
2. **Pending issues deduction**:
   - 1 error (-8), 2 warnings (-6), 1 info (-1) = `85` ("Khá", `warning`).
3. **Status filtering**:
   - Issues with `status === 'resolved'` or `status === 'ignored'` do not cause point deductions.
4. **Boundary tests**:
   - `90` -> "Xuất sắc" (`polish`)
   - `89` -> "Khá" (`warning`)
   - `70` -> "Khá" (`warning`)
   - `69` -> "Cần rà soát lại" (`danger`)
5. **Score clamping**:
   - Extreme error counts (e.g. 20 errors = -160) clamp cleanly to `0`.
   - Cannot exceed `100`.

---

## 3. UI Verification in `UnifiedAuditPanel`

Run component tests:
```bash
npx vitest run src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx
```

### Manual Verification in Translator Workspace:
1. Start dev server: `npm run dev`
2. Open Translator Workspace with a chapter having Hako or QA issues.
3. Observe the header of `UnifiedAuditPanel`:
   - Verify `XX/100` and the tier badge are rendered.
   - Hover over the score to verify tooltip: `"Điểm chất lượng tham khảo ước tính dựa trên số lỗi chưa xử lý, không phải đánh giá tuyệt đối."`
4. Click "Sửa ngay" (1-click Auto-Fix) on an issue:
   - Verify the score increases by the corresponding issue weight (e.g. +8 points for error) and the tier badge updates reactively.

---

## 4. Full Quality Gates

Run all mandatory checks:
```bash
npm run lint    # tsc --noEmit
npm test        # vitest run
npm run build   # vite build + esbuild server
```
