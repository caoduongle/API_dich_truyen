# Quickstart & Verification Guide: Verify Project ID

**Feature**: `048-verify-project-id`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 4 kịch bản bắt buộc của TASK 11 — Đảm bảo `projectId` được phân loại đúng nguồn gốc (`source`) và trạng thái xác thực (`status`), ngăn ngừa suy diễn sai về Provider Quota Bucket.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`projectVerification.test.ts`)

```typescript
describe('Project ID Verification & Quota Bucket Semantics (TASK 11)', () => {
  // Test 1: same declared project
  it('same declared project: records source=user, status=declared and isolates buckets unless explicit group', () => {
    // 2 keys with same declared projectId string
  });

  // Test 2: different declared project
  it('different declared project: assigns to distinct quota groups with respective metadata', () => {
    // 2 keys with different declared projectIds
  });

  // Test 3: provider verified project
  it('provider verified project: records source=provider, status=verified and guarantees same quota bucket', () => {
    // Key verified by provider probe
  });

  // Test 4: unknown project
  it('unknown project: records source=inferred, status=unknown and isolates safely', () => {
    // Key without projectId
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt
npx vitest run server/services/__tests__/projectVerification.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
