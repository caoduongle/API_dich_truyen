# Quickstart & Verification Guide: Scoped Overload Cooldown

**Feature**: `041-scoped-overload-cooldown`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 6 kịch bản bắt buộc của TASK 04 — Đảm bảo Cooldown được phân vùng phạm vi chuẩn xác (Model, Group, Key, Provider) và không làm gián đoạn chéo các luồng độc lập.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`scopedOverloadCooldown.test.ts`)

```typescript
describe('Scoped Overload Cooldown & Failure Domain Isolation (TASK 04)', () => {
  // Test 1: model A overloaded
  it('model A overloaded: puts only the overloaded model into cooldown', () => {
    // Model A gặp 503 -> Model A cooldown 3000ms
  });

  // Test 2: model B remains usable
  it('model B remains usable: allows immediate execution of unaffected models during model A cooldown', () => {
    // Khi Model A đang cooldown -> Model B được cấp phép với delayMs = 0
  });

  // Test 3: project A overloaded
  it('project A overloaded: puts only project A into group cooldown', () => {
    // Project A gặp 429/503 -> Group A cooldown 5000ms
  });

  // Test 4: project B remains usable
  it('project B remains usable: allows immediate execution of independent project B during project A cooldown', () => {
    // Khi Group A đang cooldown -> Group B được cấp phép với delayMs = 0
  });

  // Test 5: provider-wide outage
  it('provider-wide outage: activates provider backoff only when multiple distinct models and groups fail simultaneously', () => {
    // >= 2 models và >= 2 groups lỗi trong 5s -> kích hoạt Provider Outage
  });

  // Test 6: recovery
  it('recovery: automatically restores availability across all tiers once cooldown TTL expires', () => {
    // Sau khi hết TTL -> Model và Group tự động phục hồi về Available
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy các bài test chuyên biệt cho Scoped Overload Cooldown
npx vitest run server/services/__tests__/scopedOverloadCooldown.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
