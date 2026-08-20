# Quickstart & Verification Guide: Model Verification Unknown != True

**Feature**: `043-model-verification-unknown-not-true`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 6 kịch bản bắt buộc của TASK 06 — Đảm bảo metadata thiếu (`undefined`/`null`) không bị tự động coi là `verified = true`, và quy trình Explicit Verification Probe hoạt động chuẩn xác.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`modelVerification.test.ts`)

```typescript
describe('Model Verification Tri-State & Explicit Probe (TASK 06)', () => {
  // Test 1: capability present
  it('capability present: evaluates as supported and verifies successfully when generateContent is explicitly present', async () => {
    // metadata có ["generateContent"] -> supported = true, verified = true
  });

  // Test 2: capability absent
  it('capability absent: evaluates as unsupported and rejects verification when generateContent is missing from methods array', async () => {
    // metadata có ["embedContent"] -> unsupported = false, verified = false
  });

  // Test 3: capability missing
  it('capability missing: evaluates as unknown (never defaults to true) when supportedGenerationMethods is undefined/null', () => {
    // metadata thiếu -> trạng thái unknown, không phải true
  });

  // Test 4: malformed metadata
  it('malformed metadata: safely handles invalid types/objects without throwing TypeError and marks as unknown', () => {
    // metadata dị tật -> trạng thái unknown an toàn
  });

  // Test 5: verification success
  it('verification success: successfully verifies unknown model when explicit verification probe succeeds', async () => {
    // unknown + probe thành công -> verified = true
  });

  // Test 6: verification failure
  it('verification failure: rejects verification when explicit verification probe fails', async () => {
    // unknown + probe thất bại -> verified = false
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho Model Verification
npx vitest run server/services/__tests__/modelVerification.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
