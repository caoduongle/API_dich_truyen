# Quickstart & Verification Guide: Clean Legacy Metrics

**Feature**: `047-clean-legacy-metrics`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 4 kịch bản bắt buộc của TASK 10 — Đảm bảo 3 tầng metrics (Logical, Provider, Key Activity) được ghi nhận chính xác 100%, không chồng chéo ngữ nghĩa, và duy trì tương thích ngược.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`canonicalMetrics.test.ts`)

```typescript
describe('Canonical Metrics Hierarchy & Zero Semantic Overlap (TASK 10)', () => {
  // Test 1: 1 request / 1 attempt
  it('1 request / 1 attempt: records 1 logical success, 1 provider attempt, 0 retries, 1 key attempt', async () => {
    // 1 logical request succeeds immediately
  });

  // Test 2: 1 request / 3 attempts
  it('1 request / 3 attempts: records 1 logical success, 3 provider attempts, 2 retries, 2 provider failures', async () => {
    // 1 logical request retries across 3 keys
  });

  // Test 3: multiple logical requests
  it('multiple logical requests: accurately aggregates across successful and failed logical requests', async () => {
    // 5 logical requests: 3 success, 2 failed
  });

  // Test 4: all retries fail
  it('all retries fail: records 1 logical failure, N provider attempts, N-1 retries, N provider failures', async () => {
    // All retries exhausted
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho Canonical Metrics
npx vitest run server/services/__tests__/canonicalMetrics.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
